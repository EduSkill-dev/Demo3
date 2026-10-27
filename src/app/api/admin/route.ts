import { withErrorReport } from "@/lib/errors";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, clientIp, getAdmin, logActivity, notifyBlocked, oneTimePassword, type AdminSession } from "@/lib/admin";
import { ACCOUNT_LIMITS, ADMIN_PERMS, type AccountLimit, type AccountStatus, type AdminPerm } from "@/lib/adminLabels";
import { deleteClub, deleteIndividual } from "@/lib/accountDeletion";
import { SITE_TEXTS_TAG } from "@/lib/siteTexts";
import { SIGHTS_TAG } from "@/lib/sights";
import { SHARE_NETWORKS, SHARE_NETWORK_IDS } from "@/lib/share";
import { REPORT_KEYS, cleanReportItems } from "@/lib/report/items";
import { sendToNewsChannel } from "@/lib/telegram";
import { adminDisplayName, answerSuggestion, answerSupport } from "@/lib/messages";
import { SHARE_NETWORKS_KEY } from "@/lib/siteSettings";
import { platformNewsEmail, sendEmailBatch } from "@/lib/email";
import { markAdminEventsSeen } from "@/lib/adminEvents";
import { DIFFICULTIES, REGIONS, TERRAINS, addOneMonth, isPackageId } from "@/lib/catalog";
import { MAX_PLAN_NUMBER, PLAN_FEATURES, cleanOverrides, resolveConfig } from "@/lib/plans/registry";
import { DICTIONARIES } from "@/i18n/translate";
import { isLocale } from "@/i18n/config";
import { MIN_PASSWORD } from "@/lib/authErrors";
import { allowCredentialChange, viaOf } from "@/lib/adminSecurity";
import { todayInYerevan } from "@/lib/calendar";

// Everything an admin can change goes through this one route:
//   { action: "<name>", ... }  →  { ok: true, ... } | { error }
// Each action checks the caller's permission, does its work with the service
// role and writes an activity_log entry.

type Body = Record<string, unknown>;
type Ctx = { me: AdminSession; ip: string | null; db: ReturnType<typeof createAdminClient> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BAN_FOREVER = "876000h"; // about 100 years
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const FORBIDDEN = "Այս գործողության թույլտվություն չունեք։";

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}
const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort().join(",");

// The individual or club account an action is aimed at — never an admin.
async function targetAccount({ me, db }: Ctx, userId: string) {
  const { data } = await db.from("profiles").select("id, role, email, status").eq("id", userId).maybeSingle();
  const p = data as { id: string; role: string; email: string; status: AccountStatus } | null;
  if (!p || (p.role !== "individual" && p.role !== "club")) return { error: fail("Հաշիվը չի գտնվել։", 404) };
  if (!can(me, p.role === "club" ? "clubs" : "individuals")) return { error: fail(FORBIDDEN, 403) };
  const { data: club } = p.role === "club" ? await db.from("clubs").select("name").eq("owner_id", p.id).maybeSingle() : { data: null };
  const name = (club as { name?: string } | null)?.name;
  return { account: p, label: name ? `${name} <${p.email}>` : p.email };
}

// A regular (never the super) admin account.
async function targetAdmin({ db }: Ctx, userId: string) {
  const { data } = await db.from("admins").select("user_id, is_super, profiles(email)").eq("user_id", userId).maybeSingle();
  const a = data as unknown as { user_id: string; is_super: boolean; profiles: { email: string } | null } | null;
  if (!a || a.is_super) return null;
  return { userId: a.user_id, email: a.profiles?.email ?? "" };
}

const cleanPerms = (v: unknown): AdminPerm[] =>
  ADMIN_PERMS.filter((k) => Array.isArray(v) && (v as unknown[]).includes(k));

// A list of report lines as stored: null when it is every line (or not a list).
const reportList = (v: unknown) => {
  const items = cleanReportItems(v);
  return items && items.length < REPORT_KEYS.length ? items : null;
};

