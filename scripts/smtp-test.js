// Verify Microsoft 365 SMTP creds authenticate + send, before wiring into Supabase.
//   node scripts/smtp-test.js you@wherever.com
// Reads from .env: SMTP_USER, SMTP_PASS, SMTP_FROM (defaults SMTP_FROM=SMTP_USER).
require('dotenv').config();
const nodemailer = require('nodemailer');

async function main() {
  const to = process.argv[2];
  if (!to) { console.error('Usage: node scripts/smtp-test.js recipient@example.com'); process.exit(1); }
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!user || !pass) { console.error('Set SMTP_USER and SMTP_PASS in .env'); process.exit(1); }

  const transport = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,            // STARTTLS on 587
    auth: { user: user, pass: pass },
    requireTLS: true
  });

  await transport.verify();
  console.log('AUTH OK — M365 accepted these credentials.');

  const info = await transport.sendMail({
    from: '"TBWC Technology" <' + from + '>',
    to: to,
    subject: 'TBWC SMTP test',
    text: 'If you can read this, Microsoft 365 SMTP works. Safe to paste these creds into Supabase.'
  });
  console.log('SENT — messageId:', info.messageId);
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
