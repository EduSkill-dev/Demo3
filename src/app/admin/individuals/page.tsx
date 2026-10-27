import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getAdmin } from "@/lib/admin";
import { getFormatDate } from "@/i18n/server";
import type { AccountStatus } from "@/lib/adminLabels";
import AccountsTable, { type AccountRow } from "@/components/admin/AccountsTable";
import { todayInYerevan } from "@/lib/calendar";

export default async function AdminIndividualsPage({ searchParams }: { searchParams: { q?: string } }) {
  const me = await getAdmin();
  if (!me || !can(me, "individuals")) redirect("/admin");

  const fmt = await getFormatDate();
  const db = createAdminClient();
  const { data } = await db
    .from("profiles")
    .select("id, first_name, last_name, email, phone, status, booking_blocked, requests_blocked, chat_blocked, created_at")
    .eq("role", "individual")
    .order("created_at", { ascending: false })
    .limit(2000);

  // Per person: hikes taken part in (over, not marked absent) and booked to come.
  const ids = ((data ?? []) as { id: string }[]).map((p) => p.id);
  const { data: bookingRows } = ids.length
    ? await db.from("bookings").select("user_id, attended, tours(date, end_date)").eq("status", "confirmed").in("user_id", ids)
    : { data: [] };
  const today = todayInYerevan();
  const hikes = new Map<string, { past: number; upcoming: number }>();
  for (const b of (bookingRows ?? []) as unknown as { user_id: string; attended: boolean | null; tours: { date: string; end_date: string | null } | null }[]) {
    if (!b.tours) continue;
    const h = hikes.get(b.user_id) ?? { past: 0, upcoming: 0 };
    const last = b.tours.end_date ?? b.tours.date;
    if (last >= today) h.upcoming++;
    else if (b.attended !== false) h.past++;
    hikes.set(b.user_id, h);
  }

  const q = (searchParams.q ?? "").trim().toLowerCase();
  const rows: AccountRow[] = ((data ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
    status: AccountStatus;
    booking_blocked: boolean;
    requests_blocked: boolean;
    chat_blocked: boolean;
    created_at: string;
  }[])
    .map((p) => ({
      userId: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" "),
      email: p.email,
      phone: p.phone,
      status: p.status,
      joined: fmt(p.created_at, "short"),
      joinedAt: p.created_at,
      hikes: hikes.get(p.id) ?? { past: 0, upcoming: 0 },
      limits: [
        { key: "book" as const, blocked: p.booking_blocked },
        { key: "request" as const, blocked: p.requests_blocked },
        { key: "chat" as const, blocked: p.chat_blocked },
      ],
    }))
    .filter((r) => !q || `${r.name} ${r.email} ${r.phone ?? ""}`.toLowerCase().includes(q));

  return <AccountsTable title="Անհատներ" nameHeader="Անուն" rows={rows} />;
}
