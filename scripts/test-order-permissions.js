// Regression checks for the can_see_orders / can_approve_rep_leads RLS gates.
// is_admin used to OR into both policies, so an admin kept seeing every order
// and every rep lead even with their flag switched off (see schema.sql commit
// "Stop is_admin from bypassing can_see_orders/can_approve_rep_leads flags").
// Hits the live Supabase project directly, using SET LOCAL ROLE + the JWT
// sub claim to simulate a real admin session without needing their password —
// same trick Postgres/PostgREST uses under the hood for auth.uid(). Restores
// whatever flag values it found before exiting.
//   node scripts/test-order-permissions.js
require('dotenv').config();
const { Client } = require('pg');

let pass = 0, fail = 0;
function ok(label) { pass++; console.log('  [OK]   ' + label); }
function bad(label, detail) { fail++; console.log('  [FAIL] ' + label + (detail ? ' — ' + detail : '')); }
function assert(cond, label, detail) { cond ? ok(label) : bad(label, detail); }

// Runs `run` as if it were a logged-in request from `userId` — RLS-scoped,
// not bypassing anything the way the postgres/service role does. Always rolls
// back, so it can never leave data changes behind.
async function asUser(db, userId, run) {
  await db.query('begin');
  try {
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    return await run();
  } finally {
    await db.query('rollback');
  }
}

async function testSchema(db) {
  console.log('\nSchema — order/rep_leads policies no longer let is_admin bypass the flags');

  const orderPolicies = await db.query("select policyname, qual from pg_policies where tablename = 'order' order by policyname");
  const orderNames = orderPolicies.rows.map((r) => r.policyname);
  assert(!orderNames.includes('order_select_admin'), 'order_select_admin (blanket is_admin bypass) no longer exists', orderNames.join(', '));
  const orderSelectEmployee = orderPolicies.rows.find((r) => r.policyname === 'order_select_employee');
  assert(!!orderSelectEmployee && orderSelectEmployee.qual === 'can_see_orders()', 'order_select_employee gates on can_see_orders() alone', JSON.stringify(orderSelectEmployee));

  const leadPolicies = await db.query("select policyname, qual from pg_policies where tablename = 'rep_leads' and policyname like 'rep_leads_%_admin' order by policyname");
  const stillOrsIsAdmin = leadPolicies.rows.filter((r) => r.qual && r.qual.includes('is_admin'));
  assert(stillOrsIsAdmin.length === 0, 'no rep_leads policy ORs in is_admin() anymore', JSON.stringify(leadPolicies.rows));

  const fnDefs = await db.query(
    "select proname, prosrc from pg_proc where proname in ('can_see_orders','can_approve_rep_leads') and pronamespace = (select oid from pg_namespace where nspname = 'public')"
  );
  fnDefs.rows.forEach((r) => {
    assert(!/type\s*=\s*'employee'/.test(r.prosrc), r.proname + "() no longer requires type = 'employee' (so it also applies to admins)", r.prosrc);
  });
}

async function testAdminWithoutFlagsSeesNothing(db) {
  console.log('\nAdmin with both flags off — should see zero orders and zero rep leads');

  // Needs a real admin who doesn't independently own orders via order.rep_id —
  // otherwise order_select_own_rep would mask what we're testing here.
  const candidates = await db.query(
    `select id, email, can_see_orders, can_approve_rep_leads from public.users
     where is_admin = true
       and id not in (select distinct rep_id from public."order" where rep_id is not null)
     limit 1`
  );
  if (!candidates.rowCount) {
    console.log('  [SKIP] no admin without rep_id-owned orders to test against');
    return;
  }
  const admin = candidates.rows[0];

  await db.query('update public.users set can_see_orders = false, can_approve_rep_leads = false where id = $1', [admin.id]);
  try {
    const orderCount = await asUser(db, admin.id, () => db.query('select count(*) from public."order"'));
    assert(orderCount.rows[0].count === '0', admin.email + ' (is_admin, can_see_orders=false) sees 0 orders', orderCount.rows[0].count);

    const leadCount = await asUser(db, admin.id, () => db.query('select count(*) from public.rep_leads'));
    assert(leadCount.rows[0].count === '0', admin.email + ' (is_admin, can_approve_rep_leads=false) sees 0 rep leads', leadCount.rows[0].count);
  } finally {
    await db.query('update public.users set can_see_orders = $2, can_approve_rep_leads = $3 where id = $1', [
      admin.id, admin.can_see_orders, admin.can_approve_rep_leads,
    ]);
  }
}

async function testAdminWithFlagsSeesEverything(db) {
  console.log('\nAdmin with both flags on — should see every order and every rep lead');

  const candidates = await db.query('select id, email, can_see_orders, can_approve_rep_leads from public.users where is_admin = true limit 1');
  if (!candidates.rowCount) {
    console.log('  [SKIP] no admin to test against');
    return;
  }
  const admin = candidates.rows[0];

  const [{ rows: [{ count: totalOrders }] }, { rows: [{ count: totalLeads }] }] = await Promise.all([
    db.query('select count(*) from public."order"'),
    db.query('select count(*) from public.rep_leads'),
  ]);

  await db.query('update public.users set can_see_orders = true, can_approve_rep_leads = true where id = $1', [admin.id]);
  try {
    const orderCount = await asUser(db, admin.id, () => db.query('select count(*) from public."order"'));
    assert(orderCount.rows[0].count === totalOrders, admin.email + ' (can_see_orders=true) sees all ' + totalOrders + ' orders', orderCount.rows[0].count);

    const leadCount = await asUser(db, admin.id, () => db.query('select count(*) from public.rep_leads'));
    assert(leadCount.rows[0].count === totalLeads, admin.email + ' (can_approve_rep_leads=true) sees all ' + totalLeads + ' rep leads', leadCount.rows[0].count);
  } finally {
    await db.query('update public.users set can_see_orders = $2, can_approve_rep_leads = $3 where id = $1', [
      admin.id, admin.can_see_orders, admin.can_approve_rep_leads,
    ]);
  }
}

async function main() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await testSchema(db);
    await testAdminWithoutFlagsSeesNothing(db);
    await testAdminWithFlagsSeesEverything(db);
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
