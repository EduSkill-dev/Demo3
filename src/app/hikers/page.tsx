import type { Metadata } from "next";
import Link from "next/link";
import { getPublicHikers } from "@/lib/hikers";
import { getT } from "@/i18n/server";
import { getViewer } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";
import { BadgeIcon, badgeName } from "@/components/hikers/BadgeMedal";
import { HikerAvatar } from "@/components/hikers/PassportView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("hikersPage.title"), description: t("hikersPage.intro") };
}

// Hikers who show their passport: the most places first. Each card leads to
// the full passport.
export default async function HikersPage() {
  const [t, hikers, viewer] = await Promise.all([getT(), getPublicHikers(), getViewer()]);
  // The invitation is for individuals whose passport is still hidden.
  let invite = false;
  if (viewer?.role === "individual") {
    const { data } = await (await createClient()).from("profiles").select("show_passport").eq("id", viewer.id).maybeSingle();
    invite = !(data as { show_passport?: boolean } | null)?.show_passport;
  }
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold text-heading">{t("hikersPage.title")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{t("hikersPage.intro")}</p>
      {invite && (
        <p className="mt-2 text-sm">
          <Link href="/account/passport" className="font-semibold text-terracotta-700 underline underline-offset-4 hover:text-terracotta-500 dark:text-terracotta-300">
            {t("hikersPage.joinHint")}
          </Link>
        </p>
      )}

      {hikers.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-8 text-center text-muted">{t("hikersPage.empty")}</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hikers.map((h) => (
            <Link
              key={h.id}
              href={`/hikers/${h.id}`}
              className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:border-spruce-500 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <HikerAvatar name={h.name} photo={h.photo} />
                <div className="min-w-0">
                  <p className="truncate text-[17px] font-bold text-heading">{h.name}</p>
                  <p className="text-[13px] text-muted">
                    {t("hikersPage.hikes", { count: h.hikes })} · {t("hikersPage.places", { count: h.places })} · {t("hikersPage.regions", { count: h.regions })}
                  </p>
                </div>
              </div>
              {h.badges.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  {h.badges.map((b) => (
                    <span key={b.kind} title={badgeName(b, t)}>
                      <BadgeIcon badge={b} size="sm" />
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
