// Creates public."order" table from the "2026 Orders" sheet in
// "TBWC & Dent Build List.xlsx" and inserts the first 20 data rows.
// Run with: node scripts/create-order-table.js
require('dotenv').config();
const xlsx = require('xlsx');
const { Client } = require('pg');

const XLSX_PATH = 'C:/Users/emil_/Downloads/TBWC & Dent Build List.xlsx';
const SHEET_NAME = '2026 Orders';
const ROW_COUNT = 20;

// [spreadsheet header, db column, type]
const COLUMNS = [
  ['CUSTOMERS', 'customer', 'text'],
  ['BUILD NOTES', 'build_notes', 'text'],
  ['EXP', 'exp', 'text'],
  ['INV STAT', 'inv_stat', 'text'],
  ['TBWC#', 'tbwc_number', 'text'],
  ['PO#', 'po_number', 'text'],
  ['RECIEVED', 'received_date', 'date'],
  ['SHIP NLT', 'ship_nlt', 'text'],
  ['SHIPMENT DATE', 'shipment_date', 'text'],
  ['REP', 'rep', 'text'],
  ['JOB NAME', 'job_name', 'text'],
  ['JAY', 'jay', 'text'],
  ['NOTES', 'notes', 'text'],
  ['DNC', 'dnc', 'numeric(12,2)'],
  ['SOLD FOR', 'sold_for', 'numeric(12,2)'],
  ['COMM 15%', 'comm_15', 'numeric(12,2)'],
  ['OVG 75/25', 'ovg_75_25', 'numeric(12,2)'],
  ['PROJ ADM', 'proj_adm', 'numeric(12,2)'],
  ['COMM TOTAL', 'comm_total', 'numeric(12,2)'],
  ['Trade Ally', 'trade_ally', 'text'],
  ['SU', 'su', 'text']
];

function parseMoney(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isNaN(n) ? null : n;
}

function parseDate(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [, mo, da, yr] = m;
  if (yr.length === 2) yr = '20' + yr;
  return `${yr}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}`;
}

async function main() {
  const wb = xlsx.readFile(XLSX_PATH);
  const sheet = wb.Sheets[SHEET_NAME];
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found`);
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
  const dataRows = rows.slice(1, 1 + ROW_COUNT);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const cols = COLUMNS.map(([, col]) => col);
  const insertSql = `insert into public."order" (${cols.join(', ')}) values (${cols.map((_, i) => '$' + (i + 1)).join(', ')})`;

  let inserted = 0;
  for (const row of dataRows) {
    const values = COLUMNS.map(([, col, type], i) => {
      const raw = row[i];
      if (type === 'date') return parseDate(raw);
      if (type.startsWith('numeric')) return parseMoney(raw);
      return raw === undefined ? null : raw;
    });
    await client.query(insertSql, values);
    inserted++;
  }
  console.log(`Inserted ${inserted} rows into public."order".`);

  await client.end();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
