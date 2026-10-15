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

// The package a club can use right now; null when it has none or it lapsed.
export function activePackage(
  club: { tariff: string | null; package_ends_at: string | null } | null | undefined,
  now: number = Date.now()
): PackageId | null {
  if (!club || !isPackageId(club.tariff) || !club.package_ends_at) return null;
  return new Date(club.package_ends_at).getTime() > now ? club.tariff : null;
}

// "Extend" appears once this many days (or fewer) remain.
export const RENEW_WINDOW_DAYS = 7;
// Email reminders go out this many days before the package lapses.
export const EXPIRY_REMINDER_DAYS = [7, 2] as const;

export function addOneMonth(from: Date): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

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

export type SubscriptionPlan =
  | { ok: true; mode: "new" | "extend" | "upgrade"; periodStart: Date; periodEnd: Date }
  | { ok: false; reason: "same_not_due" | "downgrade" };

// What buying `target` means for a club right now:
//   * no active package          -> new month from now
//   * same package, <= 7 days    -> extend: one more month from the old end
//   * same package, > 7 days     -> refused (the button is not shown yet)
//   * bigger package             -> upgrade at once, new month from now
//   * smaller package            -> refused until the current one lapses
export function planSubscription(
  club: { tariff: string | null; package_ends_at: string | null },
  target: PackageId,
  rank: Record<PackageId, number>, // which plan is bigger (from the plans table)
  now: Date = new Date()
): SubscriptionPlan {
  const current = activePackage(club, now.getTime());
  if (!current) {
    return { ok: true, mode: "new", periodStart: now, periodEnd: addOneMonth(now) };
  }
  const endsAt = new Date(club.package_ends_at!);
  if (target === current) {
    const daysLeft = (endsAt.getTime() - now.getTime()) / 86400000;
    if (daysLeft > RENEW_WINDOW_DAYS) return { ok: false, reason: "same_not_due" };
    return { ok: true, mode: "extend", periodStart: endsAt, periodEnd: addOneMonth(endsAt) };
  }
  if (rank[target] > rank[current]) {
    return { ok: true, mode: "upgrade", periodStart: now, periodEnd: addOneMonth(now) };
  }
  return { ok: false, reason: "downgrade" };
}
