// Verifies a Cloudflare Turnstile token server-side before the client is allowed
// to call auth.signUp(). Runs as a Supabase Edge Function so the secret key never
// reaches the browser. Deploy: supabase functions deploy verify-turnstile
// Secret:  supabase secrets set TURNSTILE_SECRET_KEY=your-secret-key
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const TURNSTILE_SECRET_KEY = Deno.env.get('TURNSTILE_SECRET_KEY');

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
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);
  if (!TURNSTILE_SECRET_KEY) return json({ success: false, error: 'Server misconfigured' }, 500);

  let token: unknown;
  try {
    ({ token } = await req.json());
  } catch {
    return json({ success: false, error: 'Invalid request body' }, 400);
  }
  if (!token || typeof token !== 'string') {
    return json({ success: false, error: 'Missing token' }, 400);
  }

  const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: req.headers.get('x-forwarded-for') || undefined,
    }),
  });
  const verifyData = await verifyRes.json();

  return json({ success: !!verifyData.success }, verifyData.success ? 200 : 403);
});
