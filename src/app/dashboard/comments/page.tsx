import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { getFormatDate, getT } from "@/i18n/server";
import ReplyBox from "@/components/club/ReplyBox";

type Row = {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  tour_title: string | null;
  author_deleted: boolean;
  author_first_name: string | null;
  author_last_initial: string | null;
  club_reply: string | null;
};

// All the comments a club received, in one place, with its answers (Advanced).
export default async function ClubCommentsPage() {
  const mine = await getMyClub();
  if (!mine) redirect("/login");
  const [t, fmt] = await Promise.all([getT(), getFormatDate()]);
  if (!mine.limits.config.dashboard_comments_tab) {
    return (
      <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
        {t("clubComments.notInPlan")}{" "}
        <Link href="/dashboard/packages" className="font-semibold text-terracotta-600 hover:underline dark:text-terracotta-300">{t("nav.club.packages")}</Link>
      </p>
    );
  }
  const { data } = await (await createClient())
    .from("public_reviews")
    .select("id, score, comment, created_at, tour_title, author_deleted, author_first_name, author_last_initial, club_reply")
    .eq("club_id", mine.club.id)
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = ((data ?? []) as Row[]).filter((r) => r.comment?.trim());

  if (rows.length === 0) return <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">{t("clubPage.noComments")}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="rounded-xl border border-line bg-surface p-4 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold text-ink">
              {r.author_deleted ? t("account.deletedUser") : [r.author_first_name, r.author_last_initial ? `${r.author_last_initial}.` : ""].filter(Boolean).join(" ")}
            </span>
            <span className="text-xs text-muted">{fmt(r.created_at, "long")}</span>
          </div>
          <p className="text-terracotta-500" aria-label={`${r.score}/5`}>
            {"★".repeat(r.score)}
            <span className="text-line">{"★".repeat(5 - r.score)}</span>
            {r.tour_title && <span className="ml-2 text-xs text-muted">{t("clubPage.onTour", { title: r.tour_title })}</span>}
          </p>
          <p className="mt-1 whitespace-pre-line leading-6 text-ink">{r.comment}</p>
          <ReplyBox ratingId={r.id} initial={r.club_reply ?? ""} />
        </li>
      ))}
    </ul>
  );
}
