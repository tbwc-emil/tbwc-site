// Creates the auth user and emails the signup-confirmation link ourselves, instead
// of calling supabase.auth.signUp() from the browser and letting Supabase's own
// mailer send it. That built-in mailer is a black box the app never sees — when it
// silently no-ops (e.g. a repeat signup on an already-confirmed email), the app has
// no way to know and shows a false "check your email" success. Routing through this
// function keeps every rep-portal email on one codepath (same as invite/lead-notify)
// with real success/failure signal.
//
// admin.generateLink({type:'signup'}) creates the user and returns the confirmation
// link WITHOUT sending anything — that's the one lever Supabase exposes for
// "give me the link, don't email it" — which is why this needs the service role key
// (Supabase injects it automatically into every edge function, no secret to set).
//
// Deploy: supabase functions deploy rep-signup
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

// Same copy as emails/confirm-signup.html (the file that used to be pasted into
// Supabase's dashboard template — no longer used now that this function sends it).
function confirmEmail(f: { firstName: string; link: string }) {
  const body =
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4b4e57;">Thanks for registering as a TBWC representative. Confirm your email address to activate your account.</p>` +
    `<p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#4b4e57;">Once confirmed, you can sign in right away.</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#2f5bd6" style="border-radius:7px;">` +
    `<a href="${esc(f.link)}" target="_blank" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:7px;">Confirm email address</a>` +
    `</td></tr></table>` +
    `<p style="margin:28px 0 8px;font-size:13px;line-height:1.5;color:#7c7f89;">Or paste this link into your browser:</p>` +
    `<p style="margin:0;font-family:'Geist Mono',ui-monospace,SFMono-Regular,monospace;font-size:12px;line-height:1.5;word-break:break-all;color:#2f5bd6;">${esc(f.link)}</p>`;
  return {
    subject: 'Confirm your email — TBWC Rep Portal',
    html: wrapEmail('Confirm your email to activate your TBWC Rep Portal account.', 'Confirm your email', body),
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

  const { email, password, redirectTo } = body;
  if (!email || !password || !redirectTo) return json({ error: 'Missing required fields' }, 400);

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data, error } = await sb.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: {
      redirectTo,
      data: {
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
      },
    },
  });

  // generateLink refuses to re-issue a signup link for an email that's already
  // confirmed — that refusal IS the "already registered" signal (an existing but
  // still-unconfirmed email instead gets its metadata/password updated and a fresh
  // link, same as a normal resend).
  if (error) return json({ error: 'This email is already registered and confirmed — sign in instead.' }, 400);

  // Build our own confirm link (routed through confirm-signup) instead of using
  // data.properties.action_link — that would point at Supabase's own hosted
  // /verify endpoint, whose post-confirm side effects (creating the users row,
  // consuming the invite lead) used to live in a DB trigger. Sending our own link
  // via hashed_token lets confirm-signup do that work in app code instead.
  const hashedToken = data?.properties?.hashed_token;
  if (!hashedToken) return json({ error: 'Sign-up failed — try again.' }, 500);
  const link =
    `${SUPABASE_URL}/functions/v1/confirm-signup?token_hash=${encodeURIComponent(hashedToken)}` +
    `&redirect_to=${encodeURIComponent(redirectTo)}`;

  try {
    const { subject, html } = confirmEmail({ firstName: body.firstName || '', link });
    await sendMail(email, subject, html);
  } catch (err) {
    return json({ error: 'Account created but the confirmation email failed to send — contact support.' }, 500);
  }

  return json({ success: true }, 200);
});
