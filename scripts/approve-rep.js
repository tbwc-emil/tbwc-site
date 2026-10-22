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
      // Who is a rep is their role (public.role_permission is the whole
      // permission model now) — users.type is gone.
      `select u.email, u.approved, u.created_at
         from public.users u
         join public.role r on r.role_id = u.role_id
        where r.code = 'rep'
        order by u.created_at desc`
    );
    if (!res.rows.length) console.log('No reps yet.');
    res.rows.forEach((r) =>
      console.log((r.approved ? '[OK]     ' : '[PENDING]') + ' ' + r.email)
    );
  } else {
    const res = await client.query(
      `update public.users u set approved = true
         where u.email = $1
           and u.role_id = (select role_id from public.role where code = 'rep' and tenant_id is null)
       returning u.email`,
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
