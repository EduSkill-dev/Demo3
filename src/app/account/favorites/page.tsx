import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FavoritesList, { type FavoriteRow } from "@/components/account/FavoritesList";

export default async function FavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: favs }, { data: attended }] = await Promise.all([
    supabase.from("favorite_clubs").select("club_id, created_at, clubs(id, name, photo_url)").eq("user_id", user.id).order("created_at"),
    supabase.from("bookings").select("tours(club_id, date)").eq("user_id", user.id).eq("status", "confirmed"),
  ]);

  // How many finished hikes the person went on with each club.
  const count = new Map<string, number>();
  for (const b of (attended ?? []) as unknown as { tours: { club_id: string; date: string } | null }[]) {
    if (b.tours && b.tours.date < today) count.set(b.tours.club_id, (count.get(b.tours.club_id) ?? 0) + 1);
  }

  type Raw = { club_id: string; clubs: { id: string; name: string; photo_url: string | null } | null };
  const rows: FavoriteRow[] = ((favs ?? []) as unknown as Raw[])
    .filter((f) => f.clubs)
    .map((f) => ({ ...f.clubs!, attended: count.get(f.club_id) ?? 0 }));

  return <FavoritesList rows={rows} />;
}
