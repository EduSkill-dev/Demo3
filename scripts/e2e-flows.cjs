#!/usr/bin/env node
/**
 * End-to-end flow tests against the live Supabase project.
 *
 *   node scripts/e2e-flows.cjs
 *
 * Creates throwaway accounts (individual + two clubs), exercises the real
 * flows — sign-up, favorites, booking, ratings, notifications, tariff limits,
 * applicant visibility, guides — asserts each one, then deletes everything it
 * created. Safe to re-run; exits non-zero if any assertion fails.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY for setup/cleanup only; every assertion runs
 * through the anon key exactly like the app does.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFile = path.join(process.cwd(), '.env.local');
const env = Object.fromEntries(
  fs
    .readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'OK  ' : 'FAIL'} | ${name}${extra ? ' -> ' + extra : ''}`);
}
const stamp = Date.now();
const email = (who) => `e2e-${who}-${stamp}@example.com`;
const PASSWORD = 'E2eTest!2345';

async function makeUser(who, user_metadata) {
  const r = await admin.auth.admin.createUser({
    email: email(who),
    password: PASSWORD,
    email_confirm: true,
    user_metadata,
  });
  if (r.error) throw new Error(`createUser ${who}: ` + r.error.message);
  return r.data.user.id;
}

async function signIn(who) {
  const r = await anon.auth.signInWithPassword({ email: email(who), password: PASSWORD });
  if (r.error) throw new Error(`signIn ${who}: ` + r.error.message);
}

async function main() {
  const ids = {};
  try {
    // ---------- individual ----------
    ids.ind = await makeUser('ind', {
      role: 'individual', first_name: 'Աննա', last_name: 'Երկրորդ', age: '28', gender: 'female',
    });
    ids.ind2 = await makeUser('ind2', {
      role: 'individual', first_name: 'Պետրոս', last_name: 'Երկրորդ', age: '31', gender: 'male',
    });
    ids.club = await makeUser('club', { role: 'club', club_name: 'E2E Club A', tariff: 'advanced' });
    ids.club2 = await makeUser('club2', { role: 'club', club_name: 'E2E Club B', tariff: 'start' });

    const profile = await admin.from('profiles').select('role, first_name, age, email').eq('id', ids.ind).single();
    check('signup trigger created the individual profile', profile.data?.role === 'individual' && profile.data?.first_name === 'Աննա', JSON.stringify(profile.data));

    const clubRow = await admin.from('clubs').select('id, name, tariff').eq('owner_id', ids.club).single();
    check('signup trigger created the club with chosen tariff', clubRow.data?.tariff === 'advanced', JSON.stringify(clubRow.data));
    const clubA = clubRow.data.id;
    const clubB = (await admin.from('clubs').select('id').eq('owner_id', ids.club2).single()).data.id;

    // The club publishes first — this needs the club's own session.
    await signIn('club');
    const tourA = await anon.from('tours').insert({
      club_id: clubA, title: 'E2E Tour', regions: ['Կոտայք'], date: '2026-12-20',
      max_participants: 4, type: 'mountain', difficulty: 'easy', overnight: false,
      coordinator_phone: '+374 55 123456', meeting_point: 'Կասկադ', meeting_time: '07:00',
      cancel_deadline_hours: 24,
    }).select('id, meeting_time').single();
    check('club publishes a tour with meeting details', !tourA.error && tourA.data?.meeting_time?.startsWith('07:00'), tourA.error ? tourA.error.message : JSON.stringify(tourA.data));
    if (tourA.error) throw new Error('cannot continue without a tour: ' + tourA.error.message);
    const tourId = tourA.data.id;
    await anon.auth.signOut();

    await signIn('ind');

    // favorites
    const fav = await anon.from('favorite_clubs').insert({ user_id: ids.ind, club_id: clubB });
    check('individual can favorite a club', !fav.error, fav.error ? fav.error.message : '');

    const seats0 = await anon.rpc('seats_taken', { p_tour: tourId });
    check('seats start at 0', seats0.data === 0, String(seats0.data));

    const book = await anon.from('bookings').insert({ tour_id: tourId, user_id: ids.ind, status: 'confirmed' });
    check('individual books the tour', !book.error, book.error ? book.error.message : '');
    const seats1 = await anon.rpc('seats_taken', { p_tour: tourId });
    check('seat counter increments', seats1.data === 1, String(seats1.data));

    const dup = await anon.from('bookings').insert({ tour_id: tourId, user_id: ids.ind, status: 'confirmed' });
    check('duplicate booking is rejected', !!dup.error, dup.error ? dup.error.code : 'ALLOWED');

    // ratings
    const rate = await anon.from('ratings').insert({ user_id: ids.ind, tour_id: tourId, score: 5, comment: 'Գեղեցիկ էր։' });
    check('attendee rates the tour', !rate.error, rate.error ? rate.error.message : '');
    const rateDup = await anon.from('ratings').insert({ user_id: ids.ind, tour_id: tourId, score: 1, comment: 'Կրկնակի' });
    check('second rating on the same tour is rejected', rateDup.error?.code === '23505', rateDup.error ? rateDup.error.code : 'ALLOWED');

    const clubRate = await anon.from('ratings').insert({ user_id: ids.ind, club_id: clubA, score: 4, comment: 'Լավ ակումբ։' });
    check('attendee rates the club they attended', !clubRate.error, clubRate.error ? clubRate.error.message : '');
    const wrongClub = await anon.from('ratings').insert({ user_id: ids.ind, club_id: clubB, score: 1, comment: 'Առանց մասնակցության' });
    check('rating a club you never attended is rejected', !!wrongClub.error, wrongClub.error ? wrongClub.error.code : 'ALLOWED');

    await anon.auth.signOut();
    await signIn('ind2');
    const noBookingRate = await anon.from('ratings').insert({ user_id: ids.ind2, tour_id: tourId, score: 1, comment: 'Չեմ մասնակցել' });
    check('non-attendee rating is rejected', noBookingRate.error?.code === '42501', noBookingRate.error ? noBookingRate.error.code : 'ALLOWED');

    // profile save (columns added by migration 0011)
    const saveProfile = await anon.from('profiles').update({ phone: '+374 55 111111' }).eq('id', ids.ind2);
    check('saving profile.phone works', !saveProfile.error, saveProfile.error ? saveProfile.error.message : '');

    // ---------- capacity ----------
    const zeroTour = await admin.from('tours').insert({
      club_id: clubA, title: 'E2E Full Tour', regions: ['Կոտայք'], date: '2026-12-21',
      max_participants: 0, type: 'mountain', difficulty: 'easy', overnight: false,
      coordinator_phone: '+374 55 123456',
    }).select('id').single();
    const full = await anon.from('bookings').insert({ tour_id: zeroTour.data.id, user_id: ids.ind2, status: 'confirmed' });
    check('booking a tour with no seats left is rejected', !!full.error, full.error ? full.error.message : 'ALLOWED');

    // ---------- tariff limits (club A, advanced = 5 listings) ----------
    await anon.auth.signOut();
    await signIn('club');
    const beforeCount = (await admin.from('tours').select('id', { count: 'exact', head: true }).eq('club_id', clubA)).count ?? 0;
    let created = 0;
    for (let i = 0; i < 5; i++) {
      const r = await anon.from('tours').insert({
        club_id: clubA, title: `E2E Limited ${i}`, regions: ['Կոտայք'], date: '2027-01-0' + (i + 1),
        max_participants: 5, type: 'mountain', difficulty: 'easy', overnight: false,
        coordinator_phone: '+374 55 123456',
      });
      if (!r.error) created++;
      else console.log('     listing error:', r.error.message);
    }
    check('Advanced club stops exactly at its 5-listing cap', beforeCount + created === 5, `before=${beforeCount} created=${created}`);

    const over = await anon.from('tours').insert({
      club_id: clubA, title: 'E2E Over limit', regions: ['Կոտայք'], date: '2027-02-01',
      max_participants: 5, type: 'mountain', difficulty: 'easy', overnight: false,
      coordinator_phone: '+374 55 123456',
    });
    check('the next listing past the cap is rejected', !!over.error, over.error ? over.error.message : 'ALLOWED');

    // downgrading below the current count must not delete anything, but blocks new ones
    await admin.from('clubs').update({ tariff: 'start' }).eq('id', clubA);
    const afterDowngrade = await anon.from('tours').insert({
      club_id: clubA, title: 'E2E After downgrade', regions: ['Կոտայք'], date: '2027-03-01',
      max_participants: 5, type: 'mountain', difficulty: 'easy', overnight: false,
      coordinator_phone: '+374 55 123456',
    });
    check('START club with 5 listings cannot add more', !!afterDowngrade.error, afterDowngrade.error ? afterDowngrade.error.message : 'ALLOWED');
    await admin.from('clubs').update({ tariff: 'advanced' }).eq('id', clubA);

    // ---------- applicants visibility ----------
    await anon.auth.signOut();
    await signIn('ind');
    await anon.from('bookings').insert({ tour_id: tourId, user_id: ids.ind, status: 'confirmed' });
    await anon.auth.signOut();

    await signIn('club');
    const ownApplicants = await anon.from('bookings')
      .select('id, profiles(first_name, last_name, email)', { count: 'exact' })
      .eq('tour_id', tourId);
    const rows = ownApplicants.data || [];
    const embedded = Array.isArray(rows[0]?.profiles) ? rows[0].profiles[0] : rows[0]?.profiles;
    check('club sees its applicants with profile data', rows.length >= 1 && embedded?.first_name === 'Աննա', JSON.stringify(rows[0] ?? null));

    // Club profile data (description + orientation), saved from the dashboard
    // while the owning club is signed in.
    const infoSave = await anon.from('clubs').update({
      description: 'E2E նկարագրություն՝ ստեղծված թեստի կողմից։',
      focus_areas: 'Լեռներ ու սարեր, Գիշերակացով արշավներ',
    }).eq('id', clubA);
    check('club saves its description and orientation', !infoSave.error, infoSave.error ? infoSave.error.message : '');

    await signIn('club2');
    const otherApplicants = await anon.from('bookings').select('id').eq('tour_id', tourId);
    check('another club sees no applicants for that tour', (otherApplicants.data || []).length === 0, `rows=${(otherApplicants.data || []).length}`);

    const clubRatings = await anon.from('ratings')
      .select('id, score, comment, profiles(first_name)')
      .or(`tour_id.eq.${tourId},club_id.eq.${clubA}`);
    check('club sees the ratings left on its tours and on itself', (clubRatings.data || []).length >= 2,
      `rows=${(clubRatings.data || []).length}`);


    // ---------- clubs cannot book ----------
    const clubBooking = await anon.from('bookings').insert({ tour_id: tourId, user_id: ids.club2, status: 'confirmed' });
    const clubBookingRow = await admin.from('bookings').select('id').eq('user_id', ids.club2);
    check('a club account cannot book a tour', !!clubBooking.error && (clubBookingRow.data || []).length === 0,
      (clubBooking.error ? clubBooking.error.message : 'ALLOWED') + ` | rows=${(clubBookingRow.data || []).length}`);

    // ---------- individuals cannot forge role / tariff / ownership ----------
    const tariffEscalation = await anon.from('clubs').update({ tariff: 'pro' }).eq('id', clubB);
    const clubBTariff = (await admin.from('clubs').select('tariff').eq('id', clubB).single()).data?.tariff;
    check('a club cannot set tariff to pro', !!tariffEscalation.error && clubBTariff === 'start',
      (tariffEscalation.error ? tariffEscalation.error.code : 'ALLOWED') + ` | tariff=${clubBTariff}`);

    const foreignClub = await anon.from('clubs').update({ name: 'Hijacked' }).eq('id', clubA);
    const clubAName = (await admin.from('clubs').select('name').eq('id', clubA).single()).data?.name;
    // RLS hides the row instead of erroring, so assert on the data itself.
    check('a club cannot edit someone else s club', clubAName === 'E2E Club A',
      (foreignClub.error ? 'error ' + foreignClub.error.code : 'no error, RLS hides the row') + ` | name=${clubAName}`);

    // ---------- guides ----------
    const guide = await anon.from('club_guides').insert({ club_id: clubB, first_name: 'Մարի', last_name: 'Ուղեկցող' }).select('id').single();
    check('club adds a guide', !guide.error, guide.error ? guide.error.message : '');
    const guideDelete = await anon.from('club_guides').delete().eq('id', guide.data?.id ?? '');
    check('club deletes a guide', !guideDelete.error, guideDelete.error ? guideDelete.error.message : '');    await anon.auth.signOut();
    await signIn('ind2');

    // ---------- individuals cannot forge their role or create a club ----------
    const roleEscalation = await anon.from('profiles').update({ role: 'club' }).eq('id', ids.ind2);
    const roleAfter = (await admin.from('profiles').select('role').eq('id', ids.ind2).single()).data?.role;
    check('an individual cannot flip their role to club', !!roleEscalation.error && roleAfter === 'individual',
      (roleEscalation.error ? roleEscalation.error.code : 'ALLOWED') + ` | role=${roleAfter}`);

    const fakeClub = await anon.from('clubs').insert({ owner_id: ids.ind2, name: 'Fake Club' });
    const fakeClubRows = await admin.from('clubs').select('id').eq('owner_id', ids.ind2);
    check('an individual cannot create a club', !!fakeClub.error && (fakeClubRows.data || []).length === 0,
      (fakeClub.error ? fakeClub.error.code : 'ALLOWED') + ` | rows=${(fakeClubRows.data || []).length}`);

    const foreignGuide = await anon.from('club_guides').insert({ club_id: clubB, first_name: 'Չ', last_name: 'Կա' });
    check('a stranger cannot add a guide to another club', !!foreignGuide.error, foreignGuide.error ? foreignGuide.error.code : 'ALLOWED');

    // ---------- notifications ----------
    await anon.from('favorite_clubs').insert({ user_id: ids.ind2, club_id: clubB }).then(() => {});
    await anon.auth.signOut();
    await signIn('club2');
    const newTour = await anon.from('tours').insert({
      club_id: clubB, title: 'E2E Notified Tour', regions: ['Կոտայք'], date: '2027-04-01',
      max_participants: 5, type: 'mountain', difficulty: 'easy', overnight: false,
      coordinator_phone: '+374 55 123456',
    });
    check('publishing while someone follows you works', !newTour.error, newTour.error ? newTour.error.message : '');
    await anon.auth.signOut();

    await signIn('ind2');
    const notes = await anon.from('notifications').select('id, message, read').eq('user_id', ids.ind2);
    check('the follower receives the notification', (notes.data || []).length >= 1, JSON.stringify(notes.data));
    const mark = await anon.from('notifications').update({ read: true }).eq('user_id', ids.ind2).eq('read', false);
    check('the owner can mark notifications read', !mark.error, mark.error ? mark.error.message : '');

    // ---------- cancel flow ----------
    await anon.from('bookings').insert({ tour_id: tourId, user_id: ids.ind2, status: 'confirmed' }).then(() => {});
    const myBooking = await anon.from('bookings').select('id').eq('tour_id', tourId).eq('user_id', ids.ind2).limit(1);
    const cancelTarget = myBooking.data?.[0]?.id;
    if (cancelTarget) {
      const cancel = await anon.from('bookings').update({ status: 'cancelled' }).eq('id', cancelTarget);
      check('individual cancels their booking', !cancel.error, cancel.error ? cancel.message : '');
    } else {
      check('individual can cancel a booking (booking exists)', false, 'no booking found for ind2');
    }
    await anon.auth.signOut();

    // The public club page must show what the club saved.
    const publicClub = await anon.from('clubs').select('description, focus_areas, photo_url').eq('id', clubA).single();
    check('the public club page reads the saved info',
      publicClub.data?.description?.startsWith('E2E նկարագրություն') &&
        publicClub.data?.focus_areas?.includes('Գիշերակացով'),
      JSON.stringify(publicClub.data));
  } catch (e) {
    console.log('ERROR:', e.message);
    results.push({ name: 'script crashed: ' + e.message, ok: false });
  } finally {
    // ---------- cleanup ----------
    for (const id of Object.values(ids)) {
      if (!id) continue;
      const d = await admin.auth.admin.deleteUser(id);
      if (d.error) console.log('cleanup FAIL:', d.error.message);
    }
    const [clubs, tours, ratings, bookings, notifications, guides, favorites] = await Promise.all([
      admin.from('clubs').select('name'),
      admin.from('tours').select('title'),
      admin.from('ratings').select('id', { count: 'exact', head: true }),
      admin.from('bookings').select('id', { count: 'exact', head: true }),
      admin.from('notifications').select('id', { count: 'exact', head: true }),
      admin.from('club_guides').select('id', { count: 'exact', head: true }),
      admin.from('favorite_clubs').select('id', { count: 'exact', head: true }),
    ]);
    console.log('\ncleanup -> clubs:', JSON.stringify(clubs.data),
      '| tours:', JSON.stringify((tours.data || []).map((t) => t.title)),
      '| ratings:', ratings.count, '| bookings:', bookings.count,
      '| notifications:', notifications.count, '| guides:', guides.count, '| favorites:', favorites.count);

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
