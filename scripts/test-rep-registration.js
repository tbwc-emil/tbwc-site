// Regression checks for the registration flow (inquiry -> verify email ->
// admin approval -> signup, auto-confirmed). Hits the live Supabase project
// directly (schema, RLS, edge functions) and cleans up everything it creates.
//   node scripts/test-rep-registration.js
//
// Does NOT exercise the happy path of submit-rep-lead or rep-signup, or send a
// real verify/invite/notify email — those need a deliverable inbox and would
// spam it each run. See admin.html for the parts this can't cover. The
// dup-lead-vs-existing-rep guard and the auto-approve-on-confirm step both used
// to be DB triggers; they're edge functions now (submit-rep-lead, rep-signup,
// verify-lead-email) — the database only stores data.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const clientJs = fs.readFileSync(path.join(__dirname, '..', 'supabase-client.js'), 'utf8');
const SUPABASE_URL = clientJs.match(/SUPABASE_URL = '([^']+)'/)[1];
const ANON_KEY = clientJs.match(/SUPABASE_ANON_KEY = '([^']+)'/)[1];
const FN_URL = SUPABASE_URL + '/functions/v1/';
const REST_URL = SUPABASE_URL + '/rest/v1/';

let pass = 0, fail = 0;
function ok(label) { pass++; console.log('  [OK]   ' + label); }
function bad(label, detail) { fail++; console.log('  [FAIL] ' + label + (detail ? ' — ' + detail : '')); }
function assert(cond, label, detail) { cond ? ok(label) : bad(label, detail); }

