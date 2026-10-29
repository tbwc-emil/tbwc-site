// Shared Brevo transport + branded email wrapper, used by every function that
// sends a rep-portal email (send-mail, submit-rep-lead) so all app mail — invites,
// reverification, lead notifications, order/invoice PDFs, AR collection notices —
// goes out through one codepath instead of partly through Supabase's own built-in
// auth mailer.
//
// Brevo's HTTP API (POST /v3/smtp/email), not SMTP: this runs on Deno Deploy, where
// one fetch beats a TCP+STARTTLS handshake per send, and the API answers with a
// messageId that ties a send to Brevo's own delivery/bounce log — the only way to
// answer a "never arrived" report. Replaced the previous SMTP transport 2026-10-29.
//
// Secrets (shared across functions):
//   supabase secrets set BREVO_API_KEY=xkeysib-...
//   supabase secrets set MAIL_FROM_EMAIL=... MAIL_FROM_NAME=...    (optional)
//
// The sender address MUST be one Brevo has validated (a confirmed entry under
// Senders) AND on a domain Brevo has authenticated, which are two separate things.
// A validated address on an unauthenticated domain still sends — but Brevo rewrites
// the From to <local>@<accountId>.brevosend.com, verified live 2026-10-29: a send
// as jen@tbwcinc.com went out as jen@12618087.brevosend.com. Authenticating the
// domain means DNS records (Brevo DKIM + brevo-code TXT) — nothing here can stand
// in for them. An SPF include alone does NOT authenticate a domain to Brevo.

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

// Envelope sender. Both parts are overridable by secret so the From can be
// repointed with `supabase secrets set` alone, no redeploy, while Brevo sender
// validation is being sorted out.
const FROM_EMAIL = Deno.env.get('MAIL_FROM_EMAIL');
const FROM_NAME = Deno.env.get('MAIL_FROM_NAME') || 'TBWC Technology';

export function mailerConfigured(): boolean {
  return !!(BREVO_API_KEY && FROM_EMAIL);
}

export function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

// The standard branded shell for app-generated mail: TBWC/Portal header bar, a
// heading, the caller’s body, and a footer rule.
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
<span style="font-family:'Geist Mono',ui-monospace,SFMono-Regular,monospace;font-size:11px;color:#7c7f89;text-transform:uppercase;letter-spacing:1.5px;margin-left:8px;">Portal</span>
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

/**
 * Bare centered shell for an email whose HTML is already fully branded by
 * its caller (the TBWC Worker's own order/invoice/AR-notice card — see
 * Synergy's pdf/documentEmail.ts) — just the cream background + a
 * max-width centering table, with none of wrapEmail()'s own "TBWC / PORTAL"
 * header bar, repeated-subject heading, or footer. Using wrapEmail() for
 * those would nest one branded card inside another.
 */
export function bareHtmlDocument(bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:24px 16px;background:#f2f1ee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f1ee;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td>${bodyHtml}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export interface MailAttachment {
  filename: string;
  contentBase64: string;
  contentType?: string;
}

interface Address {
  name?: string;
  email: string;
}

/**
 * Splits `"Display Name" <user@host>` into Brevo's separate {name, email} shape;
 * a bare address yields just {email}. SMTP took one combined header string, so
 * this keeps every existing caller's `from`/`replyTo` argument working unchanged.
 */
export function parseAddress(raw: string): Address {
  const m = raw.match(/^\s*(.*?)\s*<\s*([^<>\s]+)\s*>\s*$/);
  if (!m) return { email: raw.trim() };
  const name = m[1].replace(/^"(.*)"$/, '$1').trim();
  return name ? { name, email: m[2] } : { email: m[2] };
}

/**
 * Plain-text alternative for the HTML body. A message with no text/plain part
 * scores worse with spam filters, and the transport this replaced did not supply
 * one either, so every email this app has ever sent has been HTML-only. Not a renderer — it drops
 * the head, turns block boundaries into newlines and unescapes the handful of
 * entities esc() produces, which is all these templates contain.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<\/(p|div|tr|h[1-6]|table)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&copy;/g, '©')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** One address, or a comma/semicolon-separated list, to Brevo's array form. */
function splitList(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Resolves with Brevo's messageId in `response`, keeping the
 * {accepted, rejected, response} so callers' logging does not change. A resolved
 * promise means Brevo accepted the message for delivery, NOT that it reached the
 * inbox — feed `response` into Brevo's transactional log to settle that.
 *
 * `rejected` is always empty: Brevo fails the whole call rather than reporting
 * per-recipient rejections the way SMTP did.
 *
 * `from` overrides the default sender — e.g. documentEmail()'s "TBWC Accounting",
 * matching what QuickBooks Desktop itself sends invoices/orders as. Brevo's only
 * requirement is that the address is validated in its Senders list; but if the
 * address's domain is not authenticated in Brevo, Brevo rewrites the From to its
 * own brevosend.com subdomain rather than refusing the send. So check the delivery
 * log, not just the absence of an exception.
 */
export async function sendMail(
  to: string,
  subject: string,
  html: string,
  attachments?: MailAttachment[],
  from?: string,
  cc?: string,
  replyTo?: string
): Promise<{ accepted: string[]; rejected: string[]; response: string }> {
  if (!BREVO_API_KEY || !FROM_EMAIL) throw new Error('BREVO_API_KEY or sender address not configured');

  const recipients = splitList(to);
  if (recipients.length === 0) throw new Error('sendMail: no recipient');

  const payload: Record<string, unknown> = {
    sender: from ? parseAddress(from) : { name: FROM_NAME, email: FROM_EMAIL },
    to: recipients.map((email) => ({ email })),
    subject,
    htmlContent: html,
    textContent: htmlToText(html),
  };

  const ccList = splitList(cc ?? '');
  if (ccList.length > 0) payload.cc = ccList.map((email) => ({ email }));
  if (replyTo) payload.replyTo = parseAddress(replyTo);

  if (attachments && attachments.length > 0) {
    // Brevo takes {name, content} only — there is no contentType field. It infers
    // the MIME type from the filename extension and 400s the entire send for an
    // extension outside its allowlist, so `filename` must keep its real extension.
    // Callers screen the file first; see Synergy's fileEmail.ts.
    payload.attachment = attachments.map((a) => ({ name: a.filename, content: a.contentBase64 }));
  }

  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    // Brevo answers {code, message}; both matter. The ones to expect are
    // sender_not_valid (From not validated in Brevo) and invalid_parameter
    // (attachment extension or size).
    throw new Error(`Brevo send failed (${res.status}): ${text || res.statusText}`);
  }

  let messageId = '';
  try {
    messageId = (JSON.parse(text) as { messageId?: string }).messageId ?? '';
  } catch {
    // 2xx with an empty or non-JSON body — nothing to pull out, not an error.
  }
  return {
    accepted: recipients,
    rejected: [],
    response: messageId ? `brevo messageId=${messageId}` : `brevo ${res.status}`,
  };
}
