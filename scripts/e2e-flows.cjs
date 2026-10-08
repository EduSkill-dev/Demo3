#!/usr/bin/env node
/**
 * End-to-end flow tests against the live Supabase project.
 *
 *   node scripts/e2e-flows.cjs
 *
 * Creates throwaway accounts (individuals + two clubs), exercises the real
 * flows — packages, sign-up, favorites, booking, the 48-hour rule, ratings,
 * notifications, listing limits, applicant visibility, guides, payments —
 * asserts each one, then deletes everything it created. Safe to re-run;
 * exits non-zero if any assertion fails.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY for setup/cleanup and for the writes the
 * API routes make; every permission check runs through the anon key exactly
 * like a browser would.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { spawn } = require('child_process');

const envFile = path.join(process.cwd(), '.env.local');
const env = Object.fromEntries(
  fs
    .readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
// A second anon client that never signs in: "what does a visitor see?"
const visitor = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// The default cookie name @supabase/ssr uses is sb-{projectRef}-auth-token,
// derived from the project sub-domain of the Supabase URL.
const PROJECT_REF = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const AUTH_COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`;
let DEV_PORT = 3999;

// Dates relative to today, so the suite never ages into "tour already happened".
function future(days) {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().slice(0, 10);
}
const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString();

// Ask the OS for a free port instead of killing whatever holds a fixed one.
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = require('net').createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// Stop the dev server and every worker it spawned (Windows needs taskkill /T).
function stopDevServer(proc) {
  if (!proc || proc.exitCode !== null) return;
  if (process.platform === 'win32') {
    try { require('child_process').execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch { /* already gone */ }
  } else {
    proc.kill('SIGTERM');
  }
}

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'OK  ' : 'FAIL'} | ${name}${extra ? ' -> ' + extra : ''}`);
}
const stamp = Date.now();
const email = (who) => `e2e-${who}-${stamp}@example.com`;
const PASSWORD = 'E2eTest!2345';

let devServer = null;

// Convert a Supabase session into an sb-auth-token cookie value that
// @supabase/ssr's createServerClient will read (base64url(JSON(session))).
function sessionToCookie(session) {
  const encoded = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${AUTH_COOKIE_NAME}=base64-${encoded}`;
}

// Minimal HTTP POST helper for the Next.js API routes.
async function api(route, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`http://localhost:${DEV_PORT}${route}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, body: json, raw: text };
}

// Sign in through the site's own route; the cookie is what a browser would hold.
async function loginCookie(address, password) {
  const res = await fetch(`http://localhost:${DEV_PORT}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: address, password }),
  });
  const body = await res.json().catch(() => ({}));
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  return { status: res.status, body, cookie };
}

