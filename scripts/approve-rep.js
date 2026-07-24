// Approve (or list) reps. Runs as the postgres role, bypassing RLS.
//   node scripts/approve-rep.js                  -> list all reps + status
//   node scripts/approve-rep.js someone@x.com    -> approve that rep
require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const email = process.argv[2];
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  if (!email) {
    const res = await client.query(
      'select email, approved, created_at from public.reps order by created_at desc'
    );
    if (!res.rows.length) console.log('No reps yet.');
    res.rows.forEach((r) =>
      console.log((r.approved ? '[OK]     ' : '[PENDING]') + ' ' + r.email)
    );
  } else {
    const res = await client.query(
      'update public.reps set approved = true where email = $1 returning email',
      [email]
    );
    console.log(res.rowCount ? 'Approved: ' + res.rows[0].email : 'No rep with email ' + email);
  }
  await client.end();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
