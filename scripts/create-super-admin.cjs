#!/usr/bin/env node
/**
 * Create the platform's super admin (run once).
 *
 *   node scripts/create-super-admin.cjs <email> <second-email>
 *
 * Both addresses sign in to the same account with the same password. The
 * script prints a one-time password; the first sign-in at /login asks for a
 * new one. Regular admins are then created from /admin/admins.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

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

function oneTimePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(14), (b) => alphabet[b % alphabet.length]).join('');
}

async function main() {
  const [email, altEmail] = process.argv.slice(2).map((a) => a.trim().toLowerCase());
  const valid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');
  if (!valid(email) || !valid(altEmail) || email === altEmail) {
    console.error('Usage: node scripts/create-super-admin.cjs <email> <second-email>   (two different addresses)');
    process.exit(1);
  }

  const env = { ...readEnv(), ...process.env };
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existing = await db.from('admins').select('user_id').eq('is_super', true).limit(1);
  if (existing.error) throw new Error(existing.error.message + ' — are migrations 0027 and 0028 applied?');
  if (existing.data.length) {
    console.error('A super admin already exists. Remove it in the database first if you really want another one.');
    process.exit(1);
  }
  const taken = await db.from('profiles').select('id').in('email', [email, altEmail]).limit(1);
  if (taken.data && taken.data.length) {
    console.error('One of these addresses already belongs to an account on the platform. Use addresses that are not registered.');
    process.exit(1);
  }

  const password = oneTimePassword();
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw new Error(created.error.message);
  const id = created.data.user.id;

  const role = await db.from('profiles').update({ role: 'admin' }).eq('id', id);
  const row = role.error
    ? role
    : await db.from('admins').insert({ user_id: id, is_super: true, alt_email: altEmail, must_change_password: true });
  if (row.error) {
    await db.auth.admin.deleteUser(id);
    throw new Error(row.error.message);
  }
  await db.from('activity_log').delete().eq('actor_id', id).eq('action', 'account.created');

  console.log('Super admin created.');
  console.log('  Sign in at /login with either address:');
  console.log('    ' + email);
  console.log('    ' + altEmail);
  console.log('  One-time password: ' + password);
  console.log('  You will be asked to set your own password right after signing in.');
}

main().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
