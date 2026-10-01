#!/usr/bin/env node
/**
 * Run SQL against this project's Supabase database, without a DB password.
 *
 *   node scripts/run-sql.cjs supabase/migrations/0012_something.sql
 *   node scripts/run-sql.cjs -e "select count(*) from tours"
 *
 * Reads from .env.local:
 *   SUPABASE_ACCESS_TOKEN   personal access token (https://supabase.com/dashboard/account/tokens)
 *   SUPABASE_PROJECT_REF    optional; defaults to the host of NEXT_PUBLIC_SUPABASE_URL
 *
 * Uses the Management API endpoint POST /v1/projects/{ref}/database/query.
 * Never prints the token. .env.local is already gitignored.
 */
const fs = require('fs');
const path = require('path');

function readEnv() {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
  );
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/run-sql.cjs <migration.sql> | -e "<sql>"');
    process.exit(1);
  }

  // Shell environment wins over the file, so it is easy to test.
  const env = { ...readEnv(), ...process.env };
  const sql = arg === '-e' ? process.argv[3] : fs.readFileSync(arg, 'utf8');
  if (!sql) {
    console.error('No SQL to run.');
    process.exit(1);
  }

  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error(
      'SUPABASE_ACCESS_TOKEN is missing.\n' +
        'Add to .env.local:\n' +
        '  SUPABASE_ACCESS_TOKEN=sbp_...\n' +
        '(create it at https://supabase.com/dashboard/account/tokens)'
    );
    process.exit(2);
  }

  let ref = env.SUPABASE_PROJECT_REF;
  if (!ref) {
    const url = env.NEXT_PUBLIC_SUPABASE_URL || '';
    try {
      ref = new URL(url).hostname.split('.')[0];
    } catch {
      console.error('Cannot derive the project ref; set SUPABASE_PROJECT_REF in .env.local.');
      process.exit(2);
    }
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Request failed (${res.status})`);
    try {
      console.error(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.error(text);
    }
    process.exit(1);
  }

  try {
    const data = JSON.parse(text);
    console.log(JSON.stringify(data, null, 2));
  } catch {
    console.log(text);
  }
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
