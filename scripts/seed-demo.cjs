#!/usr/bin/env node
/**
 * Demo content for an empty platform: three clubs (each with a package,
 * guides and a profile) and a handful of upcoming hikes.
 *
 *   node scripts/seed-demo.cjs           # create (or re-create) the demo data
 *   node scripts/seed-demo.cjs --remove  # delete it again
 *
 * Every demo account uses an @highland.test address, so it is easy to spot
 * and to remove. Reads .env.local (needs SUPABASE_SERVICE_ROLE_KEY).
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const env = Object.fromEntries(
  fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const DOMAIN = '@highland.test';
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

const CLUBS = [
  {
    key: 'arcivner',
    name: 'Լեռնային Արծիվներ',
    phone: '+374 91 100200',
    tariff: 'advanced',
    focus: ['mountaineering', 'overnight', 'lakes'],
    description: 'Արշավներ ենք կազմակերպում 2015 թվականից։ Սիրում ենք բարձր գագաթներ, գիշերակացով երթուղիներ և լեռնային լճեր։ Մեր ուղեկցողները ունեն առաջին օգնության վկայականներ։',
    guides: [
      { first_name: 'Արամ Պետրոսյան', bio: 'Լեռնային ուղեկցող, 10 տարվա փորձ, Արագածի բոլոր գագաթները։' },
      { first_name: 'Անի Մելքոնյան', bio: 'Գիշերակացով արշավների կազմակերպիչ, լուսանկարիչ։' },
    ],
    tours: [
      { title: 'Արագածի հյուսիսային գագաթ', regions: ['aragatsotn'], terrains: ['mountains'], difficulty: 'hard', overnight: false, in: 9, price: 12000, max: 10, meeting_point: 'Երևան, Հանրապետության հրապարակ', meeting_time: '06:30' },
      { title: 'Ազատ լիճ և Գառնիի կիրճ', regions: ['ararat', 'kotayk'], terrains: ['lakes', 'gorges'], difficulty: 'easy', overnight: false, in: 16, price: 8000, max: 10, meeting_point: 'Կասկադ', meeting_time: '08:00' },
      { title: 'Քար լիճ և Աժդահակ', regions: ['gegharkunik'], terrains: ['mountains', 'lakes'], difficulty: 'medium', overnight: true, in: 23, price: 18000, max: 8, meeting_point: 'Կասկադ', meeting_time: '07:00' },
    ],
  },
  {
    key: 'tavush',
    name: 'Տավուշի Արահետներ',
    phone: '+374 93 300400',
    tariff: 'pro',
    focus: ['waterfalls', 'family', 'kids'],
    description: 'Տավուշի անտառներն ու ջրվեժները մեր սիրելի երթուղիներն են։ Կազմակերպում ենք ընտանեկան և հեշտ արշավներ՝ բոլոր տարիքի համար։',
    guides: [{ first_name: 'Դավիթ Հակոբյան', bio: 'Դիլիջանի ազգային պարկի ուղեկցող։' }],
    tours: [
      { title: 'Հաղարծին – Գոշավանք անտառային երթուղի', regions: ['tavush'], terrains: ['forest', 'heritage'], difficulty: 'easy', overnight: false, in: 12, price: 0, max: 20, meeting_point: 'Դիլիջան, կենտրոնական հրապարակ', meeting_time: '09:00' },
      { title: 'Մակարավանքի ջրվեժ', regions: ['tavush'], terrains: ['waterfalls', 'forest'], difficulty: 'medium', overnight: false, in: 19, price: 6000, max: 15, meeting_point: 'Իջևան', meeting_time: '09:30' },
    ],
  },
  {
    key: 'syunik',
    name: 'Սյունիքի Քարանձավագետներ',
    phone: '+374 77 500600',
    tariff: 'start',
    focus: ['caves', 'gorges'],
    description: 'Սյունիքի քարանձավներն ու կիրճերը՝ փոքր խմբերով և փորձառու ուղեկցողներով։',
    guides: [],
    tours: [
      { title: 'Խնձորեսկի հին քարանձավներ', regions: ['syunik'], terrains: ['caves', 'heritage'], difficulty: 'medium', overnight: false, in: 14, price: 5000, max: 5, meeting_point: 'Գորիս', meeting_time: '10:00' },
      { title: 'Որոտանի կիրճ', regions: ['syunik'], terrains: ['gorges'], difficulty: 'prof', overnight: true, in: 30, price: 15000, max: 5, meeting_point: 'Գորիս', meeting_time: '08:00' },
    ],
  },
];

async function removeDemo() {
  let removed = 0;
  for (let page = 1; ; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email?.endsWith(DOMAIN)) {
        await admin.auth.admin.deleteUser(u.id);
        removed++;
      }
    }
    if (users.length < 200) break;
  }
  return removed;
}

async function main() {
  const removed = await removeDemo();
  if (process.argv.includes('--remove')) {
    console.log(`Removed ${removed} demo accounts (their clubs and hikes went with them).`);
    return;
  }

  for (const c of CLUBS) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: `demo-${c.key}${DOMAIN}`,
      password: `Demo-${c.key}-2026!`,
      email_confirm: true,
      user_metadata: { role: 'club', club_name: c.name, phone: c.phone },
    });
    if (error) throw new Error(`${c.key}: ${error.message}`);
    const club = (await admin.from('clubs').select('id').eq('owner_id', created.user.id).single()).data;
    await admin.from('clubs').update({
      description: c.description, focus: c.focus, tariff: c.tariff, package_ends_at: inDays(30),
    }).eq('id', club.id);
    if (c.guides.length) {
      await admin.from('club_guides').insert(c.guides.map((g) => ({ ...g, last_name: '', club_id: club.id })));
    }
    const { error: tourError } = await admin.from('tours').insert(c.tours.map((x) => ({
      club_id: club.id, title: x.title, regions: x.regions, terrains: x.terrains, difficulty: x.difficulty,
      overnight: x.overnight, date: day(x.in), price: x.price, max_participants: x.max, status: 'active',
      coordinator_phone: c.phone, meeting_point: x.meeting_point, meeting_time: x.meeting_time,
      description: `${x.title}՝ ${c.name} ակումբի հետ։ Մանրամասները՝ կոորդինատորի մոտ։`,
      notes: 'Հարմարավետ կոշիկ, ջուր, գլխարկ, արևապաշտպան քսուք։',
    })));
    if (tourError) throw new Error(`${c.key} tours: ${tourError.message}`);
    console.log(`✓ ${c.name} (${c.tariff}) — ${c.tours.length} hikes`);
  }
  console.log('\nDemo club logins: demo-<arcivner|tavush|syunik>@highland.test / Demo-<key>-2026!');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
