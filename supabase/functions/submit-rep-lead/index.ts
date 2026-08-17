// Creates a rep_leads row for the public inquiry form (newrep-request.html) and
// emails the applicant a verify-your-email link, replacing what the
// check_lead_email_available() DB trigger used to do (dropped from schema.sql) —
// the "already has an account" guard now runs here in app code instead of
// Postgres. Runs with the service role (auto-injected), matching get-lead's
// reasoning: anon can't SELECT public.users to check this client-side without a
// policy that would let emails be enumerated.
//
// Verification happens here, at the inquiry stage, rather than later at account
// creation — admin.html only notifies/lets an admin approve a lead once
// verify-lead-email has flipped email_verified, and rep-signup (the final step)
// trusts that proof instead of running its own separate email-confirm round trip.
// Deploy: supabase functions deploy submit-rep-lead
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { esc, wrapEmail, sendMail, smtpConfigured } from '../_shared/mailer.ts';

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

function verifyLeadEmail(f: { firstName: string; link: string }) {
  const body =
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4b4e57;">Hi ${esc(f.firstName)}, thanks for your interest in becoming a TBWC representative.</p>` +
    `<p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#4b4e57;">Confirm your email address so we can review your request.</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#2f5bd6" style="border-radius:7px;">` +
    `<a href="${esc(f.link)}" target="_blank" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:7px;">Confirm email address</a>` +
    `</td></tr></table>` +
    `<p style="margin:28px 0 8px;font-size:13px;line-height:1.5;color:#7c7f89;">Or paste this link into your browser:</p>` +
    `<p style="margin:0;font-family:'Geist Mono',ui-monospace,SFMono-Regular,monospace;font-size:12px;line-height:1.5;word-break:break-all;color:#2f5bd6;">${esc(f.link)}</p>`;
  return {
    subject: 'Confirm your email — TBWC Rep Portal',
    html: wrapEmail('Confirm your email to continue your TBWC rep application.', 'Confirm your email', body),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!smtpConfigured()) return json({ error: 'Server misconfigured' }, 500);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const { firstName, lastName, email, phone, about, redirectTo } = body;
  if (!firstName || !lastName || !email) return json({ error: 'Missing required fields' }, 400);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: existing } = await sb.from('users').select('id').ilike('email', email).maybeSingle();
  if (existing) {
    return json(
      { error: 'This email is already registered. Sign in from the site header, or contact support if you need help.', code: 'P0001' },
      400
    );
  }

  const verifyToken = crypto.randomUUID();

  const { error } = await sb.from('rep_leads').insert({
    first_name: firstName,
    last_name: lastName,
    email,
    phone: phone || null,
    about: about || null,
    verify_token: verifyToken,
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

  const link =
    `${SUPABASE_URL}/functions/v1/verify-lead-email?token=${encodeURIComponent(verifyToken)}` +
    `&redirect_to=${encodeURIComponent(redirectTo || 'https://tbwctechnology.com/newrep-request.html')}`;

  try {
    const { subject, html } = verifyLeadEmail({ firstName, link });
    await sendMail(email, subject, html);
  } catch (err) {
    // The lead row is already saved — an admin can still see and approve it
    // manually — but say so plainly rather than a false "check your email".
    return json({ error: 'Request saved, but the confirmation email failed to send — contact support.' }, 500);
  }

  return json({ success: true }, 200);
});
