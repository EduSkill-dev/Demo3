import Link from "next/link";
import type { TFunction as T } from "@/i18n/translate";
import type { Passport } from "@/lib/hikers";
import { TERRAINS } from "@/lib/catalog";
import BadgeMedal from "@/components/hikers/BadgeMedal";

// Round on the cards; on the passport itself a large square with soft corners.
export function HikerAvatar({ name, photo, size = "md" }: { name: string; photo: string | null; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-32 w-32 rounded-3xl text-4xl sm:h-36 sm:w-36" : "h-14 w-14 rounded-full text-lg";
  return photo ? (
    <img src={photo} alt="" className={`${box} shrink-0 object-cover shadow-sm`} />
  ) : (
    <span className={`${box} flex shrink-0 items-center justify-center bg-spruce-500 font-bold text-[#FFFDF8]`} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

// A passport's body: counts, badges with their texts, and the places visited
// grouped by kind (each a link to its page).
// `own`: the person's own page (the texts address them); otherwise a visitor's view.
// The three counters: hikes, places, regions.
export function PassportStats({ passport, hikes, t }: { passport: Passport; hikes?: number; t: T }) {
  const stat = "rounded-xl border border-line bg-surface px-3 py-2 text-center";
  return (
      <div className="grid max-w-xs grid-cols-3 gap-2">
        {hikes !== undefined && (
          <div className={stat}>
            <p className="text-xl font-bold leading-tight text-heading">{hikes}</p>
            <p className="text-xs text-muted">{t("hikersPage.statHikes")}</p>
          </div>
        )}
        <div className={stat}>
          <p className="text-xl font-bold leading-tight text-heading">{passport.places.length}</p>
          <p className="text-xs text-muted">{t("hikersPage.statPlaces")}</p>
        </div>
        <div className={stat}>
          <p className="text-xl font-bold leading-tight text-heading">{passport.regions}</p>
          <p className="text-xs text-muted">{t("hikersPage.statRegions")}</p>
        </div>
      </div>
  );
}

// `stats`: false when the page shows the counters elsewhere (next to the photo).
export default function PassportView({ passport, hikes, t, own = false, stats = true }: { passport: Passport; hikes?: number; t: T; own?: boolean; stats?: boolean }) {
  const groups = TERRAINS.map((k) => ({ kind: k, list: passport.places.filter((p) => (p.terrain ?? "other") === k) })).filter((g) => g.list.length);
  return (
    <div className="space-y-8">
      {stats && <PassportStats passport={passport} hikes={hikes} t={t} />}

      <section>
        <h2 className="mb-3 text-lg font-bold text-heading">{t("hikersPage.badges")}</h2>
        {passport.badges.length === 0 ? (
          <p className="text-muted">{own ? t("badge.none") : t("badge.noneOther")}</p>
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
          <p className="text-muted">{own ? t("hikersPage.noPlaces") : t("hikersPage.noPlacesOther")}</p>
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
