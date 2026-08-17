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
import nodemailer from 'npm:nodemailer@^9';

const SMTP_USER = Deno.env.get('SMTP_USER');
const SMTP_PASS = Deno.env.get('SMTP_PASS');
const SMTP_FROM = Deno.env.get('SMTP_FROM') || SMTP_USER;
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

function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

// Shared branded wrapper — same look as emails/confirm-signup.html.
function wrapEmail(preheader: string, title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#f2f1ee;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f1ee;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fbfaf7;border:1px solid #e2e2e6;border-radius:10px;overflow:hidden;font-family:'Geist',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #e2e2e6;">
<span style="font-size:20px;font-weight:700;letter-spacing:0.5px;color:#1b1d23;">TBWC</span>
<span style="font-family:'Geist Mono',ui-monospace,SFMono-Regular,monospace;font-size:11px;color:#7c7f89;text-transform:uppercase;letter-spacing:1.5px;margin-left:8px;">Rep Portal</span>
</td></tr>
<tr><td style="padding:32px;">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:600;color:#1b1d23;">${esc(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #e2e2e6;background:#f7f6f2;">
<p style="margin:0;font-size:12px;color:#a2a4ac;">&copy; TBWC Technology</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
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

// Same shape as scripts/smtp-test.js, already verified against these M365 creds.
const transport = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false, // STARTTLS on 587, not implicit TLS
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  requireTLS: true,
});

function sendMail(to: string, subject: string, html: string) {
  return new Promise<void>((resolve, reject) => {
    transport.sendMail(
      { from: `"TBWC Technology" <${SMTP_FROM}>`, to, subject, html },
      (err: Error | null) => (err ? reject(err) : resolve())
    );
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!SMTP_USER || !SMTP_PASS) return json({ error: 'Server misconfigured' }, 500);

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
