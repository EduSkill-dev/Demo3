import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, clientIp, getAdmin, logActivity, notifyBlocked, oneTimePassword, type AdminSession } from "@/lib/admin";
import { ACCOUNT_LIMITS, ADMIN_PERMS, type AccountLimit, type AccountStatus, type AdminPerm } from "@/lib/adminLabels";
import { deleteClub, deleteIndividual } from "@/lib/accountDeletion";
import { SITE_TEXTS_TAG } from "@/lib/siteTexts";
import { SIGHTS_TAG } from "@/lib/sights";
import { REGIONS } from "@/lib/catalog";
import { DICTIONARIES } from "@/i18n/translate";
import { isLocale } from "@/i18n/config";
import { MIN_PASSWORD } from "@/lib/authErrors";

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
      limit === "book"
        ? await ctx.db.from("profiles").update({ booking_blocked: blocked }).eq("id", t.account.id)
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
      active: body.active !== false,
    };
    if (!row.name_hy || !row.name_ru || !row.name_en) return fail("Լրացրեք անվանումը երեք լեզվով։");
    if (!(REGIONS as readonly string[]).includes(row.region)) return fail("Ընտրեք մարզը։");
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

  // Super admin only: a new admin with a one-time password, shown once.
  async "admin.create"(ctx, body) {
    if (!ctx.me.isSuper) return fail(FORBIDDEN, 403);
    const email = str(body.email).toLowerCase();
    if (!EMAIL_RE.test(email)) return fail("Նշեք ճիշտ էլ. հասցե։");

    const { data: taken } = await ctx.db.from("profiles").select("id").eq("email", email).limit(1);
    const { data: aliasTaken } = await ctx.db.from("admins").select("user_id").eq("alt_email", email).limit(1);
    if ((taken ?? []).length || (aliasTaken ?? []).length) return fail("Այս հասցեն արդեն զբաղված է։");

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
    const { error } = await ctx.db.auth.admin.updateUserById(target.userId, { password });
    if (error) return fail(error.message, 500);
    await ctx.db.from("admins").update({ must_change_password: true }).eq("user_id", target.userId);
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
    const { error } = await (await createClient()).auth.updateUser({ password });
    if (error) {
      return fail(error.code === "same_password" ? "Նոր գաղտնաբառը պետք է տարբերվի մեկանգամյայից։" : error.message);
    }
    await ctx.db.from("admins").update({ must_change_password: false }).eq("user_id", ctx.me.userId);
    await logActivity({ actor: ctx.me.userId, action: "admin.password_changed", ip: ctx.ip });
    return NextResponse.json({ ok: true });
  },
};

export async function POST(req: Request) {
  const me = await getAdmin();
  if (!me) return fail("Մուտք գործեք որպես ադմին։", 401);

  const body = (await req.json().catch(() => ({}))) as Body;
  const action = str(body.action);
  const handler = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!handler) return fail("Անհայտ գործողություն։");
  // Until the one-time password is replaced, nothing else is allowed.
  if (me.mustChangePassword && action !== "password.change") return fail("Նախ փոխեք մեկանգամյա գաղտնաբառը։", 403);

  return handler({ me, ip: clientIp(req), db: createAdminClient() }, body);
}
