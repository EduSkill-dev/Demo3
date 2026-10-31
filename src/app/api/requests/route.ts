import { unfinishedProfileError } from "@/lib/profileGate";
import { withErrorReport } from "@/lib/errors";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer, type Viewer } from "@/lib/viewer";
import { clientIp, logActivity } from "@/lib/admin";
import { REGIONS, TERRAINS } from "@/lib/catalog";
import { CANCEL_WINDOW_HOURS, MAX_OPEN_REQUESTS, MAX_REQUEST_CANCELS, hasContactDetails } from "@/lib/requests";
import { newOfferEmail, offerAcceptedEmail, sendEmail } from "@/lib/email";

// Custom tour requests and the clubs' offers:
//   { action: "create" | "close" | "offer" | "withdraw" | "accept" | "decline", ... }
// Individuals create and close requests and accept or decline offers; clubs
// with an active package send and withdraw offers. Everything is written
// here, with the service role, after the checks.

type Body = Record<string, unknown>;
type Ctx = { viewer: Viewer; db: ReturnType<typeof createAdminClient>; ip: string | null };

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const int = (v: unknown) => (typeof v === "number" || (typeof v === "string" && v.trim() !== "") ? Math.round(Number(v)) : NaN);
// Prices are whole hundreds of dram.
const hundreds = (v: unknown) => Math.round(int(v) / 100) * 100;
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());
const today = () => new Date().toISOString().slice(0, 10);
const list = (v: unknown, allowed: readonly string[]) =>
  Array.isArray(v) ? allowed.filter((k) => (v as unknown[]).includes(k)) : [];

async function ownRequest({ viewer, db }: Ctx, id: string) {
  const { data } = await db.from("tour_requests").select("id, user_id, status").eq("id", id).maybeSingle();
  const r = data as { id: string; user_id: string; status: string } | null;
  return r && r.user_id === viewer.id ? r : null;
}

// True while the person has used up the cancellations of the last 24 hours.
async function cancelLimitReached({ viewer, db }: Ctx): Promise<boolean> {
  const since = new Date(Date.now() - CANCEL_WINDOW_HOURS * 3600_000).toISOString();
  const { count } = await db
    .from("tour_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", viewer.id)
    .eq("status", "closed")
    .gte("closed_at", since);
  return (count ?? 0) >= MAX_REQUEST_CANCELS;
}

