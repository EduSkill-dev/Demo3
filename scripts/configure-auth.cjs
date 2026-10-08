#!/usr/bin/env node
/**
 * Configure Supabase Auth for Highland through the Management API:
 *   * email confirmation ON (sign-up, email change, password reset)
 *   * Armenian email templates whose links come back to /auth/confirm with a
 *     token_hash, so they work in any browser or device (no PKCE cookie needed)
 *   * redirect allow-list: localhost on any port + NEXT_PUBLIC_SITE_URL
 *
 *   node scripts/configure-auth.cjs            # apply
 *   node scripts/configure-auth.cjs --smtp     # also send auth mail through Resend
 *   node scripts/configure-auth.cjs --gmail    # …or through a Gmail account (testing)
 *   node scripts/configure-auth.cjs --dry-run  # print what would change
 *
 * Reads SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL (and optionally
 * NEXT_PUBLIC_SITE_URL) from .env.local. Re-run after deploying to a new
 * domain so its links are allowed.
 */
const fs = require('fs');
const path = require('path');

const env = {
  ...Object.fromEntries(
    fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
  ),
  ...process.env,
};

const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const site = (env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

// Every email link lands on /auth/confirm (the app passes it as the
// redirect target); the route verifies token_hash and forwards the user.
const link = (type) => `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=${type}`;

function layout(title, body, button, href) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2a24">
  <p style="font-size:20px;font-weight:bold;color:#2b3d33;margin:0 0 16px">🏔️ Highland</p>
  <h2 style="font-size:18px;color:#2b3d33;margin:0 0 12px">${title}</h2>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px">${body}</p>
  <p style="margin:0 0 24px"><a href="${href}" style="display:inline-block;background:#e2792b;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">${button}</a></p>
  <p style="font-size:12px;color:#6b7280;line-height:1.5;margin:0">Եթե դուք չեք կատարել այս գործողությունը, պարզապես անտեսեք այս նամակը։ Հղումը գործում է 1 ժամ։</p>
</div>`;
}

const base = {
  mailer_autoconfirm: false,
  password_min_length: 8,
  site_url: site,
  // AUTH_EXTRA_URLS: other addresses the site answers on (comma-separated),
  // e.g. the host's own address next to the custom domain.
  uri_allow_list: [
    ...new Set([
      'http://localhost:*/**',
      `${site}/**`,
      ...(env.AUTH_EXTRA_URLS || '').split(',').map((u) => u.trim().replace(/\/$/, '')).filter(Boolean).map((u) => `${u}/**`),
    ]),
  ].join(','),
};

// Supabase lets free projects edit templates only with a custom SMTP sender.
const templates = {
  mailer_subjects_confirmation: 'Highland — հաստատեք Ձեր էլ. հասցեն',
  mailer_templates_confirmation_content: layout(
    'Գրեթե պատրաստ է',
    'Շնորհակալություն Highland-ում գրանցվելու համար։ Սեղմեք ստորև կոճակը՝ Ձեր էլ. հասցեն հաստատելու և գրանցումն ավարտելու համար։',
    'Հաստատել էլ. հասցեն',
    link('email')
  ),

  mailer_subjects_recovery: 'Highland — գաղտնաբառի վերականգնում',
  mailer_templates_recovery_content: layout(
    'Գաղտնաբառի վերականգնում',
    'Ստացել ենք Ձեր գաղտնաբառը վերականգնելու հայտ։ Սեղմեք ստորև կոճակը՝ նոր գաղտնաբառ սահմանելու համար։',
    'Սահմանել նոր գաղտնաբառ',
    link('recovery')
  ),

  mailer_subjects_email_change: 'Highland — հաստատեք նոր էլ. հասցեն',
  mailer_templates_email_change_content: layout(
    'Էլ. հասցեի փոփոխություն',
    'Սեղմեք ստորև կոճակը՝ {{ .NewEmail }} հասցեն որպես Ձեր նոր էլ. հասցե հաստատելու համար։',
    'Հաստատել նոր հասցեն',
    link('email_change')
  ),
};

// `--smtp` routes Supabase Auth mail through Resend (needs RESEND_API_KEY and
// a verified EMAIL_FROM domain): no hourly cap, and the Armenian templates
// above can be applied.
function smtpFromResend() {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error('--smtp needs RESEND_API_KEY and EMAIL_FROM in .env.local');
  const m = env.EMAIL_FROM.match(/^(.*)<(.+)>$/);
  return {
    smtp_host: 'smtp.resend.com',
    smtp_port: '465',
    smtp_user: 'resend',
    smtp_pass: env.RESEND_API_KEY,
    smtp_admin_email: (m ? m[2] : env.EMAIL_FROM).trim(),
    smtp_sender_name: (m ? m[1] : 'Highland').trim() || 'Highland',
    rate_limit_email_sent: 100,
  };
}

// `--gmail` is the stop-gap for testing before a domain exists: auth mail is
// sent from a Gmail account through an app password (Google account →
// Security → 2-Step Verification → App passwords). Gmail allows ~500/day.
function smtpFromGmail() {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    throw new Error('--gmail needs GMAIL_USER and GMAIL_APP_PASSWORD in .env.local');
  }
  return {
    smtp_host: 'smtp.gmail.com',
    smtp_port: '465',
    smtp_user: env.GMAIL_USER.trim(),
    smtp_pass: env.GMAIL_APP_PASSWORD.replace(/\s/g, ''),
    smtp_admin_email: env.GMAIL_USER.trim(),
    smtp_sender_name: 'Highland',
    rate_limit_email_sent: 60,
  };
}

async function main() {
  if (!env.SUPABASE_ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN is missing in .env.local');
  const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const headers = { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' };

  const current = await (await fetch(api, { headers })).json();
  const smtp = process.argv.includes('--smtp')
    ? smtpFromResend()
    : process.argv.includes('--gmail')
      ? smtpFromGmail()
      : {};
  const hasSmtp = !!(smtp.smtp_host || current.smtp_host);
  const config = { ...base, ...smtp, ...(hasSmtp ? templates : {}) };

  if (process.argv.includes('--dry-run')) {
    const shown = Object.fromEntries(Object.entries(config).map(([k, v]) => [k, /templates|pass/.test(k) ? '…' : v]));
    console.log(JSON.stringify(shown, null, 2));
    return;
  }
  const res = await fetch(api, { method: 'PATCH', headers, body: JSON.stringify(config) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
  console.log('Auth configured:', {
    mailer_autoconfirm: body.mailer_autoconfirm,
    site_url: body.site_url,
    uri_allow_list: body.uri_allow_list,
    smtp_host: body.smtp_host ?? '(Supabase default — about 2 emails/hour)',
    templates: hasSmtp ? 'Armenian templates applied' : 'default templates (needs SMTP: re-run with --smtp)',
  });
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