async function fn(name, body) {
  const res = await fetch(FN_URL + name, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ANON_KEY, apikey: ANON_KEY },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

// No Prefer: return=representation on purpose — matches how newrep-request.html
// actually calls insert() (no .select()). Requesting the row back would also
// require a SELECT policy anon doesn't have here (INSERT...RETURNING needs one
// too), which would fail these calls for a reason that has nothing to do with
// what's under test.
async function rest(method, table, { body, query } = {}) {
  const res = await fetch(REST_URL + table + (query || ''), {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ANON_KEY, apikey: ANON_KEY },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function testSchema(db) {
  console.log('\nSchema — table, policies, triggers, indexes');

  const table = await db.query("select 1 from information_schema.tables where table_name='rep_leads'");
  assert(table.rowCount === 1, 'rep_leads table exists');

  const policies = await db.query("select policyname from pg_policies where tablename='rep_leads' order by policyname");
  const expectedPolicies = ['rep_leads_delete_admin', 'rep_leads_insert_public', 'rep_leads_select_admin', 'rep_leads_update_admin'];
  const gotPolicies = policies.rows.map((r) => r.policyname);
  assert(expectedPolicies.every((p) => gotPolicies.includes(p)), 'all 4 rep_leads RLS policies exist', gotPolicies.join(', '));

  const index = await db.query("select 1 from pg_indexes where tablename='rep_leads' and indexname='rep_leads_email_unique'");
  assert(index.rowCount === 1, 'rep_leads_email_unique index exists');

  // These all used to be DB triggers; the logic now lives in edge functions
  // (rep-signup, submit-rep-lead) instead, so none of them should exist.
  const triggers = await db.query(
    "select tgname from pg_trigger where tgname in ('on_auth_user_created','on_auth_user_email_confirmed','check_lead_email_available')"
  );
  assert(triggers.rowCount === 0, 'no leftover DB triggers (email-confirm + dup-lead guard moved to edge functions)', triggers.rows.map((r) => r.tgname).join(', '));
}

async function testAnonInsert(db) {
  console.log('\nAnon insert — matches how newrep-request.html actually calls it (no RETURNING)');
  const email = 'test-anon-insert-' + Date.now() + '@example.com';
  const res = await rest('POST', 'rep_leads', { body: { first_name: 'Test', last_name: 'Anon', email } });
  assert(res.status === 201, 'anon insert succeeds (201)', JSON.stringify(res.json));
  if (res.status === 201) {
    await db.query('delete from public.rep_leads where email = $1', [email]);
  }
}

async function testDuplicateGuards(db) {
  console.log('\nDuplicate-email guards');
  const email = 'test-dup-' + Date.now() + '@example.com';

  const first = await rest('POST', 'rep_leads', { body: { first_name: 'Dup', last_name: 'One', email } });
  assert(first.status === 201, 'first insert with fresh email succeeds');

  const second = await rest('POST', 'rep_leads', { body: { first_name: 'Dup', last_name: 'Two', email } });
  assert(second.status === 409 && second.json && second.json.code === '23505', 'second insert with same email rejected (23505)', JSON.stringify(second.json));

  await db.query('delete from public.rep_leads where email = $1', [email]);

  // This guard is now enforced by submit-rep-lead (service role), not a DB
  // trigger — a raw REST insert like the calls above would no longer catch it,
  // since rep_leads_insert_public has no way to check public.users itself.
  const repRow = await db.query("select email from public.users where type = 'rep' limit 1");
  if (repRow.rowCount) {
    const repEmail = repRow.rows[0].email;
    const dupRep = await fn('submit-rep-lead', { firstName: 'Existing', lastName: 'Rep', email: repEmail });
    assert(
      dupRep.status === 400 && dupRep.json && dupRep.json.code === 'P0001',
      'submit-rep-lead rejects an existing rep\'s email (P0001)',
      JSON.stringify(dupRep.json)
    );
  } else {
    console.log('  [SKIP] no existing reps row to test against');
  }
}

async function testEdgeFunctions(db) {
  console.log('\nEdge functions — verify-turnstile, get-lead, send-mail, rep-signup, submit-rep-lead, verify-lead-email');

  const badTurnstile = await fn('verify-turnstile', { token: 'not-a-real-token' });
  assert(badTurnstile.status === 403 && badTurnstile.json && badTurnstile.json.success === false, 'verify-turnstile rejects a bogus token');

  const missingLead = await fn('get-lead', { token: 'nonexistent-token-' + Date.now() });
  assert(missingLead.status === 404, 'get-lead 404s for an unknown token');

  const token = 'test-token-' + Date.now();
  const email = 'test-getlead-' + Date.now() + '@example.com';
  await db.query(
    "insert into public.rep_leads (first_name,last_name,email,phone,about,invite_token,invited_at) values ('GetLead','Test',$1,'555-0100','testing',$2,now())",
    [email, token]
  );
  const validLead = await fn('get-lead', { token });
  assert(
    validLead.status === 200 && validLead.json && validLead.json.email === email,
    'get-lead returns correct prefill data for a valid invited token',
    JSON.stringify(validLead.json)
  );
  await db.query('delete from public.rep_leads where email = $1', [email]);

  const badType = await fn('send-mail', { type: 'not-a-real-type' });
  assert(badType.status === 400, 'send-mail rejects an unknown type (structural check only — not sending a real email)');

  // Structural checks only — not exercising the happy path (would create a real
  // auth user / send a real email each run).
  const missingSignupFields = await fn('rep-signup', { email: 'test@example.com' });
  assert(missingSignupFields.status === 400, 'rep-signup rejects a request missing password');

  const repRow = await db.query("select email from public.users where type = 'rep' limit 1");
  if (repRow.rowCount) {
    const alreadyRegistered = await fn('rep-signup', { email: repRow.rows[0].email, password: 'irrelevant-wrong-password' });
    assert(
      alreadyRegistered.status === 400 && /already registered/i.test((alreadyRegistered.json || {}).error || ''),
      'rep-signup refuses to create a duplicate account for an already-registered email',
      JSON.stringify(alreadyRegistered.json)
    );
  } else {
    console.log('  [SKIP] no existing reps row to test rep-signup\'s already-registered case against');
  }

  const missingLeadFields = await fn('submit-rep-lead', { email: 'test@example.com' });
  assert(missingLeadFields.status === 400, 'submit-rep-lead rejects a request missing firstName/lastName');

  // verify-lead-email is a GET link a browser navigates to (no Authorization
  // header), deployed with --no-verify-jwt — hit it directly rather than through fn().
  const verifyRes = await fetch(FN_URL + 'verify-lead-email?token=not-a-real-token&redirect_to=https%3A%2F%2Ftbwctechnology.com%2Fnewrep-request.html', { redirect: 'manual' });
  assert(verifyRes.status === 302, 'verify-lead-email runs without a JWT (redirects, not 401)', String(verifyRes.status));
  const location = verifyRes.headers.get('location') || '';
  assert(location.includes('verify=invalid'), 'verify-lead-email redirects with ?verify=invalid for a bogus token', location);
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await testSchema(db);
    await testAnonInsert(db);
    await testDuplicateGuards(db);
    await testEdgeFunctions(db);
  } finally {
    await db.end();
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Test run crashed:', err.message);
  process.exit(1);
});
