import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFormatDate, getT } from "@/i18n/server";

type Raw = {
  id: string;
  score: number;
  comment: string;
  created_at: string;
  clubs: { id: string; name: string } | null;
  tours: { id: string; title: string; date: string; clubs: { id: string; name: string } | null } | null;
};

// The person's own reviews: date top-left, the text, and what it was about
// bottom-left — the club, or "Club > Hike (date)".
export default async function MyCommentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [t, fmt] = await Promise.all([getT(), getFormatDate()]);

  const { data } = await supabase
    .from("ratings")
    .select("id, score, comment, created_at, clubs(id, name), tours(id, title, date, clubs(id, name))")
    .eq("user_id", user.id)
    .not("comment", "is", null)
    .order("created_at", { ascending: false });
  const rows = ((data ?? []) as unknown as Raw[]).filter((r) => r.comment?.trim());

  if (rows.length === 0) {
    return <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">{t("account.commentsEmpty")}</p>;
  }

  const day = (iso: string) => fmt(iso, "long");

  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const club = r.clubs ?? r.tours?.clubs ?? null;
        return (
          <li key={r.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted">{day(r.created_at)}</span>
              <span className="font-semibold text-terracotta-500" aria-label={`${r.score}/5`}>
                {"★".repeat(r.score)}
                <span className="text-line">{"★".repeat(5 - r.score)}</span>
              </span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink">{r.comment}</p>
            <p className="mt-3 text-xs text-muted">
              {club && (
                <Link href={`/clubs/${club.id}`} className="font-semibold text-heading hover:text-terracotta-700">
                  {club.name}
                </Link>
              )}
              {r.tours && (
                <>
                  {" > "}
                  <Link href={`/tours/${r.tours.id}`} className="hover:text-terracotta-700">{r.tours.title}</Link>{" "}
                  ({day(r.tours.date)})
                </>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
