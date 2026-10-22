// FROZEN 2026-10-22 — schema.sql is history, not the live schema. Applying it
// would recreate users.is_admin / users.type and the RLS built on them, which
// the Synergy migrations (TBWC/api/migrations) deliberately dropped. Kept as a
// stub so `npm run db:schema` says so instead of silently rebuilding them.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

console.error(
  'db:schema is frozen: scripts/schema.sql is the retired rep-portal bootstrap.\n' +
  'Apply migrations from the Synergy repo instead:\n' +
  '  cd ../Synergy/TBWC/api && node scripts/apply-migration.cjs migrations/<file>.sql'
);
process.exit(1);

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
