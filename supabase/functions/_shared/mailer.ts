// Shared M365 SMTP transport + branded email wrapper, used by every function that
// sends a rep-portal email (send-mail, rep-signup) so all app mail — invites, lead
// notifications, signup confirmation — goes out through one codepath instead of
// partly through Supabase's own built-in auth mailer.
// Secrets (shared across functions): supabase secrets set SMTP_USER=... SMTP_PASS=... SMTP_FROM=...
import nodemailer from 'npm:nodemailer@^9';

const SMTP_USER = Deno.env.get('SMTP_USER');
const SMTP_PASS = Deno.env.get('SMTP_PASS');
const SMTP_FROM = Deno.env.get('SMTP_FROM') || SMTP_USER;

export function smtpConfigured(): boolean {
  return !!(SMTP_USER && SMTP_PASS);
}

export function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

// Same look as emails/confirm-signup.html (kept there as the original reference —
// this is now the version that actually sends).
export function wrapEmail(preheader: string, title: string, bodyHtml: string): string {
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

const transport = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false, // STARTTLS on 587, not implicit TLS
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  requireTLS: true,
});

export function sendMail(to: string, subject: string, html: string) {
  return new Promise<void>((resolve, reject) => {
    transport.sendMail(
      { from: `"TBWC Technology" <${SMTP_FROM}>`, to, subject, html },
      (err: Error | null) => (err ? reject(err) : resolve())
    );
  });
}
