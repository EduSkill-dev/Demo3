import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getAdmin } from "@/lib/admin";
import { getFormatDate } from "@/i18n/server";
import Pager, { readPageSize } from "@/components/admin/Pager";
import SearchBox from "@/components/admin/SearchBox";
import GuestsTable, { type GuestRow } from "@/components/admin/GuestsTable";

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  birth_date: string;
  gender: string;
  bookings: {
    id: string;
    status: string;
    created_at: string;
    tours: { id: string; title: string; date: string; clubs: { id: string; name: string } | null } | null;
  }[];
};

// People who booked without an account. Someone who later opens an account
// takes their bookings with them (0070), so they are listed under individuals.
export default async function AdminGuestsPage({ searchParams }: { searchParams: { q?: string; page?: string; size?: string } }) {
  const me = await getAdmin();
  if (!me || !can(me, "individuals")) redirect("/admin");

  const fmt = await getFormatDate();
  const db = createAdminClient();
  const q = (searchParams.q ?? "").trim().replace(/[,()%*\\]/g, " ").slice(0, 80);
  const page = Math.max(1, Number(searchParams.page) || 1);
  const size = readPageSize(searchParams.size);

  let query = db
    .from("guests")
    .select("id, first_name, last_name, email, phone, birth_date, gender, bookings!inner(id, status, created_at, tours(id, title, date, clubs(id, name)))", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);
  for (const word of q.split(/\s+/).filter(Boolean)) {
    query = query.or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%,email.ilike.%${word}%,phone.ilike.%${word}%`);
  }
  const { data, count } = await query;
  const guests = (data ?? []) as unknown as Row[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / size));

  const ids = guests.map((g) => g.id);
  const { data: payRows } = ids.length
    ? await db.from("payments").select("guest_id, tour_id, amount").eq("kind", "booking").eq("status", "succeeded").in("guest_id", ids)
    : { data: [] };
  const paid = new Map<string, number>();
  for (const p of (payRows ?? []) as { guest_id: string; tour_id: string; amount: number }[]) {
    const key = `${p.guest_id}:${p.tour_id}`;
    paid.set(key, (paid.get(key) ?? 0) + Number(p.amount));
  }

  const rows: GuestRow[] = guests.map((g) => {
    const hikes = [...g.bookings]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((b) => ({
        id: b.id,
        tourId: b.tours?.id ?? null,
        title: b.tours?.title ?? "—",
        date: b.tours ? fmt(b.tours.date, "short") : "—",
        clubId: b.tours?.clubs?.id ?? null,
        clubName: b.tours?.clubs?.name ?? null,
        cancelled: b.status === "cancelled",
        paid: paid.get(`${g.id}:${b.tours?.id}`) ?? 0,
      }));
    return {
      id: g.id,
      name: `${g.first_name} ${g.last_name}`,
      email: g.email,
      phone: g.phone,
      birth: fmt(g.birth_date, "short"),
      gender: g.gender,
      lastBooked: fmt(g.bookings.reduce((last, b) => (b.created_at > last ? b.created_at : last), ""), "short"),
      paid: hikes.reduce((sum, h) => sum + h.paid, 0),
      hikes,
    };
  });

  const link = (p: number, n: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    if (n !== 50) params.set("size", String(n));
    const search = params.toString();
    return search ? `/admin/guests?${search}` : "/admin/guests";
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-heading">Հյուրեր ({count ?? 0})</h2>
        <SearchBox placeholder="Անուն, էլ. հասցե, հեռախոս" keep={{ size: size !== 50 ? String(size) : undefined }} />
      </div>
      <p className="mt-1 text-xs text-muted">Առանց հաշվի ամրագրած մարդիկ։ Հաշիվ բացողի ամրագրումները տեղափոխվում են «Անհատներ»։</p>
      <GuestsTable rows={rows} />
      {(count ?? 0) > 25 && <Pager page={Math.min(page, pages)} pages={pages} size={size} href={link} anchor="guests" />}
    </div>
  );
}
