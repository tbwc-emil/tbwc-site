// One-time backfill: point every existing order at Emil Guirguis's rep row
// (the only rep that existed when the orders.rep_id column was added).
// Run with: node scripts/backfill-order-rep.js
require('dotenv').config();
const { Client } = require('pg');

const REP_EMAIL = 'emilguirguis@yahoo.com';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const rep = await client.query('select id from public.users where email = $1', [REP_EMAIL]);
  if (!rep.rows.length) throw new Error(`No rep found with email ${REP_EMAIL}`);
  const repId = rep.rows[0].id;

  const res = await client.query(
    'update public."order" set rep_id = $1 where rep_id is null',
    [repId]
  );
  console.log(`Backfilled ${res.rowCount} order(s) to rep ${REP_EMAIL} (${repId}).`);

  await client.end();
}

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
