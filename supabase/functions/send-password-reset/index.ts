// Sends the "reset your password" email through Brevo (see _shared/mailer.ts)
// instead of Supabase's built-in auth mailer, which only delivers to the
// project's own team members and was silently dropping every rep's reset email.
//
// admin.generateLink({type: 'recovery'}) mints a one-time recovery token — it
// sends nothing itself. The email links straight to reset-password.html with
// ?token_hash=…, and that page redeems it with verifyOtp(). Not the
// action_link (Supabase's /auth/v1/verify): that only redirects to URLs on
// Auth > URL Configuration > Redirect URLs and otherwise drops the user on the
// Site URL — the login page — with no way to set a password.
//
// redirectTo comes from the browser, so it is checked against
// ALLOWED_RESET_ORIGINS: the token rides in that URL, and an arbitrary one
// would let anyone mail a victim a link that hands their token to another site.
//
// Always answers 200 for a well-formed request, whether or not the address has
// an account, so the endpoint can't be used to probe which emails are
// registered.
//
// Deploy: supabase functions deploy send-password-reset
// Secrets: the shared BREVO_API_KEY / MAIL_FROM_EMAIL (see send-mail).
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { esc, wrapEmail, sendMail, mailerConfigured } from '../_shared/mailer.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Account mail comes from plain "TBWC" on a no-reply address, not the shared
// default sender (jen@, which customers also see as "TBWC Accounting" on
// invoices). Overridable by secret.
const RESET_FROM = Deno.env.get('RESET_FROM') || '"TBWC" <noreply@tbwcinc.com>';

const DEFAULT_RESET_URL = 'https://tbwctechnology.com/reset-password.html';
const ALLOWED_RESET_ORIGINS = /^(https:\/\/(www\.)?tbwctechnology\.com|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

function resetPageUrl(redirectTo: unknown): URL {
  try {
    const url = new URL(typeof redirectTo === 'string' ? redirectTo : '');
    if (ALLOWED_RESET_ORIGINS.test(url.origin) && url.pathname.endsWith('/reset-password.html')) {
      return new URL(url.origin + url.pathname);
    }
  } catch { /* fall through */ }
  return new URL(DEFAULT_RESET_URL);
}

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

function resetEmail(f: { firstName: string; link: string }) {
  const greeting = f.firstName ? `Hi ${esc(f.firstName)}, we` : 'We';
  const body =
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4b4e57;">${greeting} received a request to reset the password for your TBWC Portal account.</p>` +
    `<p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#4b4e57;">Click below to choose a new password. If you didn't ask for this, you can ignore this email — your password won't change.</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#2f5bd6" style="border-radius:7px;">` +
    `<a href="${esc(f.link)}" target="_blank" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:7px;">Reset password</a>` +
    `</td></tr></table>` +
    `<p style="margin:28px 0 8px;font-size:13px;line-height:1.5;color:#7c7f89;">Or paste this link into your browser:</p>` +
    `<p style="margin:0;font-family:'Geist Mono',ui-monospace,SFMono-Regular,monospace;font-size:12px;line-height:1.5;word-break:break-all;color:#2f5bd6;">${esc(f.link)}</p>`;
  return {
    subject: 'Reset your TBWC Portal password',
    html: wrapEmail('Reset your TBWC Portal password.', 'Reset your password', body),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!mailerConfigured()) return json({ error: 'Server misconfigured' }, 500);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: linkData, error: linkError } = await sb.auth.admin.generateLink({ type: 'recovery', email });
  if (linkError || !linkData?.properties?.hashed_token || !linkData.user) {
    // Usually "no such user" — same answer as success, see header.
    console.log(`[send-password-reset] no link for ${email}: ${linkError?.message ?? 'no hashed_token'}`);
    return json({ success: true }, 200);
  }

  const link = resetPageUrl(body.redirectTo);
  link.searchParams.set('token_hash', linkData.properties.hashed_token);
  link.searchParams.set('type', 'recovery');

  const { data: profile } = await sb.from('users').select('first_name').eq('id', linkData.user.id).maybeSingle();

  try {
    const { subject, html } = resetEmail({
      firstName: profile?.first_name || '',
      link: link.href,
    });
    let info;
    try {
      info = await sendMail(email, subject, html, undefined, RESET_FROM);
    } catch (err) {
      // RESET_FROM not (yet) a validated Brevo sender — fall back to the
      // default sender rather than leave the user without their link.
      console.warn(`[send-password-reset] ${RESET_FROM} refused, using default sender:`, err instanceof Error ? err.message : err);
      info = await sendMail(email, subject, html);
    }
    console.log(`[send-password-reset] sent to ${email} — response=${info.response}`);
  } catch (err) {
    console.error('[send-password-reset] failed:', err instanceof Error ? err.stack ?? err.message : err);
    return json({ error: 'Could not send the reset email — try again shortly.' }, 500);
  }
  return json({ success: true }, 200);
});
