require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(sql);
  const res = await client.query(
    "select policyname from pg_policies where tablename = 'users' order by policyname"
  );
  console.log('users table ready. policies:', res.rows.map((r) => r.policyname).join(', '));
  await client.end();
}

main().catch((err) => {
  console.error('Schema apply failed:', err.message);
  process.exit(1);
});
