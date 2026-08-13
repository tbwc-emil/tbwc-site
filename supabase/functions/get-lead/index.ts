// Looks up a rep_leads row by invite token so rep-signup.html can prefill and
// validate an invite link, without granting anon SELECT on the table itself
// (which would let tokens be enumerated). Runs with the service role, which
// Supabase injects automatically for edge functions. Deploy:
//   supabase functions deploy get-lead
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

  let token: unknown;
  try {
    ({ token } = await req.json());
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (!token || typeof token !== 'string') return json({ error: 'Missing token' }, 400);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await sb
    .from('rep_leads')
    .select('first_name,last_name,email,phone,about')
    .eq('invite_token', token)
    .not('invited_at', 'is', null)
    .single();

  if (error || !data) return json({ error: 'Invalid or expired invite' }, 404);

  return json({
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
    phone: data.phone,
    about: data.about,
  }, 200);
});
