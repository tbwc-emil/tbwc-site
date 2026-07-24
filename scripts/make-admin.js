// Grant (or list) admin rights. Runs as the postgres role, bypassing RLS.
// Admins get access to the browser admin page (admin.html) to approve reps.
//   node scripts/make-admin.js                 -> list current admins
//   node scripts/make-admin.js someone@x.com   -> make that rep an admin (also approves them)
require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const email = process.argv[2];
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  if (!email) {
    const res = await client.query(
      'select email from public.reps where is_admin order by email'
    );
    if (!res.rows.length) console.log('No admins yet.');
    res.rows.forEach((r) => console.log('[ADMIN] ' + r.email));
  } else {
    // Admins must also be approved so they can pass the sign-in gate.
    const res = await client.query(
      'update public.reps set is_admin = true, approved = true where email = $1 returning email',
      [email]
    );
    console.log(res.rowCount ? 'Admin granted: ' + res.rows[0].email : 'No rep with email ' + email);
  }
  await client.end();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
