// Creates a rep_leads row for the public inquiry form (newrep-request.html),
// replacing what the check_lead_email_available() DB trigger used to do (dropped
// from schema.sql) — the "already has an account" guard now runs here in app code
// instead of Postgres. Runs with the service role (auto-injected), matching
// get-lead's reasoning: anon can't SELECT public.users to check this client-side
// without a policy that would let emails be enumerated.
// Deploy: supabase functions deploy submit-rep-lead
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const { firstName, lastName, email, phone, about } = body;
  if (!firstName || !lastName || !email) return json({ error: 'Missing required fields' }, 400);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: existing } = await sb.from('users').select('id').ilike('email', email).maybeSingle();
  if (existing) {
    return json(
      { error: 'This email is already registered. Sign in from the site header, or contact support if you need help.', code: 'P0001' },
      400
    );
  }

  const { error } = await sb.from('rep_leads').insert({
    first_name: firstName,
    last_name: lastName,
    email,
    phone: phone || null,
    about: about || null,
  });

  if (error) {
    if (error.code === '23505') {
      return json(
        { error: "You've already submitted a request with this email — an account manager will be in touch.", code: '23505' },
        409
      );
    }
    return json({ error: error.message || 'Something went wrong — please try again.' }, 500);
  }

  return json({ success: true }, 200);
});
