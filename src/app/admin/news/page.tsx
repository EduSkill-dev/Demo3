import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getAdmin } from "@/lib/admin";
import { newsChannelReady } from "@/lib/telegram";
import NewsComposer from "@/components/admin/NewsComposer";

type Post = { id: number; author_label: string; body: string; tg_message_id: number | null; created_at: string; to_individuals: boolean; to_clubs: boolean; important: boolean; emailed: number | null };

const stamp = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Yerevan", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Platform posts: to individuals, clubs or both (clubs' posts also go to the
// Telegram channel), ordinary or important. The super admin always may;
// other admins with the "news" permission.
export default async function AdminNewsPage() {
  const me = await getAdmin();
  if (!me || !can(me, "news")) redirect("/admin");

  const { data } = await createAdminClient().from("news_posts").select("id, author_label, body, tg_message_id, created_at, to_individuals, to_clubs, important, emailed").order("created_at", { ascending: false }).limit(30);
  const posts = (data ?? []) as Post[];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-xl font-semibold text-heading">Հարթակի նորություններ</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Գրառումը գնում է ընտրված օգտատերերի էջին (զանգակ), իսկ ակումբների դեպքում՝ նաև Telegram-ի «Culmen&apos;s Community» ալիք։ Էլ. նամակը գնում է
          «Ծանուցումներ հարթակից» միացրածներին, իսկ «Կարևոր» գրառումը՝ բոլորին։ Telegram-ում հրապարակվածը ջնջել կամ փոխել կարելի է միայն Telegram-ում։
        </p>
      </div>

      <NewsComposer channelReady={newsChannelReady()} />

      <section>
        <h3 className="mb-2 font-serif text-lg font-semibold text-heading">Վերջին գրառումները</h3>
        {posts.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">Դեռ գրառում չկա։</p>
        ) : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id} className="rounded-xl border border-line bg-surface p-4">
                <p className="text-xs text-muted">
                  {stamp.format(new Date(p.created_at))} · {p.author_label}
                  {" · "}
                  {[p.to_individuals && "անհատներ", p.to_clubs && "ակումբներ"].filter(Boolean).join(" + ")}
                  {p.emailed != null && ` · նամակներ՝ ${p.emailed}`}
                  {p.important && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">Կարևոր</span>}
                  {p.to_clubs && !p.tg_message_id && <span className="ml-2 font-semibold text-red-600">Telegram-ում չի հրապարակվել</span>}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-ink">{p.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
