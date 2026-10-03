import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EXPIRY_REMINDER_DAYS, PACKAGES, activePackage } from "@/lib/catalog";
import { newsletterDigestEmail, packageExpiryEmail, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Once a day (vercel.json → 06:00 UTC, 10:00 in Yerevan):
//   1. remind clubs 7 and 2 days before their package lapses (once each)
//   2. email newsletter subscribers the hikes published since the last run
// Vercel Cron sends "Authorization: Bearer $CRON_SECRET"; anyone else is refused.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  /* ---------------------------------------------------- package reminders */
  const horizon = new Date(now.getTime() + Math.max(...EXPIRY_REMINDER_DAYS) * 86400000).toISOString();
  const { data: expiring } = await admin
    .from("clubs")
    .select("id, name, tariff, package_ends_at, profiles!clubs_owner_id_fkey(email)")
    .not("tariff", "is", null)
    .gt("package_ends_at", now.toISOString())
    .lte("package_ends_at", horizon);

  let reminders = 0;
  for (const club of (expiring ?? []) as unknown as {
    id: string;
    name: string;
    tariff: string;
    package_ends_at: string;
    profiles: { email: string } | null;
  }[]) {
    const pkg = activePackage(club, now.getTime());
    const to = club.profiles?.email;
    if (!pkg || !to) continue;
    const daysLeft = Math.ceil((new Date(club.package_ends_at).getTime() - now.getTime()) / 86400000);
    // The tightest reminder that applies (2 before 7), sent once per period.
    const due = [...EXPIRY_REMINDER_DAYS].sort((a, b) => a - b).find((d) => daysLeft <= d);
    if (!due) continue;
    const { error: already } = await admin
      .from("package_reminders")
      .insert({ club_id: club.id, ends_at: club.package_ends_at, days: due });
    if (already) continue; // primary key: this reminder went out before
    await sendEmail(
      packageExpiryEmail({
        to,
        clubName: club.name,
        packageName: PACKAGES[pkg].name,
        endsAt: club.package_ends_at.slice(0, 10),
        daysLeft,
      })
    );
    reminders++;
  }

  /* ---------------------------------------------------- newsletter digest */
  const { data: lastRun } = await admin.from("job_runs").select("last_run_at").eq("name", "newsletter_digest").maybeSingle();
  const since = (lastRun as { last_run_at: string } | null)?.last_run_at ?? new Date(now.getTime() - 86400000).toISOString();

  const { data: fresh } = await admin
    .from("tours")
    .select("id, title, date, regions, clubs(name, tariff, package_ends_at)")
    .eq("status", "active")
    .gte("date", now.toISOString().slice(0, 10))
    .gt("created_at", since)
    .order("date");
  const tours = ((fresh ?? []) as unknown as {
    id: string;
    title: string;
    date: string;
    regions: string[];
    clubs: { name: string; tariff: string | null; package_ends_at: string | null } | null;
  }[])
    .filter((x) => activePackage(x.clubs, now.getTime()))
    .map((x) => ({ id: x.id, title: x.title, date: x.date, regions: x.regions, clubName: x.clubs!.name }));

  let digests = 0;
  if (tours.length) {
    const { data: subscribers } = await admin
      .from("newsletter_subscribers")
      .select("email, token")
      .not("confirmed_at", "is", null)
      .is("unsubscribed_at", null);
    for (const s of (subscribers ?? []) as { email: string; token: string }[]) {
      const result = await sendEmail(
        newsletterDigestEmail({ to: s.email, tours, unsubscribeUrl: `${origin}/newsletter/unsubscribe?token=${s.token}` })
      );
      if (result.ok) digests++;
    }
  }
  await admin.from("job_runs").upsert({ name: "newsletter_digest", last_run_at: now.toISOString() });

  return NextResponse.json({ ok: true, reminders, digest: { tours: tours.length, sent: digests } });
}
