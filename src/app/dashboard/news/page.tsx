import { redirect } from "next/navigation";
import { getMyClub } from "@/lib/myClub";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFormatDate, getT } from "@/i18n/server";

type Post = { id: number; body: string; created_at: string };

// The platform's news for clubs — the same posts as the Telegram channel,
// newest first. Read-only: questions go to the help chat.
export default async function ClubNewsPage() {
  const mine = await getMyClub();
  if (!mine) redirect("/login");
  const [t, fmt] = await Promise.all([getT(), getFormatDate()]);
  const { data } = await createAdminClient().from("news_posts").select("id, body, created_at").not("tg_message_id", "is", null).order("created_at", { ascending: false }).limit(50);
  const posts = (data ?? []) as Post[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
        <p className="text-ink">{t("clubNews.intro")}</p>
        <div className="flex flex-wrap gap-2">
          <a href="https://t.me/culmens_community" target="_blank" rel="noopener noreferrer" className="rounded-lg border-2 border-spruce-900 px-4 py-1.5 text-sm font-semibold text-ink hover:bg-sand dark:border-line">
            Telegram
          </a>
          <a href="/help" className="rounded-lg bg-spruce-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-spruce-900">
            {t("clubNews.ask")}
          </a>
        </div>
      </div>
      {posts.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">{t("clubNews.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id} className="rounded-xl border border-line bg-surface p-5">
              <p className="text-xs font-semibold text-muted">{fmt(p.created_at, "dateTime")}</p>
              <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed text-ink">{p.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