const ACTIONS: Record<string, (ctx: Ctx, body: Body) => Promise<NextResponse>> = {
  async create(ctx, body) {
    const { viewer, db } = ctx;
    if (viewer.role !== "individual") return fail("Պատվեր կարող են թողնել միայն անհատները։", 403);
    if (!viewer.emailConfirmed) return fail("Ամրագրելու համար նախ հաստատեք Ձեր էլ. հասցեն։", 403);
    // An account that came in through Google finishes its profile first.
    const { data: account } = await db.auth.admin.getUserById(viewer.id);
    const unfinished = account.user ? await unfinishedProfileError(account.user) : null;
    if (unfinished) return fail(unfinished, 409);
    const { data: profile } = await db.from("profiles").select("requests_blocked").eq("id", viewer.id).maybeSingle();
    if ((profile as { requests_blocked?: boolean } | null)?.requests_blocked) {
      return fail("Անհատական հայտ թողնելու հնարավորությունն անջատված է ադմինիստրատորի կողմից։", 403);
    }

    if (await cancelLimitReached(ctx)) {
      return fail(`Վերջին ${CANCEL_WINDOW_HOURS} ժամում չեղարկել եք ${MAX_REQUEST_CANCELS} հայտ, ուստի նոր հայտ թողնելը ժամանակավորապես անջատված է։ Փորձեք ավելի ուշ։`, 429);
    }

    const people = int(body.people);
    const dateFrom = str(body.dateFrom);
    const dateTo = str(body.dateTo) || dateFrom;
    const regions = list(body.regions, REGIONS);
    const terrains = list(body.terrains, TERRAINS);
    const note = str(body.note).slice(0, 2000);
    const budgetRaw = body.budget === "" || body.budget == null ? null : hundreds(body.budget);
    if (!(people >= 1 && people <= 200)) return fail("Նշեք մասնակիցների թիվը (1–200)։");
    if (!isDate(dateFrom) || !isDate(dateTo) || dateFrom < today() || dateTo < dateFrom) return fail("Նշեք ճիշտ ամսաթվեր։");
    if (budgetRaw !== null && !(budgetRaw >= 0 && budgetRaw <= 100_000_000)) return fail("Նշեք ճիշտ բյուջե։");
    if (note && hasContactDetails(note)) return fail("Տեքստում կոնտակտային տվյալներ գրել չի կարելի։");

    // Only sights that exist; a request needs at least a region or a sight.
    const wanted = Array.isArray(body.sightIds) ? (body.sightIds as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 30) : [];
    const { data: known } = wanted.length ? await db.from("sights").select("id").in("id", wanted) : { data: [] };
    const sightIds = ((known ?? []) as { id: string }[]).map((s) => s.id);
    if (regions.length === 0 && sightIds.length === 0) return fail("Ընտրեք առնվազն մեկ մարզ կամ տեսարժան վայր։");

    const { count } = await db
      .from("tour_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", viewer.id)
      .eq("status", "open");
    if ((count ?? 0) >= MAX_OPEN_REQUESTS) return fail(`Միաժամանակ կարող եք ունենալ առավելագույնը ${MAX_OPEN_REQUESTS} բաց պատվեր։`);

    const { data, error } = await db
      .from("tour_requests")
      .insert({
        user_id: viewer.id,
        author_name: viewer.firstName ?? "",
        people,
        date_from: dateFrom,
        date_to: dateTo,
        regions,
        terrains,
        sight_ids: sightIds,
        overnight: body.overnight === true,
        budget: budgetRaw,
        note: note || null,
      })
      .select("id")
      .single();
    if (error) return fail(error.message, 500);
    await logActivity({ actor: viewer.id, action: "request.created", targetType: "request", targetId: (data as { id: string }).id, ip: ctx.ip });
    return NextResponse.json({ ok: true, id: (data as { id: string }).id });
  },

  async close(ctx, body) {
    const r = await ownRequest(ctx, str(body.requestId));
    if (!r) return fail("Պատվերը չի գտնվել։", 404);
    if (r.status !== "open") return fail("Պատվերն արդեն փակ է։");
    if (await cancelLimitReached(ctx)) return fail(`Մեկ օրում կարելի է չեղարկել առավելագույնը ${MAX_REQUEST_CANCELS} հայտ։`, 429);
    await ctx.db.from("tour_offers").update({ status: "declined" }).eq("request_id", r.id).eq("status", "pending");
    const { error } = await ctx.db.from("tour_requests").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", r.id);
    if (error) return fail(error.message, 500);
    await logActivity({ actor: ctx.viewer.id, action: "request.closed", targetType: "request", targetId: r.id, ip: ctx.ip });
    return NextResponse.json({ ok: true });
  },

  async offer(ctx, body) {
    const { viewer, db } = ctx;
    if (viewer.role !== "club" || !viewer.club) return fail("Առաջարկ կարող են ուղարկել միայն ակումբները։", 403);
    const { data: clubRow } = await db.from("clubs").select("posting_blocked").eq("id", viewer.club.id).single();
    const club = clubRow as { posting_blocked: boolean };
    if (club.posting_blocked) return fail("Նոր հայտարարություն ավելացնելու հնարավորությունն անջատված է ադմինիստրատորի կողմից։", 403);

    const price = hundreds(body.price);
    const date = str(body.date);
    const message = str(body.message).slice(0, 2000);
    if (!(price >= 0 && price <= 100_000_000)) return fail("Նշեք գինը մեկ անձի համար։");
    if (!isDate(date) || date < today()) return fail("Նշեք ճիշտ ամսաթիվ։");

    const { data: reqRow } = await db.from("tour_requests").select("id, user_id, status").eq("id", str(body.requestId)).maybeSingle();
    const request = reqRow as { id: string; user_id: string; status: string } | null;
    if (!request || request.status !== "open") return fail("Այս պատվերն այլևս բաց չէ։", 409);

    const { data: existing } = await db
      .from("tour_offers")
      .select("id, status")
      .eq("request_id", request.id)
      .eq("club_id", viewer.club.id)
      .maybeSingle();
    const prior = existing as { id: string; status: string } | null;
    const { error } = prior
      ? await db.from("tour_offers").update({ price, date, message: message || null, status: "pending" }).eq("id", prior.id)
      : await db.from("tour_offers").insert({ request_id: request.id, club_id: viewer.club.id, price, date, message: message || null });
    if (error) return fail(error.message, 500);

    // Tell the author once per new offer (not on every edit of a pending one).
    if (prior?.status !== "pending") {
      await db.from("notifications").insert({
        user_id: request.user_id,
        club_id: null,
        tour_id: null,
        kind: "platform",
        sender_type: "platform",
        message: `«${viewer.club.name}» ակումբն առաջարկ է ուղարկել Ձեր անհատական պատվերին։ Տեսեք «Իմ պատվերները» բաժնում։`,
      });
      const { data: author } = await db.from("profiles").select("email").eq("id", request.user_id).maybeSingle();
      const to = (author as { email?: string } | null)?.email;
      if (to) await sendEmail(newOfferEmail({ to, clubName: viewer.club.name, price, date }));
    }
    await logActivity({
      actor: viewer.id,
      action: "offer.sent",
      targetType: "request",
      targetId: request.id,
      meta: { amount: price },
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true });
  },

  async withdraw(ctx, body) {
    const { viewer, db } = ctx;
    if (viewer.role !== "club" || !viewer.club) return fail("Թույլատրված չէ։", 403);
    const { data, error } = await db
      .from("tour_offers")
      .update({ status: "withdrawn" })
      .eq("id", str(body.offerId))
      .eq("club_id", viewer.club.id)
      .eq("status", "pending")
      .select("id");
    if (error) return fail(error.message, 500);
    if ((data ?? []).length === 0) return fail("Առաջարկը չի գտնվել։", 404);
    return NextResponse.json({ ok: true });
  },

  // The author picks one offer: the others are declined and the request
  // closes; from here the two sides see each other's contacts.
  async accept(ctx, body) {
    const { viewer, db } = ctx;
    const { data: offerRow } = await db
      .from("tour_offers")
      .select("id, request_id, club_id, status, price, date, clubs(name, owner_id, profiles!clubs_owner_id_fkey(email))")
      .eq("id", str(body.offerId))
      .maybeSingle();
    const offer = offerRow as unknown as {
      id: string;
      request_id: string;
      club_id: string;
      status: string;
      price: number;
      date: string;
      clubs: { name: string; owner_id: string; profiles: { email: string } | null } | null;
    } | null;
    const request = offer ? await ownRequest(ctx, offer.request_id) : null;
    if (!offer || !request) return fail("Առաջարկը չի գտնվել։", 404);
    if (request.status !== "open" || offer.status !== "pending") return fail("Այս առաջարկն այլևս հասանելի չէ։", 409);

    // The request flips first and only if it is still open, so two clicks
    // cannot accept two offers.
    const { data: flipped } = await db.from("tour_requests").update({ status: "accepted" }).eq("id", request.id).eq("status", "open").select("id");
    if ((flipped ?? []).length === 0) return fail("Այս առաջարկն այլևս հասանելի չէ։", 409);
    await db.from("tour_offers").update({ status: "accepted" }).eq("id", offer.id);
    await db.from("tour_offers").update({ status: "declined" }).eq("request_id", request.id).eq("status", "pending");

    const { data: me } = await db.from("profiles").select("first_name, last_name, phone, email").eq("id", viewer.id).single();
    const p = me as { first_name: string | null; last_name: string | null; phone: string | null; email: string };
    if (offer.clubs?.owner_id) {
      await db.from("notifications").insert({
        user_id: offer.clubs.owner_id,
        club_id: null,
        tour_id: null,
        kind: "platform",
        sender_type: "platform",
        message: `Ձեր առաջարկն ընդունվել է (${offer.date})։ Պատվիրատուի կոնտակտները՝ «Իմ առաջարկները» բաժնում։`,
      });
    }
    const to = offer.clubs?.profiles?.email;
    if (to) {
      await sendEmail(
        offerAcceptedEmail({
          to,
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email,
          phone: p.phone,
          email: p.email,
          price: offer.price,
          date: offer.date,
        })
      );
    }
    await logActivity({
      actor: viewer.id,
      action: "offer.accepted",
      targetType: "request",
      targetId: request.id,
      targetLabel: offer.clubs?.name ?? null,
      meta: { amount: offer.price },
      ip: ctx.ip,
    });
    return NextResponse.json({ ok: true });
  },

  async decline(ctx, body) {
    const { data: offerRow } = await ctx.db.from("tour_offers").select("id, request_id, status").eq("id", str(body.offerId)).maybeSingle();
    const offer = offerRow as { id: string; request_id: string; status: string } | null;
    if (!offer || !(await ownRequest(ctx, offer.request_id))) return fail("Առաջարկը չի գտնվել։", 404);
    if (offer.status !== "pending") return fail("Այս առաջարկն այլևս հասանելի չէ։", 409);
    const { error } = await ctx.db.from("tour_offers").update({ status: "declined" }).eq("id", offer.id);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true });
  },
};

async function handlePOST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return fail("Մուտք գործիր։", 401);
  if (viewer.frozen) return fail("Ձեր հաշիվը սառեցված է․ գործողությունները ժամանակավորապես անհասանելի են։", 403);

  const body = (await req.json().catch(() => ({}))) as Body;
  const action = str(body.action);
  const handler = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!handler) return fail("Անհայտ գործողություն։");
  return handler({ viewer, db: createAdminClient(), ip: clientIp(req) }, body);
}

// A crash or a 5xx answer here is logged and the admins are told.
export const POST = withErrorReport("requests", handlePOST);
