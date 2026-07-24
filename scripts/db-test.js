require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query('select now(), current_database()');
  console.log(res.rows[0]);
  await client.end();
}

main().catch((err) => {
  console.error('DB connection failed:', err.message);
  process.exit(1);
});