// Wait until the dev server responds or give up.
async function waitForServer(ms) {
  const start = Date.now();
  for (;;) {
    try {
      await fetch(`http://localhost:${DEV_PORT}`);
      return true;
    } catch {
      if (Date.now() - start > ms) throw new Error('server did not start');
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

async function makeUser(who, user_metadata, confirmed = true) {
  const r = await admin.auth.admin.createUser({
    email: email(who),
    password: PASSWORD,
    email_confirm: confirmed,
    user_metadata,
  });
  if (r.error) throw new Error(`createUser ${who}: ` + r.error.message);
  return r.data.user.id;
}

async function signIn(who) {
  await anon.auth.signOut({ scope: 'local' });
  const r = await anon.auth.signInWithPassword({ email: email(who), password: PASSWORD });
  if (r.error) throw new Error(`signIn ${who}: ` + r.error.message);
}

// A separate client per cookie: signing the shared client out (even with
// scope 'local') ends that session on the server, which would invalidate a
// cookie built from it earlier.
async function cookieFor(who) {
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const r = await c.auth.signInWithPassword({ email: email(who), password: PASSWORD });
  if (r.error) throw new Error(`cookieFor ${who}: ` + r.error.message);
  return sessionToCookie(r.data.session);
}

// What a successful payment would do: the server sets package + expiry.
async function givePackage(clubId, tariff, days = 30) {
  const r = await admin.from('clubs').update({ tariff, package_ends_at: inDays(days) }).eq('id', clubId);
  if (r.error) throw new Error('givePackage: ' + r.error.message);
}

function tourRow(clubId, overrides = {}) {
  return {
    club_id: clubId, title: 'E2E Tour', regions: ['kotayk'], terrains: ['mountains'],
    date: future(78), max_participants: 4, difficulty: 'easy', overnight: false,
    coordinator_phone: '+374 55 123456',
    ...overrides,
  };
}

const bookingStatus = async (id) => (await admin.from('bookings').select('status').eq('id', id).single()).data?.status;

async function main() {
  const ids = {};
  let newTourId = null;
  try {
    // ---------- packages: catalog.ts and the packages table agree ----------
    const catalogSrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/catalog.ts'), 'utf8');
    const dbPackages = (await admin.from('packages').select('*')).data || [];
    for (const id of ['start', 'advanced', 'pro']) {
      const m = catalogSrc.match(new RegExp(`${id}: \\{[^}]*maxListings: (\\d+), maxPerTour: (\\d+), priceAmd: (\\d+)`));
      const row = dbPackages.find((p) => p.id === id);
      const same = m && row && +m[1] === row.max_listings && +m[2] === row.max_per_tour && +m[3] === row.price_amd;
      check(`package ${id}: catalog.ts matches the packages table`, same,
        `ts=${m ? m.slice(1).join('/') : 'missing'} db=${row ? [row.max_listings, row.max_per_tour, row.price_amd].join('/') : 'missing'}`);
    }

    // ---------- accounts ----------
    ids.ind = await makeUser('ind', {
      role: 'individual', first_name: 'Աննա', last_name: 'Երկրորդ', birth_date: '1996-05-14', gender: 'female', phone: '+374 91 000001',
    });
    ids.ind2 = await makeUser('ind2', {
      role: 'individual', first_name: 'Պետրոս', last_name: 'Երկրորդ', age: '31', gender: 'male',
    });
    ids.ind3 = await makeUser('ind3', { role: 'individual', first_name: 'Չհաստատված' }, false);
    ids.club = await makeUser('club', { role: 'club', club_name: 'E2E Club A', tariff: 'advanced' });
    ids.club2 = await makeUser('club2', { role: 'club', club_name: 'E2E Club B', phone: '+374 10 000002' });

    const profile = await admin.from('profiles').select('role, first_name, birth_date, phone').eq('id', ids.ind).single();
    check('signup stores name, birth date and phone',
      profile.data?.role === 'individual' && profile.data?.first_name === 'Աննա' && profile.data?.birth_date === '1996-05-14' && profile.data?.phone === '+374 91 000001',
      JSON.stringify(profile.data));
    const club2Phone = (await admin.from('clubs').select('phone').eq('owner_id', ids.club2).single()).data?.phone;
    check('club signup stores the phone', club2Phone === '+374 10 000002', String(club2Phone));

    const directSub = await visitor.from('newsletter_subscribers').insert({ email: `e2e-direct-${stamp}@example.com` });
    check('a browser cannot write the newsletter list directly', !!directSub.error, directSub.error ? directSub.error.code : 'ALLOWED');

    const clubRow = await admin.from('clubs').select('id, tariff, package_ends_at').eq('owner_id', ids.club).single();
    check('a new club starts without a package (metadata tariff ignored)',
      clubRow.data?.tariff === null && clubRow.data?.package_ends_at === null, JSON.stringify(clubRow.data));
    const clubA = clubRow.data.id;
    const clubB = (await admin.from('clubs').select('id').eq('owner_id', ids.club2).single()).data.id;

    // ---------- publishing needs a package ----------
    await signIn('club');
    const noPkg = await anon.from('tours').insert(tourRow(clubA, { title: 'E2E No package' }));
    check('a club without a package cannot publish', !!noPkg.error, noPkg.error ? noPkg.error.message : 'ALLOWED');

    await givePackage(clubA, 'advanced');
    await givePackage(clubB, 'start');

    const tourA = await anon.from('tours').insert(tourRow(clubA, { meeting_point: 'Կասկադ', meeting_time: '07:00' }))
      .select('id, meeting_time, status, terrains').single();
    check('club publishes a tour (active, with terrains and meeting time)',
      !tourA.error && tourA.data?.status === 'active' && tourA.data?.terrains?.[0] === 'mountains' && tourA.data?.meeting_time?.startsWith('07:00'),
      tourA.error ? tourA.error.message : JSON.stringify(tourA.data));
    if (tourA.error) throw new Error('cannot continue without a tour: ' + tourA.error.message);
    const tourId = tourA.data.id;

    // ---------- favorites + booking ----------
    await signIn('ind');
    const fav = await anon.from('favorite_clubs').insert({ user_id: ids.ind, club_id: clubB });
    check('individual can favorite a club', !fav.error, fav.error ? fav.error.message : '');

    const seats0 = await anon.rpc('seats_taken', { p_tour: tourId });
    check('seats start at 0', seats0.data === 0, String(seats0.data));

    // Browsers may not write bookings; /api/bookings does it with the service role.
    const directBook = await anon.from('bookings').insert({ tour_id: tourId, user_id: ids.ind, status: 'confirmed' });
    check('a browser cannot insert a booking directly', !!directBook.error, directBook.error ? directBook.error.code : 'ALLOWED');
    const forgedPayment = await anon.from('payments').insert({ user_id: ids.ind, kind: 'booking', tour_id: tourId, amount: 5000, status: 'succeeded' });
    check('a browser cannot record its own payment', !!forgedPayment.error, forgedPayment.error ? forgedPayment.error.code : 'ALLOWED');

    const book = await admin.from('bookings').insert({ tour_id: tourId, user_id: ids.ind, status: 'confirmed' }).select('id, seq').single();
    check('server books the tour (seq 1)', !book.error && book.data?.seq === 1, book.error ? book.error.message : JSON.stringify(book.data));
    const seats1 = await anon.rpc('seats_taken', { p_tour: tourId });
    check('seat counter increments', seats1.data === 1, String(seats1.data));

    const dup = await admin.from('bookings').insert({ tour_id: tourId, user_id: ids.ind, status: 'confirmed' });
    check('duplicate booking is rejected', !!dup.error, dup.error ? dup.error.code : 'ALLOWED');

    const book2 = await admin.from('bookings').insert({ tour_id: tourId, user_id: ids.ind2, status: 'confirmed' }).select('id, seq').single();
    check('second application gets seq 2', book2.data?.seq === 2, JSON.stringify(book2.error ?? book2.data));

    const unconfirmed = await admin.from('bookings').insert({ tour_id: tourId, user_id: ids.ind3, status: 'confirmed' });
    check('an unconfirmed email cannot book', !!unconfirmed.error, unconfirmed.error ? unconfirmed.error.message : 'ALLOWED');

    // ---------- ratings only after the tour ----------
    const early = await anon.from('ratings').insert({ user_id: ids.ind, tour_id: tourId, score: 5, comment: 'Դեռ չեմ գնացել' });
    check('rating a tour before it happens is rejected', !!early.error, early.error ? early.error.code : 'ALLOWED');

    const pastTour = (await admin.from('tours').insert(tourRow(clubA, { title: 'E2E Past Tour', date: future(5) })).select('id').single()).data;
    await admin.from('bookings').insert({ tour_id: pastTour.id, user_id: ids.ind, status: 'confirmed' });
    await admin.from('tours').update({ date: future(-1) }).eq('id', pastTour.id);

    const rate = await anon.from('ratings').insert({ user_id: ids.ind, tour_id: pastTour.id, score: 5, comment: 'Գեղեցիկ էր։' });
    check('attendee rates a tour after it happened', !rate.error, rate.error ? rate.error.message : '');
    const rateDup = await anon.from('ratings').insert({ user_id: ids.ind, tour_id: pastTour.id, score: 1, comment: 'Կրկնակի' });
    check('second rating on the same tour is rejected', rateDup.error?.code === '23505', rateDup.error ? rateDup.error.code : 'ALLOWED');
    const clubRate = await anon.from('ratings').insert({ user_id: ids.ind, club_id: clubA, score: 4, comment: 'Լավ ակումբ։' });
    check('attendee rates the club they went out with', !clubRate.error, clubRate.error ? clubRate.error.message : '');
    const wrongClub = await anon.from('ratings').insert({ user_id: ids.ind, club_id: clubB, score: 1, comment: 'Առանց մասնակցության' });
    check('rating a club you never went out with is rejected', !!wrongClub.error, wrongClub.error ? wrongClub.error.code : 'ALLOWED');

    await signIn('ind2');
    const noBookingRate = await anon.from('ratings').insert({ user_id: ids.ind2, tour_id: pastTour.id, score: 1, comment: 'Չեմ մասնակցել' });
    check('non-attendee rating is rejected', noBookingRate.error?.code === '42501', noBookingRate.error ? noBookingRate.error.code : 'ALLOWED');

    const saveProfile = await anon.from('profiles').update({ phone: '+374 55 111111' }).eq('id', ids.ind2);
    check('saving profile.phone works', !saveProfile.error, saveProfile.error ? saveProfile.error.message : '');

    // ---------- capacity, hidden tours ----------
    const zeroTour = (await admin.from('tours').insert(tourRow(clubA, { title: 'E2E Full Tour', date: future(79), max_participants: 0 })).select('id').single()).data;
    const full = await admin.from('bookings').insert({ tour_id: zeroTour.id, user_id: ids.ind2, status: 'confirmed' });
    check('booking a tour with no seats left is rejected', !!full.error, full.error ? full.error.message : 'ALLOWED');

    const hidden = (await admin.from('tours').insert(tourRow(clubA, { title: 'E2E Hidden', date: future(80), status: 'hidden' })).select('id').single()).data;
    const seenHidden = await visitor.from('tours').select('id').eq('id', hidden.id);
    check('a visitor cannot see a hidden tour', (seenHidden.data || []).length === 0, `rows=${(seenHidden.data || []).length}`);
    const bookHidden = await admin.from('bookings').insert({ tour_id: hidden.id, user_id: ids.ind2, status: 'confirmed' });
    check('a hidden tour cannot be booked', !!bookHidden.error, bookHidden.error ? bookHidden.error.message : 'ALLOWED');

    // ---------- listing limits (club A, Advanced = 5 upcoming active+hidden) ----------
    await signIn('club');
    const upcoming = async () => (await admin.from('tours').select('id', { count: 'exact', head: true })
      .eq('club_id', clubA).in('status', ['active', 'hidden']).gte('date', future(0))).count ?? 0;
    const beforeCount = await upcoming();
    let created = 0;
    for (let i = 0; i < 5; i++) {
      const r = await anon.from('tours').insert(tourRow(clubA, { title: `E2E Limited ${i}`, date: future(90 + i), max_participants: 5 }));
      if (!r.error) created++;
    }
    check('Advanced club stops exactly at 5 upcoming listings (past ones do not count)',
      beforeCount + created === 5, `before=${beforeCount} created=${created}`);
    const over = await anon.from('tours').insert(tourRow(clubA, { title: 'E2E Over limit', date: future(120) }));
    check('the next listing past the cap is rejected', !!over.error, over.error ? over.error.message : 'ALLOWED');

    await admin.from('clubs').update({ tariff: 'start' }).eq('id', clubA);
    const afterDowngrade = await anon.from('tours').insert(tourRow(clubA, { title: 'E2E After downgrade', date: future(150) }));
    check('START club with 5 listings cannot add more', !!afterDowngrade.error, afterDowngrade.error ? afterDowngrade.error.message : 'ALLOWED');
    await admin.from('clubs').update({ tariff: 'advanced' }).eq('id', clubA);

    // ---------- an expired package closes bookings and publishing ----------
    await admin.from('clubs').update({ package_ends_at: inDays(-1) }).eq('id', clubA);
    await admin.from('bookings').delete().eq('tour_id', tourId).eq('user_id', ids.ind2);
    const expiredBook = await admin.from('bookings').insert({ tour_id: tourId, user_id: ids.ind2, status: 'confirmed' });
    check('an expired package closes new bookings', !!expiredBook.error, expiredBook.error ? expiredBook.error.message : 'ALLOWED');
    const expiredPublish = await anon.from('tours').insert(tourRow(clubA, { title: 'E2E Expired', date: future(160) }));
    check('an expired package blocks publishing', !!expiredPublish.error, expiredPublish.error ? expiredPublish.error.message : 'ALLOWED');
    await givePackage(clubA, 'advanced');
    const ind2Booking = (await admin.from('bookings').insert({ tour_id: tourId, user_id: ids.ind2, status: 'confirmed' }).select('id, seq').single()).data;
    check('re-applying after a renewal works (next free seq)', ind2Booking?.seq === 2, JSON.stringify(ind2Booking));

    // ---------- applicants: visibility and read tracking ----------
    const ownApplicants = await anon.from('bookings')
      .select('id, seq, read_at, profiles(first_name, last_name, email)')
      .eq('tour_id', tourId).order('seq');
    const rows = ownApplicants.data || [];
    const embedded = Array.isArray(rows[0]?.profiles) ? rows[0].profiles[0] : rows[0]?.profiles;
    check('club sees its applicants with profile data and seq', rows.length >= 2 && embedded?.first_name === 'Աննա' && rows[0].seq === 1,
      JSON.stringify(rows[0] ?? null));
    check('new applications start unread', rows.every((r) => r.read_at === null), JSON.stringify(rows.map((r) => r.read_at)));

    const infoSave = await anon.from('clubs').update({
      description: 'E2E նկարագրություն՝ ստեղծված թեստի կողմից։',
      focus: ['mountaineering', 'overnight'],
      phone: '+374 10 111111',
    }).eq('id', clubA);
    check('club saves its description and orientation', !infoSave.error, infoSave.error ? infoSave.error.message : '');

    await signIn('club2');
    await anon.rpc('mark_booking_read', { p_booking: book.data.id });
    const stillUnread = (await admin.from('bookings').select('read_at').eq('id', book.data.id).single()).data?.read_at;
    check('another club cannot mark the application read', stillUnread === null, String(stillUnread));
    const otherApplicants = await anon.from('bookings').select('id').eq('tour_id', tourId);
    check('another club sees no applicants for that tour', (otherApplicants.data || []).length === 0, `rows=${(otherApplicants.data || []).length}`);

    await signIn('club');
    const markRead = await anon.rpc('mark_booking_read', { p_booking: book.data.id });
    const readAt = (await admin.from('bookings').select('read_at').eq('id', book.data.id).single()).data?.read_at;
    check('the owning club marks an application read', !markRead.error && !!readAt, markRead.error ? markRead.error.message : String(readAt));

    const clubRatings = await anon.from('ratings').select('id').or(`tour_id.eq.${pastTour.id},club_id.eq.${clubA}`);
    check('club sees the ratings left on its tours and on itself', (clubRatings.data || []).length >= 2, `rows=${(clubRatings.data || []).length}`);

    // ---------- clubs cannot book; nobody forges packages or ownership ----------
    const clubBooking = await admin.from('bookings').insert({ tour_id: tourId, user_id: ids.club2, status: 'confirmed' });
    check('a club account cannot book a tour', !!clubBooking.error, clubBooking.error ? clubBooking.error.message : 'ALLOWED');

    await signIn('club2');
    const tariffEscalation = await anon.from('clubs').update({ tariff: 'pro' }).eq('id', clubB);
    const freeExtension = await anon.from('clubs').update({ package_ends_at: inDays(365) }).eq('id', clubB);
    const clubBRow = (await admin.from('clubs').select('tariff, package_ends_at').eq('id', clubB).single()).data;
    check('a club cannot change its own package or expiry',
      !!tariffEscalation.error && !!freeExtension.error && clubBRow?.tariff === 'start' && new Date(clubBRow.package_ends_at) < new Date(inDays(31)),
      `${tariffEscalation.error?.code}/${freeExtension.error?.code} | ${JSON.stringify(clubBRow)}`);

    await anon.from('clubs').update({ name: 'Hijacked' }).eq('id', clubA);
    const clubAName = (await admin.from('clubs').select('name').eq('id', clubA).single()).data?.name;
    check('a club cannot edit someone else s club', clubAName === 'E2E Club A', `name=${clubAName}`);

    const guide = await anon.from('club_guides').insert({ club_id: clubB, first_name: 'Մարի', last_name: 'Ուղեկցող' }).select('id').single();
    check('club adds a guide', !guide.error, guide.error ? guide.error.message : '');
    const guideDelete = await anon.from('club_guides').delete().eq('id', guide.data?.id ?? '');
    check('club deletes a guide', !guideDelete.error, guideDelete.error ? guideDelete.error.message : '');

    await signIn('ind2');
    const roleEscalation = await anon.from('profiles').update({ role: 'club' }).eq('id', ids.ind2);
    const roleAfter = (await admin.from('profiles').select('role').eq('id', ids.ind2).single()).data?.role;
    check('an individual cannot flip their role to club', !!roleEscalation.error && roleAfter === 'individual',
      (roleEscalation.error ? roleEscalation.error.code : 'ALLOWED') + ` | role=${roleAfter}`);
    const fakeClub = await anon.from('clubs').insert({ owner_id: ids.ind2, name: 'Fake Club' });
    check('an individual cannot create a club', !!fakeClub.error, fakeClub.error ? fakeClub.error.code : 'ALLOWED');
    const foreignGuide = await anon.from('club_guides').insert({ club_id: clubB, first_name: 'Չ', last_name: 'Կա' });
    check('a stranger cannot add a guide to another club', !!foreignGuide.error, foreignGuide.error ? foreignGuide.error.code : 'ALLOWED');

    // ---------- notifications ----------
    await anon.from('favorite_clubs').insert({ user_id: ids.ind2, club_id: clubB });
    await signIn('club2');
    const newTour = await anon.from('tours').insert(tourRow(clubB, { title: 'E2E Notified Tour', date: future(180) })).select('id').single();
    check('publishing while someone follows you works', !newTour.error && !!newTour.data?.id, newTour.error ? newTour.error.message : '');
    newTourId = newTour.data?.id ?? null;

    await signIn('ind2');
    const notes = await anon.from('notifications').select('id, read').eq('user_id', ids.ind2);
    check('the follower receives the notification', (notes.data || []).length >= 1, JSON.stringify(notes.data));
    const mark = await anon.from('notifications').update({ read: true }).eq('user_id', ids.ind2).eq('read', false);
    check('the owner can mark notifications read', !mark.error, mark.error ? mark.error.message : '');

    // ---------- booking changes: only the server, only outside 48 h ----------
    await anon.from('bookings').update({ status: 'cancelled' }).eq('id', ind2Booking.id);
    check('a browser cannot change a booking directly', (await bookingStatus(ind2Booking.id)) === 'confirmed');

    await admin.from('bookings').update({ status: 'cancelled' }).eq('id', ind2Booking.id);
    await signIn('club');
    await anon.from('bookings').update({ status: 'confirmed' }).eq('id', ind2Booking.id);
    check('a club cannot restore a cancelled booking', (await bookingStatus(ind2Booking.id)) === 'cancelled');
    const cancelledAt = (await admin.from('bookings').select('cancelled_at').eq('id', ind2Booking.id).single()).data?.cancelled_at;
    check('cancelling stamps cancelled_at', !!cancelledAt, String(cancelledAt));

    // Free a slot under club A's cap (the limit tests filled it).
    await admin.from('tours').delete().eq('club_id', clubA).like('title', 'E2E Limited%');
    // Cancelling the whole tour tells everyone still signed up.
    const cancelTourRes = await anon.from('tours').update({ status: 'cancelled' }).eq('id', tourId);
    const cancelNote = (await admin.from('notifications').select('kind').eq('user_id', ids.ind).eq('tour_id', tourId).eq('kind', 'tour_cancelled')).data || [];
    check('cancelling a tour notifies its participants', !cancelTourRes.error && cancelNote.length === 1, JSON.stringify(cancelTourRes.error ?? cancelNote));
    await admin.from('tours').update({ status: 'active' }).eq('id', tourId);

    const soonTour = (await admin.from('tours').insert(tourRow(clubA, { title: 'E2E Tomorrow', date: future(1) })).select('id').single()).data;
    const soonBooking = (await admin.from('bookings').insert({ tour_id: soonTour.id, user_id: ids.ind2, status: 'confirmed' }).select('id').single()).data;
    const lateCancel = await admin.from('bookings').update({ status: 'cancelled' }).eq('id', soonBooking.id);
    check('cancelling less than 48 h before is rejected', !!lateCancel.error && (await bookingStatus(soonBooking.id)) === 'confirmed',
      lateCancel.error ? lateCancel.error.message : 'ALLOWED');

    const publicClub = await visitor.from('clubs').select('description, focus, phone').eq('id', clubA).single();
    check('the public club page reads the saved info',
      publicClub.data?.description?.startsWith('E2E նկարագրություն') && publicClub.data?.focus?.includes('overnight') && publicClub.data?.phone === '+374 10 111111',
      JSON.stringify(publicClub.data));

    // ---------- Phase 3: tours with participants, notices, unread cancellations ----------
    await signIn('club');
    const bookedDelete = await anon.from('tours').delete().eq('id', tourId).select('id');
    const stillThere = (await admin.from('tours').select('id').eq('id', tourId)).data?.length === 1;
    check('a tour with participants cannot be deleted', !!bookedDelete.error && stillThere,
      bookedDelete.error ? bookedDelete.error.message : 'ALLOWED');

    const moved = await anon.from('tours').update({ meeting_time: '08:30' }).eq('id', tourId);
    const changeNote = (await admin.from('notifications').select('kind, message').eq('user_id', ids.ind).eq('tour_id', tourId).eq('kind', 'tour_changed')).data || [];
    check('changing the meeting time notifies participants', !moved.error && changeNote.length === 1, JSON.stringify(moved.error ?? changeNote));

    const guideBio = await anon.from('club_guides').insert({ club_id: clubA, first_name: 'Արամ Գիդյան', bio: 'Լեռնային ուղեկցող 10 տարի' }).select('id, bio').single();
    check('club adds a guide with a short bio', !guideBio.error && guideBio.data?.bio?.startsWith('Լեռնային'), guideBio.error ? guideBio.error.message : '');

    await admin.from('bookings').update({ read_at: new Date().toISOString() }).eq('id', book.data.id);
    const cancelSoonOk = await admin.from('bookings').update({ status: 'cancelled' }).eq('id', book.data.id).select('read_at').single();
    check('a cancelled application turns unread for the club', !cancelSoonOk.error && cancelSoonOk.data?.read_at === null,
      JSON.stringify(cancelSoonOk.error ?? cancelSoonOk.data));
    await admin.from('bookings').update({ status: 'confirmed' }).eq('id', book.data.id);

    /* ---------- HTTP route tests (payments + email + announce) ---------- */
    // Make room under club A's cap for the HTTP fixtures.
    await admin.from('tours').delete().eq('club_id', clubA).not('id', 'in', `(${tourId},${soonTour.id})`);

    DEV_PORT = await freePort();
    const nextJs = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
    devServer = spawn(process.execPath, [nextJs, 'dev', '--port', String(DEV_PORT)], {
      stdio: 'pipe',
      env: { ...process.env, ...env, CRON_SECRET: 'e2e-cron-secret', EMAIL_DISABLED: '1', NEXT_DIST_DIR: '.next-e2e' },
      shell: false,
    });
    devServer.on('error', (err) => console.error('     dev server error:', err.message));
    devServer.stdout.on('data', (d) => console.log('     dev:', d.toString().split('\n').filter(Boolean).slice(-1)[0] || ''));
    devServer.stderr.on('data', (d) => console.log('     dev:err:', d.toString().split('\n').filter(Boolean).slice(-1)[0] || ''));

    let serverReady = false;
    try {
      await waitForServer(90000);
      serverReady = true;
    } catch (e2) {
      console.log('     dev server did not start, skipping HTTP tests:', e2.message);
      results.push({ name: 'dev server started', ok: false });
    }

    if (serverReady) {
      const freeTour = (await admin.from('tours').insert(tourRow(clubA, { title: 'E2E HTTP Free', date: future(81), max_participants: 10, meeting_time: '09:00', price: 0 })).select('id').single()).data;
      const paidTour = (await admin.from('tours').insert(tourRow(clubA, { title: 'E2E HTTP Paid', date: future(82), max_participants: 10, meeting_time: '09:00', price: 5000 })).select('id').single()).data;
      check('HTTP setup: free and paid tours created', !!freeTour?.id && !!paidTour?.id);

      const indCookie = await cookieFor('ind');

      const bookRes = await api('/api/bookings', { tour_id: freeTour.id }, indCookie);
      check('HTTP /api/bookings: free booking ok + email skipped',
        bookRes.status === 200 && bookRes.body.ok === true && bookRes.body.email === 'skipped',
        `status=${bookRes.status} body=${JSON.stringify(bookRes.body)}`);

      const cancelRes = await api('/api/bookings', { action: 'cancel', booking_id: bookRes.body?.booking?.id }, indCookie);
      check('HTTP /api/bookings: cancel ok + email skipped',
        cancelRes.status === 200 && cancelRes.body.ok === true && cancelRes.body.email === 'skipped',
        `status=${cancelRes.status} body=${JSON.stringify(cancelRes.body)}`);

      const freeRide = await api('/api/bookings', { tour_id: paidTour.id }, indCookie);
      check('HTTP /api/bookings: paid tour requires payment (402)', freeRide.status === 402,
        `status=${freeRide.status} body=${JSON.stringify(freeRide.body)}`);

      const declineRes = await api('/api/payments/charge', {
        kind: 'booking', tour_id: paidTour.id, card: { number: '4000000000000002', exp: '12/28', cvc: '123' },
      }, indCookie);
      check('HTTP /api/payments/charge: 4000…002 card declined',
        declineRes.status === 200 && declineRes.body.status === 'declined', `status=${declineRes.status} body=${JSON.stringify(declineRes.body)}`);

      const chargeOk = await api('/api/payments/charge', {
        kind: 'booking', tour_id: paidTour.id, card: { number: '4242424242424242', exp: '12/28', cvc: '123' },
      }, indCookie);
      check('HTTP /api/payments/charge: 4242 card succeeds (booking)',
        chargeOk.status === 200 && chargeOk.body.status === 'succeeded' && chargeOk.body.email === 'skipped',
        `status=${chargeOk.status} body=${JSON.stringify(chargeOk.body)}`);

      const ind2Cookie = await cookieFor('ind2');
      const lateRes = await api('/api/bookings', { action: 'cancel', booking_id: soonBooking.id }, ind2Cookie);
      check('HTTP /api/bookings: cancel within 48 h is refused (409)', lateRes.status === 409,
        `status=${lateRes.status} body=${JSON.stringify(lateRes.body)}`);

      // Packages for club B (START active, about a month left).
      const club2Cookie = await cookieFor('club2');
      const card = { number: '4242424242424242', exp: '12/28', cvc: '123' };

      const startAgain = await api('/api/payments/charge', { kind: 'subscription', tariff: 'start' }, club2Cookie);
      check('HTTP packages: extending more than 7 days early is refused', startAgain.status === 409,
        `status=${startAgain.status} body=${JSON.stringify(startAgain.body)}`);

      const upgrade = await api('/api/payments/charge', { kind: 'subscription', tariff: 'advanced', card }, club2Cookie);
      const afterUpgrade = (await admin.from('clubs').select('tariff, package_ends_at').eq('id', clubB).single()).data;
      const monthAhead = Math.abs(new Date(afterUpgrade.package_ends_at) - new Date(new Date().setMonth(new Date().getMonth() + 1))) < 3600e3;
      check('HTTP packages: upgrade to Advanced starts a new month now',
        upgrade.status === 200 && upgrade.body.status === 'succeeded' && afterUpgrade.tariff === 'advanced' && monthAhead,
        `status=${upgrade.status} body=${JSON.stringify(upgrade.body)} club=${JSON.stringify(afterUpgrade)}`);

      const receipt = (await admin.from('payments').select('amount, period_start, period_end').eq('id', upgrade.body.payment_id).single()).data;
      check('HTTP packages: the payment records amount and period',
        Number(receipt?.amount) === 20000 && !!receipt?.period_start && !!receipt?.period_end, JSON.stringify(receipt));

      const downgrade = await api('/api/payments/charge', { kind: 'subscription', tariff: 'start' }, club2Cookie);
      check('HTTP packages: downgrading mid-period is refused', downgrade.status === 409,
        `status=${downgrade.status} body=${JSON.stringify(downgrade.body)}`);

      const oldEnd = inDays(3);
      await admin.from('clubs').update({ package_ends_at: oldEnd }).eq('id', clubB);
      const extend = await api('/api/payments/charge', { kind: 'subscription', tariff: 'advanced', card }, club2Cookie);
      const expected = new Date(oldEnd); expected.setMonth(expected.getMonth() + 1);
      const afterExtend = (await admin.from('clubs').select('package_ends_at').eq('id', clubB).single()).data;
      check('HTTP packages: extend adds a month to the old end date',
        extend.status === 200 && Math.abs(new Date(afterExtend.package_ends_at) - expected) < 60e3,
        `status=${extend.status} ends=${afterExtend?.package_ends_at} expected=${expected.toISOString()}`);

      const announceRes = await api('/api/tours/announce', { tour_id: newTourId }, club2Cookie);
      check('HTTP /api/tours/announce: emails followers (skipped without key)',
        announceRes.status === 200 && announceRes.body.ok === true && announceRes.body.skipped >= 1,
        `status=${announceRes.status} body=${JSON.stringify(announceRes.body)}`);

      // ---------- Phase 2: newsletter, suggestions, auth links, middleware ----------
      const subEmail = `e2e-news-${stamp}@example.com`;
      const sub = await api('/api/newsletter', { email: subEmail });
      const subRow = (await admin.from('newsletter_subscribers').select('token, confirmed_at').eq('email', subEmail).single()).data;
      check('HTTP newsletter: subscribing stores an unconfirmed address', sub.status === 200 && subRow && !subRow.confirmed_at,
        `status=${sub.status} row=${JSON.stringify(subRow)}`);
      const page = async (route, cookie) => (await fetch(`http://localhost:${DEV_PORT}${route}`, { headers: cookie ? { Cookie: cookie } : {} })).text();
      await page(`/newsletter/confirm?token=${subRow?.token}`);
      const confirmedRow = (await admin.from('newsletter_subscribers').select('confirmed_at').eq('email', subEmail).single()).data;
      check('HTTP newsletter: the emailed link confirms it', !!confirmedRow?.confirmed_at, JSON.stringify(confirmedRow));
      await page(`/newsletter/unsubscribe?token=${subRow?.token}`);
      const unsubRow = (await admin.from('newsletter_subscribers').select('unsubscribed_at').eq('email', subEmail).single()).data;
      check('HTTP newsletter: the unsubscribe link works', !!unsubRow?.unsubscribed_at, JSON.stringify(unsubRow));
      await admin.from('newsletter_subscribers').delete().eq('email', subEmail);

      const phoneOnly = await api('/api/contact', { message: 'E2E առաջարկ', phone: '+374 99 000000' });
      const withEmail = await api('/api/contact', { message: `E2E առաջարկ ${stamp}`, email: `e2e-msg-${stamp}@example.com` });
      const msgRow = (await admin.from('contact_messages').select('token, confirmed_at').eq('message', `E2E առաջարկ ${stamp}`).single()).data;
      check('HTTP suggestions: an email is required and the message waits for confirmation',
        phoneOnly.status === 400 && withEmail.status === 200 && msgRow && !msgRow.confirmed_at,
        `phoneOnly=${phoneOnly.status} withEmail=${withEmail.status} row=${JSON.stringify(msgRow)}`);
      await page(`/contact/confirm?token=${msgRow?.token}`);
      const msgConfirmed = (await admin.from('contact_messages').select('confirmed_at').eq('message', `E2E առաջարկ ${stamp}`).single()).data;
      check('HTTP suggestions: the emailed link delivers the message', !!msgConfirmed?.confirmed_at, JSON.stringify(msgConfirmed));
      await admin.from('contact_messages').delete().eq('message', `E2E առաջարկ ${stamp}`);

      const noFollow = (route, cookie) => fetch(`http://localhost:${DEV_PORT}${route}`, { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} });
      const bare = await noFollow('/auth/confirm');
      check('HTTP auth: a link without a token is rejected', (bare.headers.get('location') || '').includes('status=invalid'), bare.headers.get('location'));

      const signupEmail = `e2e-signup-${stamp}@example.com`;
      const gen = await admin.auth.admin.generateLink({ type: 'signup', email: signupEmail, password: 'E2eTest!2345', options: { data: { role: 'individual', first_name: 'Նոր' } } });
      ids.signup = gen.data?.user?.id;
      const confirmRes = await noFollow(`/auth/confirm?token_hash=${gen.data?.properties?.hashed_token}&type=email`);
      const confirmedUser = (await admin.auth.admin.getUserById(ids.signup)).data?.user;
      check('HTTP auth: the confirmation link confirms the email and signs in',
        (confirmRes.headers.get('location') || '').endsWith('/auth/confirmed') && !!confirmedUser?.email_confirmed_at && (confirmRes.headers.get('set-cookie') || '').includes(AUTH_COOKIE_NAME),
        `location=${confirmRes.headers.get('location')} confirmed=${confirmedUser?.email_confirmed_at}`);

      const rec = await admin.auth.admin.generateLink({ type: 'recovery', email: email('ind') });
      const recRes = await noFollow(`/auth/recover?token_hash=${rec.data?.properties?.hashed_token}&type=recovery`);
      check('HTTP auth: the reset link opens the new-password page', (recRes.headers.get('location') || '').endsWith('/auth/reset-password'),
        recRes.headers.get('location'));

      const wrongDash = await noFollow('/dashboard', indCookie);
      const wrongAccount = await noFollow('/account', club2Cookie);
      const anonDash = await noFollow('/dashboard/packages');
      check('HTTP middleware: each role is sent to its own dashboard',
        (wrongDash.headers.get('location') || '').endsWith('/account') && (wrongAccount.headers.get('location') || '').endsWith('/dashboard') &&
          (anonDash.headers.get('location') || '').includes('/login?next=%2Fdashboard%2Fpackages'),
        `${wrongDash.headers.get('location')} | ${wrongAccount.headers.get('location')} | ${anonDash.headers.get('location')}`);

      // ---------- Phase 4: receipts, notifications, account deletion ----------
      const receiptOwn = await noFollow(`/receipts/${chargeOk.body.payment_id}`, indCookie);
      const receiptOther = await noFollow(`/receipts/${chargeOk.body.payment_id}`, ind2Cookie);
      check('HTTP receipts: the payer sees their receipt, nobody else does',
        receiptOwn.status === 200 && receiptOther.status === 404, `own=${receiptOwn.status} other=${receiptOther.status}`);

      await signIn('ind2');
      const myNotes = (await anon.from('notifications').select('id').eq('user_id', ids.ind2)).data || [];
      const delNote = myNotes[0] ? await anon.from('notifications').delete().eq('id', myNotes[0].id) : { error: { message: 'no notification' } };
      const leftNote = myNotes[0] ? (await admin.from('notifications').select('id').eq('id', myNotes[0].id)).data?.length : 1;
      check('a person can delete their own notification', !delNote.error && leftNote === 0, JSON.stringify(delNote.error));

      ids.leaver = await makeUser('leaver', { role: 'individual', first_name: 'Հեռացող', last_name: 'Օգտատեր', phone: '+374 99 111111' });
      const leaverBooking = (await admin.from('bookings').insert({ tour_id: soonTour.id, user_id: ids.leaver, status: 'confirmed' }).select('id').single()).data;
      const leaverCookie = await cookieFor('leaver');
      const delRes = await api('/api/delete-account', null, leaverCookie);
      const afterDelete = (await admin.from('bookings').select('user_id, status').eq('id', leaverBooking?.id).single()).data;
      const goneUser = (await admin.auth.admin.getUserById(ids.leaver)).data?.user;
      check('deleting an account cancels upcoming bookings (even inside 48 h) and keeps the row',
        delRes.status === 200 && afterDelete?.status === 'cancelled' && afterDelete?.user_id === null && !goneUser,
        `status=${delRes.status} body=${JSON.stringify(delRes.body)} booking=${JSON.stringify(afterDelete)}`);
      if (!goneUser) ids.leaver = null; else ids.leaver = null;

      // Removed some other way (dashboard / admin API): the seat is freed too.
      const ghost = await makeUser('ghost', { role: 'individual', first_name: 'Ուրվական' });
      const ghostBooking = (await admin.from('bookings').insert({ tour_id: soonTour.id, user_id: ghost, status: 'confirmed' }).select('id').single()).data;
      await admin.auth.admin.deleteUser(ghost);
      const ghostRow = (await admin.from('bookings').select('status, user_id').eq('id', ghostBooking?.id).single()).data;
      check('an account deleted outside the app frees its seat', ghostRow?.status === 'cancelled' && ghostRow?.user_id === null,
        JSON.stringify(ghostRow));

      const clubDelete = await api('/api/delete-account', null, club2Cookie);
      check('a club account cannot delete itself with one click', clubDelete.status === 403, `status=${clubDelete.status}`);

      // ---------- Admin area ----------
      ids.super = await makeUser('super', {});
      await admin.from('profiles').update({ role: 'admin' }).eq('id', ids.super);
      await admin.from('admins').insert({ user_id: ids.super, is_super: true, alt_email: email('superalt'), must_change_password: false });
      // As scripts/create-super-admin.cjs does: the sign-up trigger logged it as an individual.
      await admin.from('activity_log').delete().eq('actor_id', ids.super).eq('action', 'account.created');

      const superLogin = await loginCookie(email('superalt'), PASSWORD);
      const loginLog = (await admin.from('activity_log').select('actor_role, meta').eq('actor_id', ids.super).eq('action', 'auth.login')).data || [];
      check('admin: signs in with the second address, and the sign-in is logged',
        superLogin.status === 200 && superLogin.body.target === '/admin' && loginLog.length === 1 && loginLog[0].actor_role === 'super',
        `status=${superLogin.status} body=${JSON.stringify(superLogin.body)} log=${JSON.stringify(loginLog)}`);
      const superCookie = superLogin.cookie;
      const act = (body, cookie) => api('/api/admin', body, cookie);

      const outsider = await act({ action: 'account.setStatus', userId: ids.ind2, status: 'frozen' }, indCookie);
      check('admin: an ordinary account cannot call the admin API', outsider.status === 401, `status=${outsider.status}`);

      const made = await act({ action: 'admin.create', email: email('adm'), perms: ['individuals'] }, superCookie);
      ids.adm = (await admin.from('profiles').select('id').eq('email', email('adm')).maybeSingle()).data?.id;
      check('admin: the super admin creates an admin with a one-time password',
        made.status === 200 && typeof made.body.password === 'string' && !!ids.adm, `status=${made.status} body=${JSON.stringify(made.body).replace(/"password":"[^"]*"/, '"password":"…"')}`);

      const admFirst = await loginCookie(email('adm'), made.body.password);
      const early = await act({ action: 'account.setStatus', userId: ids.ind2, status: 'frozen' }, admFirst.cookie);
      const changed = await act({ action: 'password.change', password: 'E2e-admin-pass-1' }, admFirst.cookie);
      check('admin: the one-time password opens nothing until it is replaced',
        admFirst.status === 200 && early.status === 403 && changed.status === 200,
        `login=${admFirst.status} early=${early.status} change=${changed.status} ${JSON.stringify(changed.body)}`);
      const admCookie = (await loginCookie(email('adm'), 'E2e-admin-pass-1')).cookie;

      const overClub = await act({ action: 'account.setStatus', userId: ids.club2, status: 'frozen' }, admCookie);
      const overTour = await act({ action: 'tour.setHidden', tourId, hidden: true }, admCookie);
      const overText = await act({ action: 'text.save', locale: 'hy', entries: [{ key: 'home.heroTitle', value: 'x' }] }, admCookie);
      const overAdmin = await act({ action: 'admin.create', email: email('adm2'), perms: [] }, admCookie);
      check('admin: a regular admin can do only what was ticked',
        overClub.status === 403 && overTour.status === 403 && overText.status === 403 && overAdmin.status === 403,
        `club=${overClub.status} tour=${overTour.status} text=${overText.status} admin=${overAdmin.status}`);

      const froze = await act({ action: 'account.setStatus', userId: ids.ind2, status: 'frozen' }, admCookie);
      const frozenBook = await api('/api/bookings', { tour_id: tourId }, ind2Cookie);
      await signIn('ind2');
      const frozenEdit = await anon.from('profiles').update({ first_name: 'Սառած' }).eq('id', ids.ind2).select('id');
      const frozenDelete = await api('/api/delete-account', null, ind2Cookie);
      check('admin: a frozen account can sign in but not act (not even delete itself)',
        froze.status === 200 && frozenBook.status === 403 && !!frozenEdit.error && frozenDelete.status === 403,
        `freeze=${froze.status} book=${frozenBook.status} edit=${frozenEdit.error ? 'refused' : 'ALLOWED'} delete=${frozenDelete.status}`);

      const blocked = await act({ action: 'account.setStatus', userId: ids.ind2, status: 'blocked' }, admCookie);
      const blockedLogin = await loginCookie(email('ind2'), PASSWORD);
      const reopened = await act({ action: 'account.setStatus', userId: ids.ind2, status: 'active' }, admCookie);
      const reopenedLogin = await loginCookie(email('ind2'), PASSWORD);
      check('admin: a blocked account cannot sign in until it is re-activated',
        blocked.status === 200 && blockedLogin.status !== 200 && reopened.status === 200 && reopenedLogin.status === 200,
        `block=${blocked.status} login=${blockedLogin.status} ${JSON.stringify(blockedLogin.body)} reopen=${reopened.status} login=${reopenedLogin.status}`);

      const closeTour = await act({ action: 'tour.setHidden', tourId, hidden: true }, superCookie);
      const closedSeen = (await visitor.from('tours').select('id').eq('id', tourId)).data || [];
      await signIn('club');
      const clubUndo = await anon.from('tours').update({ admin_hidden: false }).eq('id', tourId).select('admin_hidden');
      const stillClosed = (await admin.from('tours').select('admin_hidden').eq('id', tourId).single()).data?.admin_hidden;
      const openTour = await act({ action: 'tour.setHidden', tourId, hidden: false }, superCookie);
      const openSeen = (await visitor.from('tours').select('id').eq('id', tourId)).data || [];
      check('admin: a closed listing leaves the site and the club cannot reopen it',
        closeTour.status === 200 && closedSeen.length === 0 && stillClosed === true && openTour.status === 200 && openSeen.length === 1,
        `close=${closeTour.status} seen=${closedSeen.length} clubUndo=${JSON.stringify(clubUndo.data)} still=${stillClosed} open=${openTour.status} seen=${openSeen.length}`);

      // ---------- One phone per account, one club per name ----------
      const taken = await api('/api/auth/check-signup', { phone: '010 000002', clubName: '  e2e   CLUB b ' });
      const free = await api('/api/auth/check-signup', { phone: '+374 77 ' + String(stamp).slice(-6), clubName: `E2E Free ${stamp}` });
      const dupUser = await admin.auth.admin.createUser({ email: email('dup'), password: PASSWORD, email_confirm: true, user_metadata: { role: 'individual', first_name: 'Կրկնակ', phone: '+374 10 000002' } });
      if (dupUser.data?.user) ids.dup = dupUser.data.user.id;
      await signIn('club');
      const stealName = await anon.from('clubs').update({ name: 'E2E club B' }).eq('id', clubA).select('name');
      const stealPhone = await anon.from('clubs').update({ phone: '37410000002' }).eq('id', clubA).select('phone');
      check('sign-up: a registered phone (in any format) and a taken club name (any case) are refused',
        taken.body.phoneTaken === true && taken.body.nameTaken === true && free.body.phoneTaken === false && free.body.nameTaken === false
          && !!dupUser.error && !!stealName.error && !!stealPhone.error,
        `taken=${JSON.stringify(taken.body)} free=${JSON.stringify(free.body)} dup=${dupUser.error ? 'refused' : 'CREATED'} name=${stealName.error ? 'refused' : 'ALLOWED'} phone=${stealPhone.error ? 'refused' : 'ALLOWED'}`);

      // ---------- Custom requests and offers ----------
      const rq = (body, cookie) => api('/api/requests', body, cookie);
      const clubCookie = await cookieFor('club');
      const sightId = (await admin.from('sights').select('id').limit(1).single()).data.id;
      const wish = { action: 'create', people: 4, dateFrom: future(20), dateTo: future(25), regions: ['tavush'], terrains: ['forest'], sightIds: [sightId], overnight: true, budget: 15000 };
      const withPhone = await rq({ ...wish, note: 'Զանգեք 099 12 34 56' }, indCookie);
      const withMail = await rq({ ...wish, note: 'գրեք me@example.com' }, indCookie);
      const created = await rq({ ...wish, note: 'Երեխաներով ենք, 15.11.2026-ը հարմար է' }, indCookie);
      const byClub = await rq(wish, clubCookie);
      const requestId = created.body.id;
      check('requests: an individual posts one; contact details in the text are refused; clubs cannot post',
        withPhone.status === 400 && withMail.status === 400 && created.status === 200 && !!requestId && byClub.status === 403,
        `phone=${withPhone.status} mail=${withMail.status} ok=${created.status} ${JSON.stringify(created.body)} club=${byClub.status}`);

      const seenByVisitor = (await visitor.from('tour_requests').select('id').eq('id', requestId)).data || [];
      await signIn('ind2');
      const seenByOther = (await anon.from('tour_requests').select('id').eq('id', requestId)).data || [];
      const forged = await anon.from('tour_requests').insert({ user_id: ids.ind2, people: 2, date_from: future(5), date_to: future(5), regions: ['lori'] });
      await signIn('club');
      const seenByClub = (await anon.from('tour_requests').select('id, author_name').eq('id', requestId)).data || [];
      check('requests: clubs see open requests; visitors and other individuals do not; nothing is written from a browser',
        seenByVisitor.length === 0 && seenByOther.length === 0 && seenByClub.length === 1 && !!forged.error,
        `visitor=${seenByVisitor.length} other=${seenByOther.length} club=${seenByClub.length} forged=${forged.error ? 'refused' : 'ALLOWED'}`);

      const offered = await rq({ action: 'offer', requestId, price: 12000, date: future(21), message: 'Լաստիվեր, տրանսպորտը ներառված է' }, clubCookie);
      const offerRow = (await admin.from('tour_offers').select('id, status, price').eq('request_id', requestId).single()).data;
      const told = (await admin.from('notifications').select('id').eq('user_id', ids.ind).eq('kind', 'platform').like('message', '%անհատական պատվերին%')).data || [];
      const notOwner = await rq({ action: 'accept', offerId: offerRow?.id }, (await loginCookie(email('ind2'), PASSWORD)).cookie);
      const accepted = await rq({ action: 'accept', offerId: offerRow?.id }, indCookie);
      const again = await rq({ action: 'accept', offerId: offerRow?.id }, indCookie);
      const after = (await admin.from('tour_requests').select('status, tour_offers(status)').eq('id', requestId).single()).data;
      const lateOffer = await rq({ action: 'offer', requestId, price: 9000, date: future(21) }, clubCookie);
      check('requests: a club offers, the author is told and accepts once; the request closes',
        offered.status === 200 && offerRow?.status === 'pending' && told.length === 1 && notOwner.status === 404 && accepted.status === 200
          && again.status === 409 && after?.status === 'accepted' && after?.tour_offers?.[0]?.status === 'accepted' && lateOffer.status === 409,
        `offer=${offered.status} ${JSON.stringify(offered.body)} told=${told.length} notOwner=${notOwner.status} accept=${accepted.status} again=${again.status} after=${JSON.stringify(after)} late=${lateOffer.status}`);
      await admin.from('tour_requests').delete().eq('id', requestId);

      // The club sets a cancel window per hike (24 / 36 / 48 / 60 hours). Noon two
      // days ahead is always 32-56 hours away: inside a 60 h window, outside a 24 h one.
      const midTour = (await admin.from('tours').insert(tourRow(clubA, { title: 'E2E Day After', date: future(2), meeting_time: '12:00' })).select('id').single()).data;
      const midBooking = (await admin.from('bookings').insert({ tour_id: midTour.id, user_id: ids.ind, status: 'confirmed' }).select('id').single()).data;
      await signIn('club');
      const badHours = await anon.from('tours').update({ cancel_hours: 30 }).eq('id', midTour.id).select('cancel_hours');
      const set60 = await anon.from('tours').update({ cancel_hours: 60 }).eq('id', midTour.id).select('cancel_hours');
      const late60 = await api('/api/bookings', { action: 'cancel', booking_id: midBooking.id }, indCookie);
      const set24 = await anon.from('tours').update({ cancel_hours: 24 }).eq('id', midTour.id).select('cancel_hours');
      const ok24 = await api('/api/bookings', { action: 'cancel', booking_id: midBooking.id }, indCookie);
      await admin.from('tours').delete().eq('id', midTour.id);
      check('the cancel window is set per hike: 60 h refuses what 24 h allows',
        !!badHours.error && set60.data?.[0]?.cancel_hours === 60 && late60.status >= 400 && set24.data?.[0]?.cancel_hours === 24 && ok24.status === 200,
        `bad=${badHours.error ? 'refused' : 'ALLOWED'} 60h=${late60.status} ${JSON.stringify(late60.body)} 24h=${ok24.status} ${JSON.stringify(ok24.body)}`);

      // Single functions forced off: the account works, that one thing does not.
      const noPost = await act({ action: 'account.setLimit', userId: ids.club, limit: 'post', blocked: true }, superCookie);
      const noReceive = await act({ action: 'account.setLimit', userId: ids.club, limit: 'receive', blocked: true }, superCookie);
      await signIn('club');
      const refusedPost = await anon.from('tours').insert(tourRow(clubA, { title: 'E2E Not Allowed', date: future(70) })).select('id');
      const selfUnblock = await anon.from('clubs').update({ posting_blocked: false, applications_blocked: false }).eq('id', clubA).select('posting_blocked');
      const editOwn = await anon.from('tours').update({ notes: 'still editable' }).eq('id', tourId).select('id');
      const refusedApply = await admin.from('bookings').insert({ tour_id: soonTour.id, user_id: ids.ind, status: 'confirmed' });
      const wrongKind = await act({ action: 'account.setLimit', userId: ids.club, limit: 'book', blocked: true }, superCookie);
      await act({ action: 'account.setLimit', userId: ids.club, limit: 'post', blocked: false }, superCookie);
      await act({ action: 'account.setLimit', userId: ids.club, limit: 'receive', blocked: false }, superCookie);
      check('admin: a club can lose new listings and new applications, and cannot switch them back itself',
        noPost.status === 200 && noReceive.status === 200 && !!refusedPost.error && selfUnblock.data?.[0]?.posting_blocked === true
          && (editOwn.data || []).length === 1 && /ակումբի արշավներին/.test(refusedApply.error?.message || '') && wrongKind.status === 400,
        `post=${noPost.status} receive=${noReceive.status} insert=${refusedPost.error ? 'refused' : 'ALLOWED'} self=${JSON.stringify(selfUnblock.data)} edit=${(editOwn.data || []).length} apply=${refusedApply.error ? refusedApply.error.message : 'ALLOWED'} wrong=${wrongKind.status}`);

      const noBook = await act({ action: 'account.setLimit', userId: ids.ind2, limit: 'book', blocked: true }, admCookie);
      const ind2Fresh = (await loginCookie(email('ind2'), PASSWORD)).cookie;
      const refusedBook = await api('/api/bookings', { tour_id: tourId }, ind2Fresh);
      await signIn('ind2');
      const stillEdits = await anon.from('profiles').update({ first_name: 'Ազատ' }).eq('id', ids.ind2).select('id');
      await act({ action: 'account.setLimit', userId: ids.ind2, limit: 'book', blocked: false }, admCookie);
      check('admin: an individual can lose just the ability to sign up',
        noBook.status === 200 && refusedBook.status >= 400 && (stillEdits.data || []).length === 1,
        `limit=${noBook.status} book=${refusedBook.status} ${JSON.stringify(refusedBook.body)} edit=${(stillEdits.data || []).length}`);

      const heading = `E2E վերնագիր ${stamp}`;
      const badSlot = await act({ action: 'text.save', locale: 'hy', entries: [{ key: 'common.upTo', value: 'առանց թվի' }] }, superCookie);
      const saveText = await act({ action: 'text.save', locale: 'hy', entries: [{ key: 'home.heroTitle', value: heading }] }, superCookie);
      const homeEdited = await page('/');
      const resetText = await act({ action: 'text.save', locale: 'hy', entries: [{ key: 'home.heroTitle', value: '' }] }, superCookie);
      const homeReset = await page('/');
      check('admin: an edited text shows on the site, and restoring brings the original back',
        badSlot.status === 400 && saveText.status === 200 && homeEdited.includes(heading) && resetText.status === 200 && !homeReset.includes(heading),
        `badSlot=${badSlot.status} save=${saveText.status} shown=${homeEdited.includes(heading)} reset=${resetText.status} gone=${!homeReset.includes(heading)}`);
      await admin.from('site_texts').delete().eq('key', 'home.heroTitle').eq('value', heading);

      // Deleting a club takes its tours and applications with it and tells the participants.
      ids.club3 = await makeUser('club3', { role: 'club', club_name: 'E2E Club C' });
      const clubC = (await admin.from('clubs').select('id').eq('owner_id', ids.club3).single()).data.id;
      await givePackage(clubC, 'start');
      const tourC = (await admin.from('tours').insert(tourRow(clubC, { title: 'E2E Club C Tour', date: future(60) })).select('id').single()).data;
      await admin.from('bookings').insert({ tour_id: tourC.id, user_id: ids.ind, status: 'confirmed' });
      const delClub = await act({ action: 'account.delete', userId: ids.club3 }, superCookie);
      const goneClub = (await admin.auth.admin.getUserById(ids.club3)).data?.user;
      const goneTour = (await admin.from('tours').select('id').eq('id', tourC.id)).data || [];
      const notice = (await admin.from('notifications').select('id').eq('user_id', ids.ind).eq('kind', 'platform').like('message', '%E2E Club C Tour%')).data || [];
      check('admin: deleting a club removes everything it owned and tells the participants',
        delClub.status === 200 && !goneClub && goneTour.length === 0 && notice.length === 1,
        `status=${delClub.status} ${JSON.stringify(delClub.body)} user=${!!goneClub} tours=${goneTour.length} notices=${notice.length}`);
      if (!goneClub) ids.club3 = null;

      const seenByAdmin = (await page('/admin/logs', admCookie));
      const logRows = (await admin.from('activity_log').select('action, actor_role').in('actor_id', [ids.super, ids.adm])).data || [];
      const logged = (a) => logRows.some((r) => r.action === a);
      check('admin: admin actions are logged, and a regular admin does not see them',
        logged('admin.account_frozen') && logged('admin.tour_closed') && logged('admin.text_saved') && logged('admin.admin_created')
          && seenByAdmin.includes('Լոգեր') && !seenByAdmin.includes(email('super')),
        `actions=${[...new Set(logRows.map((r) => r.action))].join(',')} pageOk=${seenByAdmin.includes('Լոգեր')} leak=${seenByAdmin.includes(email('super'))}`);

      const delAdmin = await act({ action: 'admin.delete', userId: ids.adm }, superCookie);
      const goneAdmin = (await admin.auth.admin.getUserById(ids.adm)).data?.user;
      check('admin: the super admin removes an admin', delAdmin.status === 200 && !goneAdmin, `status=${delAdmin.status}`);
      if (!goneAdmin) ids.adm = null;
      await admin.from('activity_log').delete().like('actor_label', `%-${stamp}@example.com>%`);
      await admin.from('activity_log').delete().like('target_label', `%-${stamp}@example.com%`);

      // ---------- Phase 7: daily job ----------
      const cronUrl = `http://localhost:${DEV_PORT}/api/cron/daily`;
      const cronAnon = await fetch(cronUrl);
      check('HTTP cron: refused without the secret', cronAnon.status === 401, `status=${cronAnon.status}`);
      await admin.from('clubs').update({ package_ends_at: inDays(1.5) }).eq('id', clubA);
      const run1 = await fetch(cronUrl, { headers: { Authorization: 'Bearer e2e-cron-secret' } });
      const run2 = await fetch(cronUrl, { headers: { Authorization: 'Bearer e2e-cron-secret' } });
      const sentReminders = (await admin.from('package_reminders').select('days').eq('club_id', clubA)).data || [];
      check('HTTP cron: the 2-day package reminder goes out exactly once',
        run1.status === 200 && run2.status === 200 && sentReminders.length === 1 && sentReminders[0].days === 2,
        `runs=${run1.status}/${run2.status} reminders=${JSON.stringify(sentReminders)}`);

      check('HTTP: email no-op (RESEND_API_KEY absent from env)', !env.RESEND_API_KEY,
        env.RESEND_API_KEY ? 'API key present!' : 'no key — emails skipped');
    }
  } catch (e) {
    console.log('ERROR:', e.message);
    results.push({ name: 'script crashed: ' + e.message, ok: false });
  } finally {
    // ---------- cleanup ----------
    if (devServer) {
      stopDevServer(devServer);
      console.log('     dev server stopped');
    }
    await anon.auth.signOut();

    for (const id of Object.values(ids)) {
      if (!id) continue;
      const d = await admin.auth.admin.deleteUser(id);
      if (d.error) console.log('cleanup FAIL:', d.error.message);
    }
    const left = await admin.from('profiles').select('id', { count: 'exact', head: true }).like('email', `e2e-%-${stamp}@example.com`);
    console.log('\ncleanup -> e2e profiles left:', left.count);

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) {
      console.log('FAILED:');
      failed.forEach((f) => console.log('  - ' + f.name));
      process.exit(1);
    }
    process.exit(0);
  }
}

main();
