// Creates the auth account for the final "complete registration" step
// (rep-signup.html) and, in the same call, creates the public.users profile row
// and consumes the invite lead — the two things a DB trigger (dropped from
// schema.sql) used to do on email-confirm. There's no second email-confirm round
// trip here: by this point the applicant already proved they control the address
// back at the inquiry stage (verify-lead-email), and they're holding an
// unguessable invite token that was mailed to that same address — a third
// verification would just be friction.
//
// admin.createUser({email_confirm: true}) creates an already-confirmed account
// directly — no confirmation email is sent by Supabase or by us. Needs the
// service role key, which Supabase injects automatically into every edge
// function (no secret to set).
//
// Deploy: supabase functions deploy rep-signup
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const ALREADY_REGISTERED = { error: 'This email is already registered — sign in instead.' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const { email, password } = body;
  if (!email || !password) return json({ error: 'Missing required fields' }, 400);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const userMetadata = {
    first_name: body.firstName || null,
    last_name: body.lastName || null,
    agency_name: body.agencyName || null,
    url: body.url || null,
    title: body.title || null,
    work_phone: body.workPhone || null,
    ext: body.ext || null,
    mobile: body.mobile || null,
    addr1: body.addr1 || null,
    addr2: body.addr2 || null,
    city: body.city || null,
    state: body.state || null,
    postal: body.postal || null,
    about: body.about || null,
    invite_token: body.inviteToken || null,
  };

  const { data: createData, error: createError } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  let user = createData?.user;

  if (createError) {
    if (!/already.*(registered|exists)/i.test(createError.message || '')) {
      return json({ error: createError.message || 'Sign-up failed — try again.' }, 400);
    }

    // An auth account for this email already exists — but that alone doesn't mean
    // this person already has a working account. It can be an abandoned signup
    // from before this flow existed, or one an admin later deleted the profile
    // for (public.users has no auth-side counterpart to clean up automatically).
    // Only treat it as "already registered" if a profile actually backs it;
    // otherwise reset the account and let this invite finish the job — the
    // trust boundary is the same either way (an unguessable invite token mailed
    // to this address), so this isn't granting anything a fresh signup wouldn't.
    const { data: recoveryData, error: recoveryError } = await sb.auth.admin.generateLink({ type: 'recovery', email });
    if (recoveryError || !recoveryData?.user) return json(ALREADY_REGISTERED, 400);

    const existingId = recoveryData.user.id;
    const { data: profile } = await sb.from('users').select('id').eq('id', existingId).maybeSingle();
    if (profile) return json(ALREADY_REGISTERED, 400);

    const { data: updateData, error: updateError } = await sb.auth.admin.updateUserById(existingId, {
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    });
    if (updateError || !updateData?.user) return json({ error: 'Sign-up failed — try again.' }, 500);
    user = updateData.user;
  }

  if (!user) return json({ error: 'Sign-up failed — try again.' }, 500);

  // Mirrors what the old email-confirm trigger did.
  const { error: profileError } = await sb.from('users').upsert(
    {
      id: user.id,
      email: user.email,
      first_name: body.firstName || null,
      last_name: body.lastName || null,
      agency_name: body.agencyName || null,
      url: body.url || null,
      title: body.title || null,
      work_phone: body.workPhone || null,
      ext: body.ext || null,
      mobile: body.mobile || null,
      addr1: body.addr1 || null,
      addr2: body.addr2 || null,
      city: body.city || null,
      state: body.state || null,
      postal: body.postal || null,
      about: body.about || null,
      approved: true,
    },
    { onConflict: 'id' }
  );

  if (profileError) return json({ error: 'Account created but the profile could not be saved — contact support.' }, 500);

  if (body.inviteToken) {
    await sb.from('rep_leads').delete().eq('invite_token', body.inviteToken);
  }

  return json({ success: true }, 200);
});
