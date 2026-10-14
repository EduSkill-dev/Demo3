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
    // ---------- plans live in the database; code holds no plan rule ----------
    const catalogSrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/catalog.ts'), 'utf8');
    check('catalog.ts holds no plan limits or prices', !/maxListings|maxPerTour|priceAmd/.test(catalogSrc));
    const dbPackages = (await admin.from('packages').select('*')).data || [];
    for (const id of ['start', 'advanced', 'pro']) {
      const row = dbPackages.find((x) => x.id === id);
      const c = row?.config || {};
      const listings = (await admin.rpc('tariff_max_listings', { p_tariff: id })).data;
      const perTour = (await admin.rpc('tariff_max_participants', { p_tariff: id })).data;
      check(`plan ${id}: the limits the database enforces are the ones in its config`,
        Number.isInteger(c.max_active_tours) && listings === c.max_active_tours && perTour === c.max_participants_per_tour
          && typeof c.public_show_rating === 'boolean' && typeof c.dashboard_registrants_list === 'boolean',
        `config=${c.max_active_tours}/${c.max_participants_per_tour} enforced=${listings}/${perTour}`);
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
      env: { ...process.env, ...env, CRON_SECRET: 'e2e-cron-secret', TELEGRAM_WEBHOOK_SECRET: 'e2e-tg-secret', TELEGRAM_CHAT_ID: '-100123', EMAIL_DISABLED: '1', NEXT_DIST_DIR: '.next-e2e' },
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
      const subAgain = await api('/api/newsletter', { email: subEmail });
      const tokenAfter = (await admin.from('newsletter_subscribers').select('token').eq('email', subEmail).single()).data?.token;
      check('HTTP newsletter: asking again does not send a second link', subAgain.body.state === 'pending' && tokenAfter === subRow?.token,
        `state=${subAgain.body.state} sameToken=${tokenAfter === subRow?.token}`);
      await page(`/newsletter/confirm?token=${subRow?.token}`);
      const confirmedRow = (await admin.from('newsletter_subscribers').select('confirmed_at').eq('email', subEmail).single()).data;
      check('HTTP newsletter: the emailed link confirms it', !!confirmedRow?.confirmed_at, JSON.stringify(confirmedRow));
      const subConfirmed = await api('/api/newsletter', { email: subEmail });
      const asAccount = await api('/api/newsletter', { email: email('ind') });
      const asMember = await api('/api/newsletter', {}, indCookie);
      check('HTTP newsletter: a confirmed address and a registered account are told they are already subscribed',
        subConfirmed.body.state === 'already' && asAccount.body.state === 'already' && asMember.body.state === 'already',
        `guest=${subConfirmed.body.state} accountEmail=${asAccount.body.state} signedIn=${asMember.body.state}`);
      await signIn('ind');
      const newsOff = await anon.from('profiles').update({ platform_news: false }).eq('id', ids.ind).select('platform_news');
      const offState = await api('/api/newsletter', { email: email('ind') });
      const backOn = await api('/api/newsletter', {}, await cookieFor('ind'));
      const newsNow = (await admin.from('profiles').select('platform_news').eq('id', ids.ind).single()).data?.platform_news;
      check('platform news: an account switches them off itself and back on from the footer',
        newsOff.data?.[0]?.platform_news === false && offState.body.state === 'account' && backOn.body.state === 'subscribed' && newsNow === true,
        `off=${JSON.stringify(newsOff.data)} guestAsk=${offState.body.state} on=${backOn.body.state} now=${newsNow}`);
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

      // ---------- Input limits enforced by the database ----------
      await signIn('club');
      const longTitle = await anon.from('tours').update({ title: 'Ա'.repeat(151) }).eq('id', tourId).select('id');
      const badPhone = await anon.from('tours').update({ coordinator_phone: '<script>alert(1)</script>' }).eq('id', tourId).select('id');
      const hugePrice = await anon.from('tours').update({ price: 1e12 }).eq('id', tourId).select('id');
      const longAbout = await anon.from('clubs').update({ description: 'x'.repeat(5001) }).eq('id', clubA).select('id');
      const notImage = await anon.storage.from('club-assets').upload(`tours/${ids.club}/e2e-${stamp}.html`, new Blob(['<script>1</script>'], { type: 'text/html' }), { contentType: 'text/html' });
      const tooBig = await anon.storage.from('club-assets').upload(`tours/${ids.club}/e2e-${stamp}.jpg`, new Blob([new Uint8Array(5 * 1024 * 1024 + 10)], { type: 'image/jpeg' }), { contentType: 'image/jpeg' });
      check('limits: over-long text, a malformed phone, an absurd price, a non-image and an oversized upload are refused',
        !!longTitle.error && !!badPhone.error && !!hugePrice.error && !!longAbout.error && !!notImage.error && !!tooBig.error,
        `title=${!!longTitle.error} phone=${!!badPhone.error} price=${!!hugePrice.error} about=${!!longAbout.error} html=${notImage.error ? 'refused' : 'UPLOADED'} big=${tooBig.error ? 'refused' : 'UPLOADED'}`);
      const oddPrice = await api('/api/requests', { action: 'create', people: 2, dateFrom: future(12), regions: ['lori'], budget: 4549 }, indCookie);
      const oddRow = (await admin.from('tour_requests').select('id, budget').eq('id', oddPrice.body.id).maybeSingle()).data;
      check('prices are kept in whole hundreds of dram', oddPrice.status === 200 && oddRow?.budget === 4500, JSON.stringify(oddRow));
      if (oddRow) await admin.from('tour_requests').delete().eq('id', oddRow.id);

      // ---------- Likes: only for people who took part ----------
      const pastTour = (await admin.from('tours').insert(tourRow(clubA, { title: 'E2E Liked Route', date: future(30), status: 'active' })).select('id').single()).data;
      // Booked while it was still ahead, then the day passes.
      await admin.from('bookings').insert({ tour_id: pastTour.id, user_id: ids.ind2, status: 'confirmed' });
      await admin.from('tours').update({ date: future(-3) }).eq('id', pastTour.id);
      await signIn('ind');
      const strangerTour = await anon.from('tour_likes').insert({ user_id: ids.ind, tour_id: pastTour.id });
      await signIn('ind2');
      const upcomingLike = await anon.from('tour_likes').insert({ user_id: ids.ind2, tour_id: soonTour.id });
      const likeTour = await anon.from('tour_likes').insert({ user_id: ids.ind2, tour_id: pastTour.id });
      const likeClub = await anon.from('club_likes').insert({ user_id: ids.ind2, club_id: clubA });
      const forOther = await anon.from('club_likes').insert({ user_id: ids.ind, club_id: clubA });
      const mine = (await anon.rpc('my_engagement')).data;
      const counts = [(await visitor.from('tour_like_counts').select('likes').eq('tour_id', pastTour.id).maybeSingle()).data?.likes,
        (await visitor.from('club_like_counts').select('likes').eq('club_id', clubA).maybeSingle()).data?.likes];
      const unlike = await anon.from('club_likes').delete().eq('user_id', ids.ind2).eq('club_id', clubA).select('club_id');
      check('likes: a participant likes the hike and its club after the hike; nobody else can; counts are public',
        !!strangerTour.error && !!upcomingLike.error && !likeTour.error && !likeClub.error && !!forOther.error
          && mine?.tourLikes?.includes(pastTour.id) && mine?.attendedClubs?.includes(clubA) && counts[0] === 1 && counts[1] === 1 && (unlike.data || []).length === 1,
        `stranger=${strangerTour.error ? 'refused' : 'ALLOWED'} upcoming=${upcomingLike.error ? 'refused' : 'ALLOWED'} tour=${likeTour.error?.message ?? 'ok'} club=${likeClub.error?.message ?? 'ok'} forOther=${forOther.error ? 'refused' : 'ALLOWED'} counts=${counts.join('/')} unlike=${(unlike.data || []).length}`);
      await admin.from('tours').delete().eq('id', pastTour.id);

      // ---------- The guard on the open forms ----------
      const g = (form, ip) => admin.rpc('guard_public_action', { p_action: form, p_ip: ip, p_ip_max: 3, p_global_max: 8, p_window_minutes: 10, p_ip_block_minutes: 60, p_pause_minutes: 30 });
      const form1 = `e2e-a-${stamp}`, form2 = `e2e-b-${stamp}`, noisy = `203.0.113.${stamp % 200}`;
      const calls = [];
      for (let i = 0; i < 4; i++) calls.push((await g(form1, noisy)).data);
      const otherForm = (await g(form2, noisy)).data;
      const spread = [];
      for (let i = 0; i < 9; i++) spread.push((await g(form2, `198.51.100.${i + 1}`)).data);
      const afterPause = (await g(form2, '198.51.100.250')).data;
      const seen = (await admin.from('activity_log').select('action').in('action', ['security.ip_blocked', 'security.function_paused']).in('target_id', [noisy, form2])).data || [];
      check('abuse guard: one noisy address is blocked everywhere; a flood from many addresses pauses the form; both are logged',
        calls.join() === 'ok,ok,ok,ip_blocked' && otherForm === 'ip_blocked' && spread.slice(0, 8).every((x) => x === 'ok') && spread[8] === 'paused'
          && afterPause === 'paused' && seen.length === 2,
        `sameIp=${calls.join()} otherForm=${otherForm} spread=${spread.join()} after=${afterPause} logged=${seen.length}`);
      await admin.from('security_blocks').delete().in('key', [noisy, form1, form2]);
      await admin.from('rate_hits').delete().like('key', `pa:e2e-%-${stamp}:%`);
      await admin.from('activity_log').delete().in('target_id', [noisy, form2]);

      const regTaken = await api('/api/auth/register', { role: 'individual', email: email('never'), password: PASSWORD, phone: '010 000002', firstName: 'Ա', lastName: 'Բ', birthDate: '1990-01-01' });
      const regBad = await api('/api/auth/register', { role: 'club', email: 'not-an-email', password: PASSWORD, phone: '+374 77 000000', clubName: 'X' });
      const regName = await api('/api/auth/register', { role: 'club', email: email('never2'), password: PASSWORD, phone: '+374 77 ' + String(stamp).slice(-6), clubName: 'e2e CLUB a', firstName: 'Ա', lastName: 'Բ' });
      const created0 = (await admin.from('profiles').select('id').in('email', [email('never'), email('never2')])).data || [];
      check('sign-up route: a taken phone or club name and bad input are refused before any account exists',
        regTaken.status === 409 && regTaken.body.error?.code === 'phone_taken' && regBad.status === 400 && regName.body.error?.code === 'club_name_taken' && created0.length === 0,
        `phone=${regTaken.status} ${regTaken.body.error?.code} bad=${regBad.status} name=${regName.body.error?.code} created=${created0.length}`);

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

      // Emergency contact: optional, both fields or none, private.
      const emTour = (await admin.from('tours').insert(tourRow(clubA, { title: 'E2E Emergency', date: future(83), max_participants: 10 })).select('id').single()).data;
      const emHalf = await api('/api/bookings', { tour_id: emTour.id, emergency: { name: 'Մայրիկ', phone: '' } }, indCookie);
      const emBadPhone = await api('/api/bookings', { tour_id: emTour.id, emergency: { name: 'Մայրիկ', phone: 'call me' } }, indCookie);
      const emBook = await api('/api/bookings', { tour_id: emTour.id, emergency: { name: 'Մայրիկ', phone: '+374 91 555555', remember: true } }, indCookie);
      const emRow = (await admin.from('bookings').select('emergency_contact_name, emergency_contact_phone').eq('id', emBook.body?.booking?.id).single()).data;
      const emSaved = (await admin.from('emergency_contacts').select('name, phone').eq('user_id', ids.ind).maybeSingle()).data;
      await signIn('club');
      const emClub = (await anon.from('bookings').select('emergency_contact_phone').eq('id', emBook.body?.booking?.id)).data || [];
      const emClubSaved = (await anon.from('emergency_contacts').select('phone')).data || [];
      await signIn('club2');
      const emOther = (await anon.from('bookings').select('emergency_contact_phone').eq('id', emBook.body?.booking?.id)).data || [];
      const emVisitor = (await visitor.from('bookings').select('emergency_contact_phone').eq('id', emBook.body?.booking?.id)).data || [];
      const emCancel = await api('/api/bookings', { action: 'cancel', booking_id: emBook.body?.booking?.id }, indCookie);
      const emAfter = (await admin.from('bookings').select('emergency_contact_name, emergency_contact_phone').eq('id', emBook.body?.booking?.id).single()).data;
      await admin.from('emergency_contacts').delete().eq('user_id', ids.ind);
      check('emergency contact: both fields or none; only the participant and the organising club can read it; cancelling removes it',
        emHalf.status === 400 && emBadPhone.status === 400 && emBook.status === 200
          && emRow?.emergency_contact_name === 'Մայրիկ' && emRow?.emergency_contact_phone === '+374 91 555555' && emSaved?.phone === '+374 91 555555'
          && emClub[0]?.emergency_contact_phone === '+374 91 555555' && emClubSaved.length === 0 && emOther.length === 0 && emVisitor.length === 0
          && emCancel.status === 200 && emAfter?.emergency_contact_name === null && emAfter?.emergency_contact_phone === null,
        `half=${emHalf.status} bad=${emBadPhone.status} book=${emBook.status} ${JSON.stringify(emBook.body)} row=${JSON.stringify(emRow)} saved=${JSON.stringify(emSaved)} club=${emClub.length} clubSaved=${emClubSaved.length} other=${emOther.length} visitor=${emVisitor.length} after=${JSON.stringify(emAfter)}`);

      // CSV export and the planner follow the club's plan; the page address is a slug.
      const get = (route, cookie) => fetch(`http://localhost:${DEV_PORT}${route}`, { headers: cookie ? { Cookie: cookie } : {}, redirect: 'manual' });
      const planOf = async (clubId) => {
        const c = (await admin.from('clubs').select('tariff, plan_overrides').eq('id', clubId).single()).data;
        return { ...((dbPackages.find((x) => x.id === c.tariff) || {}).config || {}), ...(c.plan_overrides || {}) };
      };
      const planA = await planOf(clubA);
      const csv = await get('/api/club/registrants', clubCookie);
      const csvText = Buffer.from(await csv.arrayBuffer());
      const csvAnon = await get('/api/club/registrants', indCookie);
      const csvOk = planA.registrants_csv_export
        ? csv.status === 200 && csvText[0] === 0xef && csvText[1] === 0xbb && csvText[2] === 0xbf && csvText.toString('utf8').includes('E2E')
        : csv.status === 403;
      check('registrants CSV: only for the club, only with the plan flag, UTF-8 with BOM', csvOk && csvAnon.status === 401,
        `flag=${planA.registrants_csv_export} status=${csv.status} individual=${csvAnon.status}`);

      const plan = await get(`/api/planner?date=${future(83)}`, club2Cookie);
      const planBody = await plan.json().catch(() => ({}));
      const planB = await planOf(clubB);
      const plannerOk = planB.planner_other_clubs
        ? plan.status === 200 && (planBody.others || []).some((x) => x.id === emTour.id && x.club === 'E2E Club A') && !JSON.stringify(planBody).includes('@')
        : plan.status === 403;
      const plannerInd = await get(`/api/planner?date=${future(83)}`, indCookie);
      check("planner: a club sees other clubs' published hikes on a day, nobody else does", plannerOk && plannerInd.status === 401,
        `flag=${planB.planner_other_clubs} status=${plan.status} others=${(planBody.others || []).length} individual=${plannerInd.status}`);

      const slugA = (await admin.from('clubs').select('slug').eq('id', clubA).single()).data?.slug;
      const byId = await get(`/clubs/${clubA}`);
      const bySlug = await get(`/clubs/${slugA}`);
      await signIn('club');
      const badSlug = await anon.from('clubs').update({ slug: 'Not A Slug!' }).eq('id', clubA).select('slug');
      const takenSlug = await anon.from('clubs').update({ slug: (await admin.from('clubs').select('slug').eq('id', clubB).single()).data.slug }).eq('id', clubA).select('slug');
      const newSlug = await anon.from('clubs').update({ slug: `e2e-club-${stamp}` }).eq('id', clubA).select('slug');
      check('club page: a slug made from the name, the id link redirects to it, the club can change it to a free valid one',
        /^e2e-club-a(-\d+)?$/.test(slugA || '') && [307, 308].includes(byId.status) && (byId.headers.get('location') || '').endsWith(`/clubs/${slugA}`) && bySlug.status === 200
          && !!badSlug.error && !!takenSlug.error && newSlug.data?.[0]?.slug === `e2e-club-${stamp}`,
        `slug=${slugA} id=${byId.status} ${byId.headers.get('location')} page=${bySlug.status} bad=${badSlug.error ? 'refused' : 'ALLOWED'} taken=${takenSlug.error ? 'refused' : 'ALLOWED'} new=${JSON.stringify(newSlug.data)}`);

      // Attendance: the club's roll call decides who may rate; the booking remembers its source.
      // (the hike of the emergency-contact test, booked again — this time through a shared link)
      const atTour = emTour;
      const atUnknown = await api('/api/bookings', { tour_id: atTour.id, source: 'myspace' }, indCookie);
      const unknownSource = (await admin.from('bookings').select('source').eq('id', atUnknown.body?.booking?.id).single()).data?.source;
      await api('/api/bookings', { action: 'cancel', booking_id: atUnknown.body?.booking?.id }, indCookie);
      const atBook = await api('/api/bookings', { tour_id: atTour.id, source: 'instagram' }, indCookie);
      const atRows = (await admin.from('bookings').select('id, tour_id, source').eq('tour_id', atTour.id).eq('user_id', ids.ind)).data || [];
      const atId = atBook.body?.booking?.id;
      await signIn('club');
      const tooEarly = await anon.rpc('mark_attendance', { p_booking: atId, p_attended: true });
      await admin.from('tours').update({ date: future(-1), price: 3000 }).eq('id', atTour.id);
      await signIn('club2');
      const atNotOwner = await anon.rpc('mark_attendance', { p_booking: atId, p_attended: true });
      await signIn('club');
      const markAbsent = await anon.rpc('mark_attendance', { p_booking: atId, p_attended: false });
      await signIn('ind');
      const absentRates = await anon.from('ratings').insert({ user_id: ids.ind, tour_id: atTour.id, score: 5, comment: 'E2E absent' });
      const absentLikes = await anon.from('tour_likes').insert({ user_id: ids.ind, tour_id: atTour.id });
      await signIn('club');
      const markCame = await anon.rpc('mark_attendance', { p_booking: atId, p_attended: true });
      await signIn('ind');
      const cameRates = await anon.from('ratings').insert({ user_id: ids.ind, tour_id: atTour.id, score: 5, comment: 'E2E came' }).select('id');
      check('attendance: only the organising club marks it, from the day of the hike; an absent participant cannot rate or like, one who came can',
        atBook.status === 200 && atRows[0]?.source === 'instagram' && unknownSource === null
          && !!tooEarly.error && !!atNotOwner.error && !markAbsent.error && !!absentRates.error && !!absentLikes.error && !markCame.error && (cameRates.data || []).length === 1,
        `book=${atBook.status} unknown=${unknownSource} sources=${JSON.stringify(atRows.map((r) => r.source))} early=${tooEarly.error ? 'refused' : 'ALLOWED'} other=${atNotOwner.error ? 'refused' : 'ALLOWED'} absent=${markAbsent.error?.message || 'ok'} rate=${absentRates.error ? 'refused' : 'ALLOWED'} like=${absentLikes.error ? 'refused' : 'ALLOWED'} came=${markCame.error?.message || 'ok'} rate2=${cameRates.error?.message || 'ok'}`);

      // Monthly report: the numbers of that hike; its lines are set per club by an admin.
      const repMonth = future(-1).slice(0, 7);
      const repPage = await fetch(`http://localhost:${DEV_PORT}/dashboard/report?month=${repMonth}`, { headers: { Cookie: clubCookie } });
      const repHtml = await repPage.text();
      const planAReport = (dbPackages.find((x) => x.id === 'advanced') || {}).config?.monthly_report;
      const setLines = await act({ action: 'club.setReport', userId: ids.club, items: ['hikes_total', 'revenue', 'nonsense'] }, superCookie);
      const linesRow = (await admin.from('clubs').select('report_items').eq('id', clubA).single()).data?.report_items;
      await signIn('club');
      await anon.from('clubs').update({ report_items: ['hikes_total', 'rating', 'sources'] }).eq('id', clubA);
      const linesAfterSelf = (await admin.from('clubs').select('report_items').eq('id', clubA).single()).data?.report_items;
      const repNarrow = await (await fetch(`http://localhost:${DEV_PORT}/dashboard/report?month=${repMonth}`, { headers: { Cookie: clubCookie } })).text();
      const resetLines = await act({ action: 'club.setReport', userId: ids.club, items: null }, superCookie);
      const linesReset = (await admin.from('clubs').select('report_items').eq('id', clubA).single()).data?.report_items;
      check('monthly report: shows the month for the club; an admin picks its lines for one club and can reset them; the club cannot',
        repPage.status === 200 && (planAReport ? repHtml.includes('E2E Emergency') && repHtml.includes('Instagram') : true)
          && setLines.status === 200 && JSON.stringify(linesRow) === JSON.stringify(['hikes_total', 'revenue']) && JSON.stringify(linesAfterSelf) === JSON.stringify(['hikes_total', 'revenue'])
          && (planAReport ? !repNarrow.includes('E2E Emergency') : true) && resetLines.status === 200 && linesReset === null,
        `page=${repPage.status} flag=${planAReport} set=${setLines.status} row=${JSON.stringify(linesRow)} self=${JSON.stringify(linesAfterSelf)} reset=${resetLines.status} ${JSON.stringify(linesReset)}`);

      // Faults are logged; the health check, sitemap and robots answer.
      const healthRes = await fetch(`http://localhost:${DEV_PORT}/api/health`);
      const clientErr = await api('/api/errors', { message: `E2E fault ${stamp}`, url: '/e2e' });
      const noise = await api('/api/errors', { message: 'ResizeObserver loop limit exceeded' });
      const faultRows = (await admin.from('error_log').select('source, area, message').like('message', `E2E fault ${stamp}%`)).data || [];
      const noiseLogged = (await admin.from('error_log').select('id').like('message', 'ResizeObserver%')).data || [];
      await admin.from('error_log').delete().like('message', 'E2E fault%');
      await admin.from('error_alerts').delete().like('signature', '%E2E fault%');
      const siteMap = await (await fetch(`http://localhost:${DEV_PORT}/sitemap.xml`)).text();
      const robotsTxt = await (await fetch(`http://localhost:${DEV_PORT}/robots.txt`)).text();
      check('monitoring: health answers, a browser fault is logged (noise is not), sitemap and robots exist',
        healthRes.status === 200 && clientErr.status === 200 && faultRows.length === 1 && faultRows[0].source === 'browser' && noise.status === 200 && noiseLogged.length === 0
          && siteMap.includes('/tours') && siteMap.includes('/calendar') && /Disallow: \/admin/.test(robotsTxt) && /Sitemap: .*sitemap.xml/.test(robotsTxt),
        `healthRes=${healthRes.status} faultRows=${JSON.stringify(faultRows)} noise=${noiseLogged.length} sitemap=${siteMap.length} robots=${robotsTxt.length}`);

      // Google sign-in: such an account finishes its profile before it can book.
      const gUser = await admin.auth.admin.createUser({ email: email('google'), password: PASSWORD, email_confirm: true, app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { full_name: 'Գուգլ Օգտատեր' } });
      ids.google = gUser.data.user.id;
      const gCookie = await cookieFor('google');
      const gProfile = (await admin.from('profiles').select('role, first_name, phone').eq('id', ids.google).single()).data;
      const gBook = await api('/api/bookings', { tour_id: tourId }, gCookie);
      const gAccount = await fetch(`http://localhost:${DEV_PORT}/account`, { headers: { Cookie: gCookie }, redirect: 'manual' });
      const gComplete = await fetch(`http://localhost:${DEV_PORT}/account/complete`, { headers: { Cookie: gCookie }, redirect: 'manual' });
      await admin.from('profiles').update({ first_name: 'Գուգլ', last_name: 'Օգտատեր', birth_date: '1990-01-01', gender: 'male', phone: '+374 77 ' + String(stamp).slice(-6) }).eq('id', ids.google);
      const gBook2 = await api('/api/bookings', { tour_id: tourId }, gCookie);
      const gAccount2 = await fetch(`http://localhost:${DEV_PORT}/account`, { headers: { Cookie: gCookie }, redirect: 'manual' });
      if (gBook2.body?.booking?.id) await api('/api/bookings', { action: 'cancel', booking_id: gBook2.body.booking.id }, gCookie);
      const noCode = await fetch(`http://localhost:${DEV_PORT}/auth/callback`, { redirect: 'manual' });
      check('google sign-in: a new account is an individual with missing details, is sent to finish them, and only then can book',
        gProfile?.role === 'individual' && !gProfile?.phone && gBook.status === 409 && gBook.body?.code === 'profile_incomplete'
          && [307, 308].includes(gAccount.status) && (gAccount.headers.get('location') || '').includes('/account/complete') && gComplete.status === 200
          && gBook2.status === 200 && gAccount2.status === 200 && (noCode.headers.get('location') || '').includes('/login?error=oauth'),
        `profile=${JSON.stringify(gProfile)} book=${gBook.status} account=${gAccount.status} ${gAccount.headers.get('location')} complete=${gComplete.status} book2=${gBook2.status} ${JSON.stringify(gBook2.body)} account2=${gAccount2.status} nocode=${noCode.headers.get('location')}`);

      // Help chat: registered accounts write, admins answer from Telegram, the chat can be switched off.
      const chatGuest = await api('/api/support', { body: 'hello' });
      const chatLong = await api('/api/support', { body: 'x'.repeat(1001) }, indCookie);
      const chatSend = await api('/api/support', { body: 'E2E հարց' }, indCookie);
      const chatClub = await api('/api/support', { body: 'E2E ակումբի հարց' }, clubCookie);
      const chatMsgId = chatSend.body?.message?.id;
      await admin.from('support_messages').update({ tg_message_id: 777001 }).eq('id', chatMsgId);
      const tg = (body, secret) => fetch(`http://localhost:${DEV_PORT}/api/telegram/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(secret ? { 'X-Telegram-Bot-Api-Secret-Token': secret } : {}) }, body: JSON.stringify(body) });
      const reply = { message: { message_id: 777002, text: 'E2E պատասխան', chat: { id: -100123 }, from: { first_name: 'Գոռ', last_name: 'Ադմին' }, reply_to_message: { message_id: 777001 } } };
      const tgNoSecret = await tg(reply);
      const tgOtherChat = await tg({ message: { ...reply.message, chat: { id: -5 } } }, 'e2e-tg-secret');
      const tgReply = await tg(reply, 'e2e-tg-secret');
      const chatRows = (await admin.from('support_messages').select('from_admin, admin_name, body').eq('user_id', ids.ind).order('id')).data || [];
      await signIn('club2');
      const chatOther = (await anon.from('support_messages').select('id')).data || [];
      await signIn('ind');
      const chatOwn = (await anon.from('support_messages').select('id')).data || [];
      const chatForge = await anon.from('support_messages').insert({ user_id: ids.ind, body: 'forged', from_admin: true });
      const chatOff = await act({ action: 'account.setLimit', userId: ids.ind, limit: 'chat', blocked: true }, superCookie);
      const chatRefused = await api('/api/support', { body: 'again' }, indCookie);
      await act({ action: 'account.setLimit', userId: ids.ind, limit: 'chat', blocked: false }, superCookie);
      check('help chat: only registered accounts write (a paragraph at most), the admin reply from Telegram lands in the right chat, nobody reads another chat, admins can switch it off',
        chatGuest.status === 401 && chatLong.status === 400 && chatSend.status === 200 && chatClub.status === 200
          && tgNoSecret.status === 401 && tgOtherChat.status === 200 && tgReply.status === 200
          && chatRows.length === 2 && chatRows[1].from_admin === true && chatRows[1].admin_name === 'Գոռ Ադմին' && chatRows[1].body === 'E2E պատասխան'
          && chatOther.length === 0 && chatOwn.length === 2 && !!chatForge.error && chatOff.status === 200 && chatRefused.status === 403,
        `guest=${chatGuest.status} long=${chatLong.status} send=${chatSend.status} club=${chatClub.status} tg=${tgNoSecret.status}/${tgOtherChat.status}/${tgReply.status} rows=${JSON.stringify(chatRows)} other=${chatOther.length} own=${chatOwn.length} forge=${chatForge.error ? 'refused' : 'ALLOWED'} off=${chatOff.status} refused=${chatRefused.status}`);

      // A club registered with Google: the fresh account becomes a club once.
      const gClub = await admin.auth.admin.createUser({ email: email('gclub'), password: PASSWORD, email_confirm: true, app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { full_name: 'Գուգլ Ակումբ' } });
      ids.gclub = gClub.data.user.id;
      const gClubCookie = await cookieFor('gclub');
      const clubForm = { clubName: `E2E Google Club ${stamp}`, firstName: 'Գուգլ', lastName: 'Ակումբ', phone: '+374 98 ' + String(stamp).slice(-6) };
      const becomeTaken = await api('/api/auth/become-club', { ...clubForm, clubName: 'E2E Club A' }, gClubCookie);
      const become = await api('/api/auth/become-club', clubForm, gClubCookie);
      const gClubRow = (await admin.from('clubs').select('name, slug, profiles!clubs_owner_id_fkey(role, first_name)').eq('owner_id', ids.gclub).maybeSingle()).data;
      const becomeDone = await api('/api/auth/become-club', clubForm, gCookie); // the finished individual from the test above
      const becomeEmail = await api('/api/auth/become-club', clubForm, indCookie); // an email+password account
      check('club with Google: a fresh Google account becomes a club once; a finished individual and a password account cannot',
        becomeTaken.status === 409 && become.status === 200 && gClubRow?.name === clubForm.clubName && gClubRow?.profiles?.role === 'club' && gClubRow?.profiles?.first_name === 'Գուգլ' && !!gClubRow?.slug
          && becomeDone.status === 409 && becomeEmail.status === 403,
        `taken=${becomeTaken.status} become=${become.status} ${JSON.stringify(become.body)} row=${JSON.stringify(gClubRow)} done=${becomeDone.status} email=${becomeEmail.status}`);

      // Shared calendar and its feeds: public data only.
      const calPage = await fetch(`http://localhost:${DEV_PORT}/calendar?month=${future(78).slice(0, 7)}`);
      const calHtml = await calPage.text();
      const feed = await fetch(`http://localhost:${DEV_PORT}/calendar.ics`);
      const feedText = await feed.text();
      const oneFeed = await fetch(`http://localhost:${DEV_PORT}/tours/${tourId}/calendar.ics`);
      const oneText = await oneFeed.text();
      const badFeed = await fetch(`http://localhost:${DEV_PORT}/tours/not-an-id/calendar.ics`);
      check('calendar: the page and the .ics feeds work and carry no personal data',
        calPage.status === 200 && /calendar.ics/.test(calHtml)
          && feed.status === 200 && (feed.headers.get('content-type') || '').includes('text/calendar') && feedText.startsWith('BEGIN:VCALENDAR\r\n') && feedText.includes(`UID:tour-${tourId}@culmen.am`)
          && oneFeed.status === 200 && (oneText.match(/BEGIN:VEVENT/g) || []).length === 1 && /DTSTART;VALUE=DATE:\d{8}/.test(oneText)
          && !/example\.com|\+374|Երկրորդ/.test(feedText) && feedText.split('\r\n').every((l) => Buffer.byteLength(l) <= 75) && badFeed.status === 404,
        `page=${calPage.status} feed=${feed.status} one=${oneFeed.status} events=${(oneText.match(/BEGIN:VEVENT/g) || []).length} bad=${badFeed.status}`);

      // Social sharing: one switch per network, kept by admins who manage pages.
      const shareBefore = (await admin.from('site_settings').select('value').eq('key', 'share_networks').single()).data.value;
      const shareByAdmin = await act({ action: 'share.save', networks: shareBefore }, admCookie); // this admin has no "pages"
      const shareBad = await act({ action: 'share.save', networks: { facebook: true } }, superCookie);
      const shareSame = await act({ action: 'share.save', networks: shareBefore }, superCookie); // same values: the live site does not change
      const shareAfter = (await admin.from('site_settings').select('value').eq('key', 'share_networks').single()).data.value;
      const shareDirect = await visitor.from('site_settings').select('key');
      check('sharing: the networks are switched by admins with the pages permission, never from a browser',
        shareByAdmin.status === 403 && shareBad.status === 400 && shareSame.status === 200
          && JSON.stringify(shareAfter) === JSON.stringify(shareBefore) && (shareDirect.data || []).length === 0,
        `admin=${shareByAdmin.status} bad=${shareBad.status} save=${shareSame.status} direct=${(shareDirect.data || []).length}`);

      // …and one club can have single networks closed.
      const closeBad = await act({ action: 'club.setShare', userId: ids.club, blocked: ['myspace'] }, superCookie);
      const closeInd = await act({ action: 'club.setShare', userId: ids.ind2, blocked: [] }, superCookie);
      const closeTwo = await act({ action: 'club.setShare', userId: ids.club, blocked: ['viber', 'facebook'] }, superCookie);
      await signIn('club');
      await anon.from('clubs').update({ share_blocked: [] }).eq('id', clubA);
      const shareRow = (await admin.from('clubs').select('share_blocked').eq('id', clubA).single()).data?.share_blocked;
      const reopen = await act({ action: 'club.setShare', userId: ids.club, blocked: [] }, superCookie);
      check('sharing: an admin closes single networks for one club; the club cannot reopen them itself',
        closeBad.status === 400 && closeInd.status === 400 && closeTwo.status === 200
          && JSON.stringify(shareRow) === JSON.stringify(['facebook', 'viber']) && reopen.status === 200,
        `bad=${closeBad.status} ind=${closeInd.status} set=${closeTwo.status} row=${JSON.stringify(shareRow)} reopen=${reopen.status}`);

      // Plans: only the super admin edits them or hands them out.
      const proRow = dbPackages.find((x) => x.id === 'pro');
      const samePlan = { action: 'plan.save', id: 'pro', priceAmd: proRow.price_amd, isAvailable: proRow.is_available, config: proRow.config };
      const planByAdmin = await act(samePlan, admCookie);
      const planBadPrice = await act({ ...samePlan, priceAmd: proRow.price_amd + 50 }, superCookie);
      const planMissingKey = await act({ ...samePlan, config: { max_active_tours: 3 } }, superCookie);
      const planSaved = await act(samePlan, superCookie); // the same values back: nothing changes on the live site
      const proAfter = (await admin.from('packages').select('price_amd, config').eq('id', 'pro').single()).data;
      check('plans: only the super admin saves a plan, and only a complete, valid one',
        planByAdmin.status === 403 && planBadPrice.status === 400 && planMissingKey.status === 400 && planSaved.status === 200
          && proAfter.price_amd === proRow.price_amd && JSON.stringify(proAfter.config) === JSON.stringify(proRow.config),
        `admin=${planByAdmin.status} price=${planBadPrice.status} partial=${planMissingKey.status} save=${planSaved.status} ${JSON.stringify(planSaved.body)}`);

      const clubBefore = (await admin.from('clubs').select('tariff, package_ends_at, plan_overrides').eq('id', clubB).single()).data;
      const giveByAdmin = await act({ action: 'club.setPlan', userId: ids.club2, tariff: 'pro' }, admCookie);
      const giveBad = await act({ action: 'club.setPlan', userId: ids.club2, tariff: 'gold' }, superCookie);
      const giveInd = await act({ action: 'club.setPlan', userId: ids.ind2, tariff: 'pro' }, superCookie);
      const givePro = await act({ action: 'club.setPlan', userId: ids.club2, tariff: 'pro' }, superCookie);
      const clubPro = (await admin.from('clubs').select('tariff, package_ends_at').eq('id', clubB).single()).data;
      // One club gets what its plan does not have; the database limit follows.
      const proCap = proRow.config.max_participants_per_tour;
      const ownBad = await act({ action: 'club.setPlan', userId: ids.club2, tariff: 'pro', overrides: { max_participants_per_tour: -3 } }, superCookie);
      const ownSet = await act({ action: 'club.setPlan', userId: ids.club2, tariff: 'pro', overrides: { max_participants_per_tour: proCap + 7, max_active_tours: proRow.config.max_active_tours } }, superCookie);
      const ownRow = (await admin.from('clubs').select('package_ends_at, plan_overrides').eq('id', clubB).single()).data;
      const ownCap = (await admin.rpc('club_max_participants', { p_club: clubB })).data;
      await signIn('club2');
      await anon.from('clubs').update({ plan_overrides: { max_participants_per_tour: 999 } }).eq('id', clubB);
      const selfCap = (await admin.rpc('club_max_participants', { p_club: clubB })).data;
      check('plans: one club can get more than its plan gives, only from the super admin, and only the difference is stored',
        ownBad.status === 400 && ownSet.status === 200 && JSON.stringify(ownRow.plan_overrides) === JSON.stringify({ max_participants_per_tour: proCap + 7 })
          && ownRow.package_ends_at === clubPro.package_ends_at && ownCap === proCap + 7 && selfCap === proCap + 7,
        `bad=${ownBad.status} set=${ownSet.status} stored=${JSON.stringify(ownRow.plan_overrides)} cap=${ownCap} afterSelf=${selfCap}`);

      const takeAway = await act({ action: 'club.setPlan', userId: ids.club2, tariff: null }, superCookie);
      const clubNone = (await admin.from('clubs').select('tariff, package_ends_at, plan_overrides').eq('id', clubB).single()).data;
      await admin.from('clubs').update(clubBefore).eq('id', clubB);
      const proDays = clubPro.package_ends_at ? (new Date(clubPro.package_ends_at) - Date.now()) / 86400000 : 0;
      check('plans: the super admin gives a club a plan for a month and can take it away',
        giveByAdmin.status === 403 && giveBad.status === 400 && giveInd.status === 400 && givePro.status === 200
          && clubPro.tariff === 'pro' && proDays > 27 && proDays < 32 && takeAway.status === 200 && clubNone.tariff === null && clubNone.package_ends_at === null && JSON.stringify(clubNone.plan_overrides) === '{}',
        `admin=${giveByAdmin.status} bad=${giveBad.status} ind=${giveInd.status} give=${givePro.status} ${JSON.stringify(clubPro)} take=${takeAway.status} ${JSON.stringify(clubNone)}`);

      const noBook = await act({ action: 'account.setLimit', userId: ids.ind2, limit: 'book', blocked: true }, admCookie);
      const ind2Fresh = (await loginCookie(email('ind2'), PASSWORD)).cookie;
      const refusedBook = await api('/api/bookings', { tour_id: tourId }, ind2Fresh);
      await signIn('ind2');
      const stillEdits = await anon.from('profiles').update({ first_name: 'Ազատ' }).eq('id', ids.ind2).select('id');
      await act({ action: 'account.setLimit', userId: ids.ind2, limit: 'book', blocked: false }, admCookie);
      const reqBody = { action: 'create', people: 3, dateFrom: future(60), dateTo: future(61), regions: ['kotayk'], terrains: [] };
      const noRequest = await act({ action: 'account.setLimit', userId: ids.ind2, limit: 'request', blocked: true }, admCookie);
      const refusedRequest = await api('/api/requests', reqBody, ind2Fresh);
      await signIn('ind2');
      await anon.from('profiles').update({ requests_blocked: false }).eq('id', ids.ind2);
      const stillBlocked = (await admin.from('profiles').select('requests_blocked').eq('id', ids.ind2).single()).data?.requests_blocked;
      await act({ action: 'account.setLimit', userId: ids.ind2, limit: 'request', blocked: false }, admCookie);
      const allowedRequest = await api('/api/requests', reqBody, ind2Fresh);
      const reqPage = await fetch(`http://localhost:${DEV_PORT}/admin/requests`, { headers: { Cookie: superCookie } });
      const reqHtml = await reqPage.text();
      // (the request allowed above is the first of the five)
      // 5 open requests at most; 10 cancellations in 24 h pause cancelling and new requests.
      const reqs = [];
      for (let i = 0; i < 6; i++) reqs.push(await api('/api/requests', reqBody, ind2Fresh));
      const openIds = reqs.filter((r) => r.status === 200).map((r) => r.body.id);
      const firstClose = await api('/api/requests', { action: 'close', requestId: openIds[0] }, ind2Fresh);
      const closedRow = (await admin.from('tour_requests').select('status, closed_at').eq('id', openIds[0]).single()).data;
      // Nine more cancellations "earlier today", written straight into the table.
      const old = (await admin.from('tour_requests').insert(Array.from({ length: 9 }, () => ({
        user_id: ids.ind2, people: 2, date_from: future(60), date_to: future(60), regions: ['kotayk'], status: 'closed', closed_at: new Date(Date.now() - 3600000).toISOString(),
      }))).select('id')).data || [];
      const eleventh = await api('/api/requests', { action: 'close', requestId: openIds[1] }, ind2Fresh);
      const pausedCreate = await api('/api/requests', reqBody, ind2Fresh);
      await admin.from('tour_requests').update({ closed_at: new Date(Date.now() - 25 * 3600000).toISOString() }).in('id', old.map((x) => x.id));
      const afterWindow = await api('/api/requests', { action: 'close', requestId: openIds[1] }, ind2Fresh);
      await admin.from('tour_requests').delete().eq('user_id', ids.ind2);
      check('requests: at most 5 open; the 10th cancellation in 24 h pauses cancelling and new requests until the window passes',
        reqs.slice(0, 4).every((r) => r.status === 200) && reqs[4].status >= 400 && reqs[5].status >= 400 && openIds.length === 4
          && firstClose.status === 200 && closedRow?.status === 'closed' && !!closedRow?.closed_at
          && eleventh.status === 429 && pausedCreate.status === 429 && afterWindow.status === 200,
        `reqs=${reqs.map((r) => r.status).join(',')} close=${firstClose.status} 11th=${eleventh.status} create=${pausedCreate.status} ${JSON.stringify(pausedCreate.body)} later=${afterWindow.status}`);

      check('admin: an individual can lose just custom requests, cannot switch it back, and requests are listed for admins',
        noRequest.status === 200 && refusedRequest.status === 403 && stillBlocked === true && allowedRequest.status === 200
          && reqPage.status === 200 && reqHtml.includes(email('ind2')),
        `limit=${noRequest.status} refused=${refusedRequest.status} self=${stillBlocked} allowed=${allowedRequest.status} ${JSON.stringify(allowedRequest.body)} page=${reqPage.status}`);

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
