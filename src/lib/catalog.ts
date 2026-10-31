// The platform's fixed lists and rules, in one place. Labels live in the
// i18n dictionaries under the same keys (region.*, terrain.*, difficulty.*).
//
// What each plan allows is NOT here: it lives in the database
// (packages.config), is edited by the super admin, and is read through
// src/lib/plans. Only the plan ids and the date rules are fixed.

export const PACKAGE_IDS = ["start", "advanced", "pro"] as const;
export type PackageId = (typeof PACKAGE_IDS)[number];

export function isPackageId(value: unknown): value is PackageId {
  return typeof value === "string" && (PACKAGE_IDS as readonly string[]).includes(value);
}

// The plan a club is on right now: a paid one while it runs, otherwise START
// — every club always has START, it never ends and needs no renewal. The
// database answers the same way (club_active_tariff).
export function activePackage(
  club: { tariff: string | null; package_ends_at: string | null } | null | undefined,
  now: number = Date.now()
): PackageId {
  if (!club || !isPackageId(club.tariff) || club.tariff === "start" || !club.package_ends_at) return "start";
  return new Date(club.package_ends_at).getTime() > now ? club.tariff : "start";
}

export const addDaysTo = (from: Date, days: number): Date => new Date(from.getTime() + days * 86400000);

export const REGIONS = [
  "yerevan", "aragatsotn", "ararat", "armavir", "gegharkunik", "kotayk",
  "lori", "shirak", "syunik", "vayots_dzor", "tavush",
] as const;
export type Region = (typeof REGIONS)[number];

export const TERRAINS = [
  "mountains", "lakes", "gorges", "caves", "waterfalls", "forest", "heritage", "other",
] as const;
export type Terrain = (typeof TERRAINS)[number];

// What a club does (its profile checkboxes). Labels: focus.<key>.
// What a club does: the kinds of places it goes to (the same as the places'
// kinds, by the same names), then the kinds of hikes it runs.
export const CLUB_FOCUS_PLACES = ["mountains", "lakes", "gorges", "caves", "waterfalls", "forest", "heritage"] as const;
export const CLUB_FOCUS_FORMATS = ["overnight", "kids", "family", "corporate"] as const;
export const CLUB_FOCUS = [...CLUB_FOCUS_PLACES, ...CLUB_FOCUS_FORMATS] as const;
// A club's choices in that order (places first).
export const orderFocus = (focus: string[] | null | undefined) => CLUB_FOCUS.filter((k) => (focus ?? []).includes(k));
export type ClubFocus = (typeof CLUB_FOCUS)[number];

export const DIFFICULTIES = ["easy", "medium", "hard", "prof"] as const;

// What a club can tick under "what to bring". Labels: bring.<key>.
export const BRING_ITEMS = [
  "boots", "warm_clothes", "rain_jacket", "hat", "sunglasses", "sunscreen", "water", "food",
  "backpack", "poles", "headlamp", "first_aid", "id_card", "cash", "swimsuit", "sleeping_bag", "tent", "mat",
] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export function isRegion(value: string): value is Region {
  return (REGIONS as readonly string[]).includes(value);
}
export function isTerrain(value: string): value is Terrain {
  return (TERRAINS as readonly string[]).includes(value);
}

// A booking can be cancelled only while more than this many hours remain.
// The club picks one of the options for each listing; 48 is the default.
export const CANCEL_HOUR_OPTIONS = [24, 36, 48, 60] as const;
export const DEFAULT_CANCEL_HOURS = 48;
export const cancelHoursOf = (tour: { cancel_hours?: number | null } | null | undefined): number =>
  tour?.cancel_hours ?? DEFAULT_CANCEL_HOURS;

// Armenia is UTC+4 all year (no daylight saving), matching the DB's
// tour_starts_at(date, meeting_time) in Asia/Yerevan.
export function tourStartsAt(date: string, meetingTime?: string | null): Date {
  const time = (meetingTime ?? "00:00").slice(0, 5);
  return new Date(`${date}T${time}:00+04:00`);
}

export function canCancelBooking(
  date: string,
  meetingTime: string | null | undefined,
  hours: number = DEFAULT_CANCEL_HOURS,
  now: number = Date.now()
): boolean {
  return tourStartsAt(date, meetingTime).getTime() - now > hours * 3600 * 1000;
}

// "25 000 ֏" — the way amounts are shown across cards, receipts and emails.
export function formatAmd(amount: number | string): string {
  const whole = Math.round(Number(amount) || 0);
  return `${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ֏`;
}

// What one payment for a paid plan buys: `days` from now, or on top of what
// is left of the same plan (it can be extended at any time).
export function planSubscription(
  club: { tariff: string | null; package_ends_at: string | null },
  target: PackageId,
  days: number,
  now: Date = new Date()
): { mode: "new" | "extend"; periodStart: Date; periodEnd: Date } {
  if (activePackage(club, now.getTime()) === target && club.package_ends_at) {
    const endsAt = new Date(club.package_ends_at);
    return { mode: "extend", periodStart: endsAt, periodEnd: addDaysTo(endsAt, days) };
  }
  return { mode: "new", periodStart: now, periodEnd: addDaysTo(now, days) };
}
