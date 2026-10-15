import Link from "next/link";
import type { TFunction as T } from "@/i18n/translate";
import type { Passport } from "@/lib/hikers";
import { TERRAINS } from "@/lib/catalog";
import BadgeMedal from "@/components/hikers/BadgeMedal";

export function HikerAvatar({ name, photo, size = "md" }: { name: string; photo: string | null; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-20 w-20 text-2xl" : "h-14 w-14 text-lg";
  return photo ? (
    <img src={photo} alt="" className={`${box} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${box} flex shrink-0 items-center justify-center rounded-full bg-spruce-500 font-bold text-[#FFFDF8]`} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

// A passport's body: counts, badges with their texts, and the places visited
// grouped by kind (each a link to its page).
export default function PassportView({ passport, hikes, t }: { passport: Passport; hikes?: number; t: T }) {
  const groups = TERRAINS.map((k) => ({ kind: k, list: passport.places.filter((p) => (p.terrain ?? "other") === k) })).filter((g) => g.list.length);
  const stat = "rounded-2xl border border-line bg-surface px-4 py-3 text-center";
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        {hikes !== undefined && (
          <div className={stat}>
            <p className="text-2xl font-bold text-heading">{hikes}</p>
            <p className="text-xs text-muted">{t("hikersPage.statHikes")}</p>
          </div>
        )}
        <div className={stat}>
          <p className="text-2xl font-bold text-heading">{passport.places.length}</p>
          <p className="text-xs text-muted">{t("hikersPage.statPlaces")}</p>
        </div>
        <div className={stat}>
          <p className="text-2xl font-bold text-heading">{passport.regions}</p>
          <p className="text-xs text-muted">{t("hikersPage.statRegions")}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-heading">{t("hikersPage.badges")}</h2>
        {passport.badges.length === 0 ? (
          <p className="text-muted">{t("badge.none")}</p>
        ) : (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
            {passport.badges.map((b) => (
              <BadgeMedal key={b.kind} badge={b} t={t} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-heading">{t("hikersPage.visited")}</h2>
        {groups.length === 0 ? (
          <p className="text-muted">{t("hikersPage.noPlaces")}</p>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.kind}>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-spruce-700 dark:text-spruce-300">
                  {t(`terrain.${g.kind}`)} · {g.list.length}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {g.list.map((p) => (
                    <Link
                      key={p.id}
                      href={`/places/${p.id}`}
                      className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink hover:border-spruce-500 hover:text-spruce-700 dark:hover:text-spruce-300"
                    >
                      {p.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