const ACTIONS: Record<string, (ctx: Ctx, body: Body) => Promise<NextResponse>> = {
  // Freeze, block or re-activate an individual's or a club's account.
  async "account.setStatus"(ctx, body) {
    const status = str(body.status) as AccountStatus;
    if (!["active", "frozen", "blocked"].includes(status)) return fail("Անհայտ կարգավիճակ։");
    const t = await targetAccount(ctx, str(body.userId));
    if (t.error) return t.error;

    const { error: banError } = await ctx.db.auth.admin.updateUserById(t.account.id, {
      ban_duration: status === "blocked" ? BAN_FOREVER : "none",
    });
    if (banError) return fail(banError.message, 500);
    const { error } = await ctx.db.from("profiles").update({ status }).eq("id", t.account.id);
    if (error) return fail(error.message, 500);
    if (status === "blocked") {
      await ctx.db.rpc("end_user_sessions", { p_user: t.account.id });
      await notifyBlocked(t.account.id);
    }

    await logActivity({
      actor: ctx.me.userId,
      action: status === "frozen" ? "admin.account_frozen" : status === "blocked" ? "admin.account_blocked" : "admin.account_activated",
      targetType: "account",
      targetId: t.account.id,
      targetLabel: t.label,
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true });
  },

  // Force one function of an account off (or back on), whatever its package:
  // a club's new listings / new applications, an individual's sign-ups.
  async "account.setLimit"(ctx, body) {
    const limit = str(body.limit) as AccountLimit;
    if (!Object.prototype.hasOwnProperty.call(ACCOUNT_LIMITS, limit)) return fail("Անհայտ ֆունկցիա։");
    const blocked = body.blocked === true;
    const t = await targetAccount(ctx, str(body.userId));
    if (t.error) return t.error;
    if (t.account.role !== ACCOUNT_LIMITS[limit].role) return fail("Այս ֆունկցիան այս հաշվին չի վերաբերում։");

    const { error } =
      limit === "chat" || limit === "clubChat"
        ? await ctx.db.from("profiles").update({ chat_blocked: blocked }).eq("id", t.account.id)
        : limit === "book" || limit === "request"
        ? await ctx.db.from("profiles").update(limit === "book" ? { booking_blocked: blocked } : { requests_blocked: blocked }).eq("id", t.account.id)
        : await ctx.db
            .from("clubs")
            .update(limit === "post" ? { posting_blocked: blocked } : { applications_blocked: blocked })
            .eq("owner_id", t.account.id);
    if (error) return fail(error.message, 500);

    await logActivity({
      actor: ctx.me.userId,
      action: blocked ? "admin.limit_on" : "admin.limit_off",
      targetType: "account",
      targetId: t.account.id,
      targetLabel: t.label,
      meta: { limit: ACCOUNT_LIMITS[limit].label },
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true });
  },

  // Remove an account with everything it owns.
  async "account.delete"(ctx, body) {
    const t = await targetAccount(ctx, str(body.userId));
    if (t.error) return t.error;
    const result = t.account.role === "club" ? await deleteClub(t.account.id) : await deleteIndividual(t.account.id);
    if (!result.ok) return fail(result.error, 500);
    await logActivity({
      actor: ctx.me.userId,
      action: "admin.account_deleted",
      targetType: "account",
      targetId: t.account.id,
      targetLabel: t.label,
      meta: { role: t.account.role, cancelled: result.cancelled },
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true });
  },

  // Take a listing off the site (or put it back). Its content is the club's.
  async "tour.setHidden"(ctx, body) {
    if (!can(ctx.me, "tours")) return fail(FORBIDDEN, 403);
    const hidden = body.hidden === true;
    const { data, error } = await ctx.db
      .from("tours")
      .update({ admin_hidden: hidden })
      .eq("id", str(body.tourId))
      .select("id, title")
      .maybeSingle();
    if (error) return fail(error.message, 500);
    const tour = data as { id: string; title: string } | null;
    if (!tour) return fail("Հայտարարությունը չի գտնվել։", 404);
    await logActivity({
      actor: ctx.me.userId,
      action: hidden ? "admin.tour_closed" : "admin.tour_opened",
      targetType: "tour",
      targetId: tour.id,
      targetLabel: tour.title,
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true });
  },

  // Replace site texts. An empty value brings the built-in text back.
  async "text.save"(ctx, body) {
    if (!can(ctx.me, "pages")) return fail(FORBIDDEN, 403);
    const locale = str(body.locale);
    if (!isLocale(locale)) return fail("Անհայտ լեզու։");
    const entries = Array.isArray(body.entries) ? (body.entries as { key?: unknown; value?: unknown }[]) : [];
    if (entries.length === 0 || entries.length > 300) return fail("Փոփոխություն չկա։");

    const upserts: { locale: string; key: string; value: string; updated_by: string; updated_at: string }[] = [];
    const resets: string[] = [];
    for (const e of entries) {
      const key = str(e.key);
      const value = typeof e.value === "string" ? e.value.trim() : "";
      const original = lookup(DICTIONARIES[locale], key) ?? lookup(DICTIONARIES.hy, key);
      if (original === undefined) return fail(`Անհայտ տեքստ՝ ${key}`);
      if (!value || value === original) {
        resets.push(key);
        continue;
      }
      if (value.length > 20000) return fail(`Տեքստը չափազանց երկար է՝ ${key}`);
      // {name}-style slots are filled in by the site; losing one breaks the sentence.
      if (placeholders(value) !== placeholders(original)) {
        return fail(`«${key}» տեքստում պետք է մնան նույն փոփոխականները՝ ${placeholders(original) || "չկան"}։`);
      }
      upserts.push({ locale, key, value, updated_by: ctx.me.userId, updated_at: new Date().toISOString() });
    }

    if (upserts.length) {
      const { error } = await ctx.db.from("site_texts").upsert(upserts);
      if (error) return fail(error.message, 500);
    }
    if (resets.length) {
      const { error } = await ctx.db.from("site_texts").delete().eq("locale", locale).in("key", resets);
      if (error) return fail(error.message, 500);
    }
    revalidateTag(SITE_TEXTS_TAG);
    await logActivity({
      actor: ctx.me.userId,
      action: "admin.text_saved",
      targetType: "text",
      targetLabel: `${locale}: ${entries.map((e) => str(e.key)).slice(0, 8).join(", ")}${entries.length > 8 ? "…" : ""}`,
      meta: { locale, changed: upserts.length, reset: resets.length },
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true });
  },

  // Add or change a sight (hidden rather than deleted: listings and requests
  // keep pointing at it).
  async "sight.save"(ctx, body) {
    if (!can(ctx.me, "pages")) return fail(FORBIDDEN, 403);
    const row = {
      name_hy: str(body.name_hy).slice(0, 120),
      name_ru: str(body.name_ru).slice(0, 120),
      name_en: str(body.name_en).slice(0, 120),
      region: str(body.region),
      terrain: str(body.terrain),
      difficulty: str(body.difficulty),
      active: body.active !== false,
      photo_url: /^https:\/\//.test(str(body.photo_url)) ? str(body.photo_url).slice(0, 500) : null,
      description_hy: str(body.description_hy).slice(0, 1500) || null,
      description_ru: str(body.description_ru).slice(0, 1500) || null,
      description_en: str(body.description_en).slice(0, 1500) || null,
      elevation: /^-?\d{1,4}$/.test(str(body.elevation)) ? Number(str(body.elevation)) : null,
      relative_height: /^\d{1,4}$/.test(str(body.relative_height)) ? Number(str(body.relative_height)) : null,
    };
    if (row.relative_height !== null && row.relative_height > 5000) return fail("Հարաբերական բարձրությունը պետք է լինի 0-ից 5000 մետր։");
    const trip = {
      distance_km: /^\d{1,4}$/.test(str(body.distance_km)) ? Number(str(body.distance_km)) : null,
      drive_minutes: /^\d{1,4}$/.test(str(body.drive_minutes)) ? Number(str(body.drive_minutes)) : null,
      mobile_signal: ["yes", "partial", "no"].includes(str(body.mobile_signal)) ? str(body.mobile_signal) : null,
    };
    if (trip.distance_km !== null && trip.distance_km > 1000) return fail("Հեռավորությունը պետք է լինի 0-ից 1000 կմ։");
    if (trip.drive_minutes !== null && trip.drive_minutes > 1440) return fail("Ճանապարհի ժամանակը պետք է լինի մինչև 1440 րոպե (24 ժամ)։");
    // "40.5123, 44.4567" (as Google and Yandex Maps copy it): latitude first.
    const coordText = str(body.coords).trim();
    const coords = coordText.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
    if (coordText && !coords) return fail("Կոորդինատները գրեք այսպես՝ 40.5123, 44.4567 (լայնություն, երկայնություն)։");
    const lat = coords ? Number(coords[1]) : null;
    const lng = coords ? Number(coords[2]) : null;
    if (lat !== null && lng !== null && (Math.abs(lat) > 90 || Math.abs(lng) > 180)) return fail("Կոորդինատները սխալ են։");
    Object.assign(row, trip, { lat, lng });
    if (row.elevation !== null && (row.elevation < -500 || row.elevation > 9000)) return fail("Բարձրությունը պետք է լինի -500-ից 9000 մետր։");
    if (!row.name_hy || !row.name_ru || !row.name_en) return fail("Լրացրեք անվանումը երեք լեզվով։");
    if (!(REGIONS as readonly string[]).includes(row.region)) return fail("Ընտրեք մարզը։");
    if (!(TERRAINS as readonly string[]).includes(row.terrain)) return fail("Ընտրեք վայրի տեսակը։");
    if (!(DIFFICULTIES as readonly string[]).includes(row.difficulty)) return fail("Ընտրեք բարդությունը։");
    const id = str(body.id);
    const { error } = id ? await ctx.db.from("sights").update(row).eq("id", id) : await ctx.db.from("sights").insert(row);
    if (error) return fail(error.code === "23505" ? "Այս անունով վայր արդեն կա։" : error.message, error.code === "23505" ? 400 : 500);
    revalidateTag(SIGHTS_TAG);
    await logActivity({
      actor: ctx.me.userId,
      action: "admin.sight_saved",
      targetType: "sight",
      targetLabel: row.name_hy,
      meta: row.active ? {} : { hidden: true },
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true });
  },

  // On which social networks a hike's link can be shared from the site.
  async "share.save"(ctx, body) {
    if (!can(ctx.me, "pages")) return fail(FORBIDDEN, 403);
    const sent = body.networks && typeof body.networks === "object" ? (body.networks as Record<string, unknown>) : null;
    if (!sent || SHARE_NETWORKS.some((n) => typeof sent[n.id] !== "boolean")) return fail("Նշեք յուրաքանչյուր ցանցի վիճակը։");
    const value = Object.fromEntries(SHARE_NETWORKS.map((n) => [n.id, sent[n.id] === true]));
    const { error } = await ctx.db
      .from("site_settings")
      .upsert({ key: SHARE_NETWORKS_KEY, value, updated_by: ctx.me.userId, updated_at: new Date().toISOString() });
    if (error) return fail(error.message, 500);
    await logActivity({
      actor: ctx.me.userId,
      action: "admin.share_saved",
      targetType: "setting",
      targetLabel: SHARE_NETWORKS.filter((n) => value[n.id]).map((n) => n.name).join(", ") || "բոլորն անջատված են",
      meta: value,
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true });
  },

  // The social networks closed for one club: its buttons stay visible there
  // but do not work. (What the platform shows at all is share.save.)
  // The people booked on one hike (the "Listings" seats cell), with what the
  // club sees about them — and whether they paid. Loaded only when an admin
  // opens the list; every opening is logged (personal data).
  async "tour.participants"(ctx, body) {
    if (!can(ctx.me, "tours")) return fail(FORBIDDEN, 403);
    const tourId = str(body.tourId);
    const { data: tour } = await ctx.db.from("tours").select("id, title").eq("id", tourId).maybeSingle();
    if (!tour) return fail("Արշավը չի գտնվել։", 404);
    const [{ data: rows }, { data: pays }] = await Promise.all([
      ctx.db
        .from("bookings")
        .select("id, user_id, guest_id, status, created_at, cancelled_at, attended, emergency_contact_name, emergency_contact_phone, profiles(first_name, last_name, email, phone, birth_date, gender), guests(first_name, last_name, email, phone, birth_date, gender)")
        .eq("tour_id", tourId)
        .order("created_at"),
      ctx.db.from("payments").select("user_id, guest_id, amount, status").eq("tour_id", tourId).eq("kind", "booking").eq("status", "succeeded"),
    ]);
    type P = { first_name: string | null; last_name: string | null; email: string | null; phone: string | null; birth_date: string | null; gender: string | null };
    type B = { id: string; user_id: string | null; guest_id: string | null; status: string; created_at: string; cancelled_at: string | null; attended: boolean | null; emergency_contact_name: string | null; emergency_contact_phone: string | null; profiles: P | null; guests: P | null };
    const paid = (pays ?? []) as { user_id: string | null; guest_id: string | null; amount: number }[];
    const people = ((rows ?? []) as unknown as B[]).map((b) => {
      const p = b.profiles ?? b.guests;
      const pay = paid.find((x) => (b.user_id && x.user_id === b.user_id) || (b.guest_id && x.guest_id === b.guest_id));
      return {
        id: b.id,
        userId: b.user_id,
        guest: !b.user_id,
        name: [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "—",
        email: p?.email ?? null,
        phone: p?.phone ?? null,
        birthDate: p?.birth_date ?? null,
        gender: p?.gender ?? null,
        status: b.status,
        bookedAt: b.created_at,
        cancelledAt: b.cancelled_at,
        attended: b.attended,
        emergency: b.emergency_contact_name ? `${b.emergency_contact_name}${b.emergency_contact_phone ? ` · ${b.emergency_contact_phone}` : ""}` : null,
        paid: pay ? Number(pay.amount) : null,
      };
    });
    await logActivity({ actor: ctx.me.userId, action: "admin.tour_participants_viewed", targetType: "tour", targetId: tourId, targetLabel: (tour as { title: string }).title, ip: ctx.ip });
    return NextResponse.json({ ok: true, people });
  },

  // One person's hikes ("Individuals"): those taken part in (over, not
  // marked absent) or those booked to come. Each opening is logged.
  async "individual.hikes"(ctx, body) {
    if (!can(ctx.me, "individuals")) return fail(FORBIDDEN, 403);
    const userId = str(body.userId);
    const which = body.which === "upcoming" ? "upcoming" : "past";
    const today = todayInYerevan();
    const { data } = await ctx.db
      .from("bookings")
      .select("attended, tours(id, title, date, end_date, clubs(id, name))")
      .eq("user_id", userId)
      .eq("status", "confirmed");
    type R = { attended: boolean | null; tours: { id: string; title: string; date: string; end_date: string | null; clubs: { id: string; name: string } | null } | null };
    const items = ((data ?? []) as unknown as R[])
      .filter((b) => b.tours && (which === "upcoming" ? (b.tours.end_date ?? b.tours.date) >= today : (b.tours.end_date ?? b.tours.date) < today && b.attended !== false))
      .map((b) => ({ tourId: b.tours!.id, title: b.tours!.title, date: b.tours!.date, clubId: b.tours!.clubs?.id ?? null, clubName: b.tours!.clubs?.name ?? null }))
      .sort((a, b) => (which === "upcoming" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
    await logActivity({ actor: ctx.me.userId, action: "admin.individual_hikes_viewed", targetType: "account", targetId: userId, meta: { which }, ip: ctx.ip });
    return NextResponse.json({ ok: true, items });
  },

  // A club's certificate: approve it (the blue badge appears), reject it
  // with a reason, or take an approval back. The club is told in its bell.
  async "club.certificate"(ctx, body) {
    const t = await targetAccount(ctx, str(body.userId));
    if (t.error) return t.error;
    if (t.account.role !== "club") return fail("Այս կարգավորումը միայն ակումբների համար է։");
    const decision = str(body.decision);
    if (!["approve", "reject", "revoke"].includes(decision)) return fail("Անհայտ որոշում։");
    const note = str(body.note).trim().slice(0, 500);
    if (decision !== "approve" && !note) return fail("Գրեք պատճառը. ակումբը այն կտեսնի։");
    const { data: club } = await ctx.db.from("clubs").select("id, certificate_url").eq("owner_id", t.account.id).maybeSingle();
    const c = club as { id: string; certificate_url: string | null } | null;
    if (!c?.certificate_url) return fail("Ակումբը հավաստագիր չի բեռնել։");
    const status = decision === "approve" ? "approved" : "rejected";
    const { error } = await ctx.db
      .from("clubs")
      .update({ certificate_status: status, certificate_note: decision === "approve" ? null : note, certificate_reviewed_at: new Date().toISOString() })
      .eq("id", c.id);
    if (error) return fail(error.message, 500);
    await ctx.db.from("notifications").insert({
      user_id: t.account.id,
      club_id: null,
      tour_id: null,
      kind: "platform",
      sender_type: "platform",
      message:
        decision === "approve"
          ? "Ձեր հավաստագիրը հաստատվել է․ ակումբի անվան կողքին այժմ երևում է «Հավաստագրված» նշանը։"
          : `Ձեր հավաստագիրը ${decision === "revoke" ? "այլևս չի ցուցադրվում" : "չի հաստատվել"}․ ${note} Կարող եք բեռնել նորը «Ակումբի տվյալներ» բաժնում։`,
    });
    await logActivity({
      actor: ctx.me.userId,
      action: `admin.certificate_${decision}`,
      targetType: "account",
      targetId: t.account.id,
      targetLabel: t.label,
      meta: note ? { note } : {},
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true, status });
  },

  async "club.setShare"(ctx, body) {
    const t = await targetAccount(ctx, str(body.userId));
    if (t.error) return t.error;
    if (t.account.role !== "club") return fail("Այս կարգավորումը միայն ակումբների համար է։");
    if (!Array.isArray(body.blocked) || (body.blocked as unknown[]).some((x) => !(SHARE_NETWORK_IDS as unknown[]).includes(x))) {
      return fail("Անհայտ սոց. ցանց։");
    }
    const blocked = SHARE_NETWORK_IDS.filter((id) => (body.blocked as unknown[]).includes(id));
    const { error } = await ctx.db.from("clubs").update({ share_blocked: blocked }).eq("owner_id", t.account.id);
    if (error) return fail(error.message, 500);
    await logActivity({
      actor: ctx.me.userId,
      action: "admin.club_share_set",
      targetType: "account",
      targetId: t.account.id,
      targetLabel: t.label,
      meta: { closed: blocked.length ? SHARE_NETWORKS.filter((n) => blocked.includes(n.id)).map((n) => n.name).join(", ") : "ոչ մեկը" },
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true, blocked });
  },

  // Opens an automatic block (an address, or a paused form) before its time.
  async "block.remove"(ctx, body) {
    const kind = str(body.kind);
    const key = str(body.key);
    if (!kind || !key) return fail("Նշեք՝ ինչը բացել։");
    const { data, error } = await ctx.db.from("security_blocks").delete().eq("kind", kind).eq("key", key).select("kind");
    if (error) return fail(error.message, 500);
    if (!(data ?? []).length) return fail("Այս արգելքն արդեն չկա։", 404);
    // The counters that caused it start again from zero.
    if (kind === "ip") await ctx.db.from("rate_hits").delete().like("key", `%${key}%`);
    await logActivity({ actor: ctx.me.userId, action: "admin.block_removed", targetType: "block", targetLabel: `${kind}: ${key}`, ip: ctx.ip });
    return NextResponse.json({ ok: true });
  },

  // Which lines of the monthly report one club sees. items: null puts the
  // club back on its plan's list.
  async "club.setReport"(ctx, body) {
    const t = await targetAccount(ctx, str(body.userId));
    if (t.error) return t.error;
    if (t.account.role !== "club") return fail("Այս կարգավորումը միայն ակումբների համար է։");
    if (body.items !== null && !Array.isArray(body.items)) return fail("Նշեք հաշվետվության տողերը։");
    const items = body.items === null ? null : cleanReportItems(body.items);
    const { error } = await ctx.db.from("clubs").update({ report_items: items }).eq("owner_id", t.account.id);
    if (error) return fail(error.message, 500);
    await logActivity({
      actor: ctx.me.userId,
      action: "admin.club_report_set",
      targetType: "account",
      targetId: t.account.id,
      targetLabel: t.label,
      meta: items === null ? { reset: true } : { lines: items.length },
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true, items });
  },

  // A post to the clubs' news channel in Telegram.
  // Answers from the Messages page: a help chat (shown in the person's chat)
  // or a suggestion (emailed). Signed with the admin's name; the Telegram
  // groups see the answer too.
  // A passport text that breaks the rules: removed (the person is not told by email).
  async "account.clearBio"(ctx, body) {
    if (!can(ctx.me, "individuals")) return fail(FORBIDDEN, 403);
    const userId = str(body.userId);
    if (!userId) return fail("Հաշիվը նշված չէ։");
    const { error } = await ctx.db.from("profiles").update({ passport_bio: null }).eq("id", userId).eq("role", "individual");
    if (error) return fail(error.message, 500);
    await logActivity({ actor: ctx.me.userId, action: "admin.bio_cleared", targetType: "profile", targetId: userId, ip: ctx.ip });
    return NextResponse.json({ ok: true });
  },

  // The bell's list was seen: everything up to now stops counting.
  async "events.seen"(ctx) {
    await markAdminEventsSeen(ctx.me.userId);
    return NextResponse.json({ ok: true });
  },

  async "support.reply"(ctx, body) {
    if (!can(ctx.me, "messages")) return fail(FORBIDDEN, 403);
    const userId = str(body.userId);
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!userId || !text) return fail("Գրեք պատասխանը։");
    if (text.length > 1000) return fail("Պատասխանը կարող է լինել առավելագույնը 1000 նիշ։");
    const adminName = await adminDisplayName(ctx.db, ctx.me.userId, ctx.me.email);
    const res = await answerSupport(ctx.db, { userId, adminName, body: text, via: "site" });
    if ("error" in res) return fail(res.error ?? "Չստացվեց։", 500);
    await logActivity({ actor: ctx.me.userId, action: "admin.message_answered", targetType: "support", targetLabel: text.slice(0, 80), ip: ctx.ip });
    return NextResponse.json({ ok: true });
  },

  async "suggestion.reply"(ctx, body) {
    if (!can(ctx.me, "messages")) return fail(FORBIDDEN, 403);
    const id = str(body.id);
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!id || !text) return fail("Գրեք պատասխանը։");
    if (text.length > 4000) return fail("Պատասխանը կարող է լինել առավելագույնը 4000 նիշ։");
    const adminName = await adminDisplayName(ctx.db, ctx.me.userId, ctx.me.email);
    const res = await answerSuggestion(ctx.db, { id, adminName, body: text, via: "site" });
    if ("error" in res) return fail(res.error ?? "Չստացվեց։", 400);
    await logActivity({ actor: ctx.me.userId, action: "admin.message_answered", targetType: "suggestion", targetLabel: text.slice(0, 80), ip: ctx.ip });
    return NextResponse.json({ ok: true });
  },

  // A platform post for individuals and/or clubs (Gor, 2026-10-19):
  //   * every account in the audience gets it on the site (the bell) — the
  //     database trigger on news_posts writes those notifications;
  //   * clubs also get it in the Telegram channel;
  //   * by email: those with "notifications from the platform" on, or —
  //     when it is important — everyone in the audience.
  async "news.post"(ctx, body) {
    if (!can(ctx.me, "news")) return fail(FORBIDDEN, 403);
    const text = typeof body.body === "string" ? body.body.trim() : "";
    const toIndividuals = body.toIndividuals === true;
    const toClubs = body.toClubs === true;
    const important = body.important === true;
    if (!text) return fail("Գրեք գրառման տեքստը։");
    if (text.length > 4000) return fail("Գրառումը կարող է լինել առավելագույնը 4000 նիշ։");
    if (!toIndividuals && !toClubs) return fail("Ընտրեք, թե ում համար է գրառումը՝ անհատներին, ակումբներին կամ երկուսին։");

    const { data: row, error } = await ctx.db
      .from("news_posts")
      .insert({ author_id: ctx.me.userId, author_label: ctx.me.email, body: text, to_individuals: toIndividuals, to_clubs: toClubs, important })
      .select("id")
      .single();
    if (error || !row) return fail(error?.message ?? "Չստացվեց պահել գրառումը։", 500);

    let channelError: string | null = null;
    if (toClubs) {
      const sent = await sendToNewsChannel(text);
      if ("id" in sent) await ctx.db.from("news_posts").update({ tg_message_id: sent.id }).eq("id", (row as { id: number }).id);
      else channelError = sent.error;
    }

    const roles = [...(toIndividuals ? ["individual"] : []), ...(toClubs ? ["club"] : [])];
    let q = ctx.db.from("profiles").select("email, role").in("role", roles).eq("status", "active");
    if (!important) q = q.eq("platform_news", true);
    const { data: people } = await q;
    const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://bolbol.am";
    const mail = await sendEmailBatch(
      ((people ?? []) as { email: string; role: string }[]).map((p) =>
        platformNewsEmail({ to: p.email, body: text, important, settingsUrl: `${origin}${p.role === "club" ? "/dashboard/notifications" : "/account/notifications"}` })
      )
    );
    await ctx.db.from("news_posts").update({ emailed: mail.sent }).eq("id", (row as { id: number }).id);
    await logActivity({ actor: ctx.me.userId, action: "admin.news_posted", targetType: "news", targetLabel: text.slice(0, 80), ip: ctx.ip, meta: { toIndividuals, toClubs, important, emailed: mail.sent } });
    return NextResponse.json({ ok: true, emailed: mail.sent, channelError });
  },

  // Super admin only: what a plan costs and allows. Every capability named in
  // the registry must arrive with the right type; nothing else is stored.
  async "plan.save"(ctx, body) {
    if (!ctx.me.isSuper) return fail(FORBIDDEN, 403);
    const id = str(body.id);
    if (!isPackageId(id)) return fail("Անհայտ փաթեթ։");
    const price = body.priceAmd;
    if (typeof price !== "number" || !Number.isInteger(price) || price < 0 || price > 10_000_000 || price % 100 !== 0) {
      return fail("Գինը պետք է լինի 100-ի բազմապատիկ՝ 0-ից 10 000 000 ֏։");
    }
    const raw = body.config && typeof body.config === "object" ? (body.config as Record<string, unknown>) : {};
    const config: Record<string, number | boolean> = {};
    for (const f of PLAN_FEATURES) {
      const v = raw[f.key];
      if (f.type === "number") {
        if (typeof v !== "number" || !Number.isInteger(v) || v < f.min || v > MAX_PLAN_NUMBER) return fail(`«${f.label}»՝ նշեք ամբողջ թիվ ${f.min}-ից ${MAX_PLAN_NUMBER}։`);
        config[f.key] = v;
      } else {
        if (typeof v !== "boolean") return fail(`«${f.label}»՝ արժեքը բացակայում է։`);
        config[f.key] = v;
      }
    }

    const { data, error } = await ctx.db
      .from("packages")
      .update({
        price_amd: price,
        is_available: body.isAvailable === true,
        // The report's default lines: all of them is stored as "no list".
        ...(body.reportItems === undefined ? {} : { report_items: reportList(body.reportItems) }),
        config,
        // The older columns are kept equal to the config they were replaced by.
        max_listings: config.max_active_tours,
        max_per_tour: config.max_participants_per_tour,
        shows_ratings: config.public_show_rating,
        shows_comments: config.public_show_comments,
        monthly_report: config.monthly_report,
        analytics: config.analytics,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("name")
      .maybeSingle();
    if (error) return fail(error.message, 500);
    if (!data) return fail("Փաթեթը չի գտնվել։", 404);
    await logActivity({
      actor: ctx.me.userId,
      action: "admin.plan_saved",
      targetType: "plan",
      targetId: id,
      targetLabel: (data as { name: string }).name,
      meta: { price, available: body.isAvailable === true, ...config },
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true });
  },

  // Super admin only: a club's plan and what this one club gets on top of it.
  //   tariff     a new plan runs a month from now; the same plan keeps its
  //              end date; null takes the plan away.
  //   overrides  (optional) the club's own values. Only those that differ
  //              from the plan are kept, so the rest keeps following the plan.
  // No payment is recorded — the log entry is the trace.
  async "club.setPlan"(ctx, body) {
    if (!ctx.me.isSuper) return fail(FORBIDDEN, 403);
    const tariff = body.tariff === null || body.tariff === "" ? null : str(body.tariff);
    if (tariff !== null && !isPackageId(tariff)) return fail("Անհայտ փաթեթ։");
    const t = await targetAccount(ctx, str(body.userId));
    if (t.error) return t.error;
    if (t.account.role !== "club") return fail("Փաթեթ ունենում են միայն ակումբները։");

    const { data: row } = await ctx.db.from("clubs").select("tariff, package_ends_at, plan_overrides").eq("owner_id", t.account.id).maybeSingle();
    const club = row as { tariff: string | null; package_ends_at: string | null; plan_overrides: unknown } | null;
    if (!club) return fail("Ակումբը չի գտնվել։", 404);
    const running = club.tariff === tariff && !!club.package_ends_at && new Date(club.package_ends_at).getTime() > Date.now();
    const until = !tariff ? null : running ? club.package_ends_at : addOneMonth(new Date()).toISOString();

    let overrides: Record<string, number | boolean> = cleanOverrides(club.plan_overrides);
    if (body.overrides !== undefined) {
      const sent = body.overrides && typeof body.overrides === "object" ? (body.overrides as Record<string, unknown>) : {};
      const wanted = cleanOverrides(sent) as Record<string, number | boolean>;
      if (Object.keys(wanted).length !== Object.keys(sent).length) return fail("Ակումբի կարգավորումներում սխալ արժեք կա։");
      const { data: planRow } = tariff ? await ctx.db.from("packages").select("config").eq("id", tariff).maybeSingle() : { data: null };
      const base = resolveConfig((planRow as { config: unknown } | null)?.config) as Record<string, number | boolean>;
      overrides = tariff ? Object.fromEntries(Object.entries(wanted).filter(([k, v]) => base[k] !== v)) : {};
    }
    if (!tariff) overrides = {};

    const { error } = await ctx.db.from("clubs").update({ tariff, package_ends_at: until, plan_overrides: overrides }).eq("owner_id", t.account.id);
    if (error) return fail(error.message, 500);
    await logActivity({
      actor: ctx.me.userId,
      action: "admin.club_plan_set",
      targetType: "account",
      targetId: t.account.id,
      targetLabel: t.label,
      meta: { plan: tariff ?? "none", until, ...(Object.keys(overrides).length ? { own: overrides } : {}) },
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true, package_ends_at: until, overrides });
  },

  // Super admin only: a new admin with a one-time password, shown once.
  async "admin.create"(ctx, body) {
    if (!ctx.me.isSuper) return fail(FORBIDDEN, 403);
    const email = str(body.email).toLowerCase();
    if (!EMAIL_RE.test(email)) return fail("Նշեք ճիշտ էլ. հասցե։");

    const { data: taken } = await ctx.db.from("profiles").select("id").eq("email", email).limit(1);
    const { data: aliasTaken } = await ctx.db.from("admins").select("user_id").eq("alt_email", email).limit(1);
    if ((taken ?? []).length || (aliasTaken ?? []).length) return fail("Այս էլ. հասցեով արդեն գրանցվել են հարթակում։");

    const password = oneTimePassword();
    const { data: created, error } = await ctx.db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !created.user) return fail(error?.message ?? "Չստացվեց ստեղծել հաշիվը։", 500);
    const id = created.user.id;

    const { error: roleError } = await ctx.db.from("profiles").update({ role: "admin" }).eq("id", id);
    const { error: rowError } = roleError
      ? { error: roleError }
      : await ctx.db.from("admins").insert({
          user_id: id,
          perms: cleanPerms(body.perms),
          must_change_password: true,
          created_by: ctx.me.userId,
        });
    if (rowError) {
      await ctx.db.auth.admin.deleteUser(id);
      return fail(rowError.message, 500);
    }
    // The sign-up trigger logged it as a new individual; it never was one.
    await ctx.db.from("activity_log").delete().eq("actor_id", id).eq("action", "account.created");

    await logActivity({
      actor: ctx.me.userId,
      action: "admin.admin_created",
      targetType: "admin",
      targetId: id,
      targetLabel: email,
      meta: { perms: cleanPerms(body.perms) },
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true, password });
  },

  async "admin.update"(ctx, body) {
    if (!ctx.me.isSuper) return fail(FORBIDDEN, 403);
    const target = await targetAdmin(ctx, str(body.userId));
    if (!target) return fail("Ադմինը չի գտնվել։", 404);
    const perms = cleanPerms(body.perms);
    const { error } = await ctx.db.from("admins").update({ perms }).eq("user_id", target.userId);
    if (error) return fail(error.message, 500);
    await logActivity({
      actor: ctx.me.userId,
      action: "admin.admin_updated",
      targetType: "admin",
      targetId: target.userId,
      targetLabel: target.email,
      meta: { perms },
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true });
  },

  async "admin.resetPassword"(ctx, body) {
    if (!ctx.me.isSuper) return fail(FORBIDDEN, 403);
    const target = await targetAdmin(ctx, str(body.userId));
    if (!target) return fail("Ադմինը չի գտնվել։", 404);
    const password = oneTimePassword();
    // A full reset: the admin's keys, trusted devices and codes go too, so
    // one who lost everything can start again with the new password.
    await Promise.all([
      ctx.db.from("admin_keys").delete().eq("user_id", target.userId),
      ctx.db.from("admin_devices").delete().eq("user_id", target.userId),
      ctx.db.from("admin_recovery_codes").delete().eq("user_id", target.userId),
    ]);
    await allowCredentialChange(ctx.db, target.userId);
    const { error } = await ctx.db.auth.admin.updateUserById(target.userId, { password });
    if (error) return fail(error.message, 500);
    await ctx.db.from("admins").update({ must_change_password: true, locked: false, login_failures: 0 }).eq("user_id", target.userId);
    await ctx.db.rpc("end_user_sessions", { p_user: target.userId });
    await logActivity({
      actor: ctx.me.userId,
      action: "admin.admin_password_reset",
      targetType: "admin",
      targetId: target.userId,
      targetLabel: target.email,
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true, password });
  },

  // Any admin: their own order of the menu sections ([] = the default).
  async "nav.save"(ctx, body) {
    const order = Array.isArray(body.order) ? body.order.filter((k): k is string => typeof k === "string" && /^[a-z]{2,20}$/.test(k)).slice(0, 30) : [];
    await ctx.db.from("admins").update({ nav_order: order.length ? order : null }).eq("user_id", ctx.me.userId);
    return NextResponse.json({ ok: true });
  },

  // Shut an admin out (or let them back in) without deleting them.
  async "admin.block"(ctx, body) {
    if (!ctx.me.isSuper) return fail(FORBIDDEN, 403);
    const target = await targetAdmin(ctx, str(body.userId));
    if (!target) return fail("Ադմինը չի գտնվել։", 404);
    const blocked = body.blocked === true;
    const { error } = await ctx.db.from("admins").update({ blocked }).eq("user_id", target.userId);
    if (error) return fail(error.message, 500);
    if (blocked) await ctx.db.rpc("end_user_sessions", { p_user: target.userId });
    await logActivity({ actor: ctx.me.userId, action: blocked ? "admin.admin_blocked" : "admin.admin_unblocked", targetType: "admin", targetId: target.userId, targetLabel: target.email, ip: ctx.ip });
    return NextResponse.json({ ok: true });
  },

  async "admin.delete"(ctx, body) {
    if (!ctx.me.isSuper) return fail(FORBIDDEN, 403);
    const target = await targetAdmin(ctx, str(body.userId));
    if (!target) return fail("Ադմինը չի գտնվել։", 404);
    const { error } = await ctx.db.auth.admin.deleteUser(target.userId);
    if (error) return fail(error.message, 500);
    await logActivity({
      actor: ctx.me.userId,
      action: "admin.admin_deleted",
      targetType: "admin",
      targetId: target.userId,
      targetLabel: target.email,
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true });
  },

  // Any admin: replace the one-time (or current) password with their own.
  async "password.change"(ctx, body) {
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < MIN_PASSWORD) return fail(`Գաղտնաբառը պետք է լինի առնվազն ${MIN_PASSWORD} նշան։`);
    // The super admin changes here only the password of the address this
    // session signed in with; the other one needs the key and that address's
    // own confirmation (/api/admin/security).
    if (ctx.me.isSuper && (await viaOf(ctx.me.userId)) === "alt") {
      const { error } = await ctx.db.rpc("admin_set_alt_password", { p_user: ctx.me.userId, p_password: password });
      if (error) return fail(error.message, 500);
      await logActivity({ actor: ctx.me.userId, action: "admin.password_changed", ip: ctx.ip, meta: { address: "alt" } });
      return NextResponse.json({ ok: true });
    }
    await allowCredentialChange(ctx.db, ctx.me.userId);
    const { error } = await (await createClient()).auth.updateUser({ password });
    if (error) {
      return fail(error.code === "same_password" ? "Նոր գաղտնաբառը պետք է տարբերվի մեկանգամյայից։" : error.message);
    }
    await ctx.db.from("admins").update({ must_change_password: false }).eq("user_id", ctx.me.userId);
    await logActivity({ actor: ctx.me.userId, action: "admin.password_changed", ip: ctx.ip });
    return NextResponse.json({ ok: true });
  },
};

async function handlePOST(req: Request) {
  const me = await getAdmin();
  if (!me) return fail("Մուտք գործեք որպես ադմին։", 401);

  const body = (await req.json().catch(() => ({}))) as Body;
  const action = str(body.action);
  const handler = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!handler) return fail("Անհայտ գործողություն։");
  // Until the one-time password is replaced, nothing else is allowed.
  if (me.mustChangePassword && action !== "password.change") return fail("Նախ փոխեք մեկանգամյա գաղտնաբառը։", 403);
  // A new device of a key holder does nothing before the key.
  if (me.needsKey) return fail("Այս սարքից մուտքը նախ հաստատեք անվտանգության բանալիով։", 403);

  return handler({ me, ip: clientIp(req), db: createAdminClient() }, body);
}

// A crash or a 5xx answer here is logged and the admins are told.
export const POST = withErrorReport("admin", handlePOST);
