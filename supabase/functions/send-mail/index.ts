// Sends the two rep-registration transactional emails via Microsoft 365 SMTP
// (creds verified locally first with scripts/smtp-test.js). Deploy:
//   supabase functions deploy send-mail
// Secrets:
//   supabase secrets set SMTP_USER=you@tbwcinc.com SMTP_PASS=... SMTP_FROM=you@tbwcinc.com
//   supabase secrets set ADMIN_NOTIFY_EMAIL=info@tbwcinc.com   (optional override; default below)
//
// One Supabase project backs both local dev and the live site, so the
// lead-notify recipient is picked from the caller's Origin instead of a
// per-environment secret: localhost/127.0.0.1 -> DEV_NOTIFY_EMAIL, anything
// else -> ADMIN_NOTIFY_EMAIL. Keeps test inquiries out of the real inbox.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { esc, wrapEmail, sendMail, smtpConfigured } from '../_shared/mailer.ts';

const ADMIN_NOTIFY_EMAIL = Deno.env.get('ADMIN_NOTIFY_EMAIL') || 'info@tbwcinc.com';
const DEV_NOTIFY_EMAIL = Deno.env.get('DEV_NOTIFY_EMAIL') || 'emil@tbwcinc.com';

function notifyRecipient(req: Request): string {
  const origin = req.headers.get('origin') || '';
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ? DEV_NOTIFY_EMAIL : ADMIN_NOTIFY_EMAIL;
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

function leadNotifyEmail(f: { firstName: string; lastName: string; email: string; phone: string; about: string }) {
  const row = (label: string, value: string) =>
    `<p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#4b4e57;"><strong style="color:#1b1d23;">${esc(label)}:</strong> ${esc(value) || '—'}</p>`;
  const body =
    row('Name', `${f.firstName} ${f.lastName}`) +
    row('Email', f.email) +
    row('Phone', f.phone) +
    `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#4b4e57;"><strong style="color:#1b1d23;">About:</strong><br>${esc(f.about).replace(/\n/g, '<br>') || '—'}</p>` +
    `<p style="margin:24px 0 0;font-size:13px;color:#7c7f89;">Review and approve in the admin portal.</p>`;
  return {
    subject: `New rep inquiry — ${f.firstName} ${f.lastName}`,
    html: wrapEmail('New Registration inquiry.', 'New Inquiry', body),
  };
}

function inviteEmail(f: { firstName: string; link: string }) {
  const body =
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4b4e57;">Hi ${esc(f.firstName)}, thanks for your interest in becoming a TBWC representative — we'd like to move forward.</p>` +
    `<p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#4b4e57;">Finish setting up your account with your agency details and a password.</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="#2f5bd6" style="border-radius:7px;">` +
    `<a href="${esc(f.link)}" target="_blank" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:7px;">Complete registration</a>` +
    `</td></tr></table>` +
    `<p style="margin:28px 0 8px;font-size:13px;line-height:1.5;color:#7c7f89;">Or paste this link into your browser:</p>` +
    `<p style="margin:0;font-family:'Geist Mono',ui-monospace,SFMono-Regular,monospace;font-size:12px;line-height:1.5;word-break:break-all;color:#2f5bd6;">${esc(f.link)}</p>`;
  return {
    subject: "You're invited — finish your TBWC Rep Portal registration",
    html: wrapEmail("You're invited to finish your TBWC Rep Portal registration.", "You're invited", body),
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

  try {
    if (body.type === 'lead-notify') {
      const { subject, html } = leadNotifyEmail(body);
      await sendMail(notifyRecipient(req), subject, html);
    } else if (body.type === 'invite') {
      if (!body.email || !body.link) return json({ error: 'Missing email or link' }, 400);
      const { subject, html } = inviteEmail(body);
      await sendMail(body.email, subject, html);
    } else {
      return json({ error: 'Unknown type' }, 400);
    }
    return json({ success: true }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Send failed' }, 500);
  }
});
