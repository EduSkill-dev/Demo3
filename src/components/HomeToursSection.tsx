"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TourWithClub } from "@/types/database";
import { TERRAINS, type Terrain } from "@/lib/catalog";
import { useT } from "@/i18n/client";

export default function HomeToursSection({
  tours,
}: {
  tours: TourWithClub[];
}) {
  const tr = useT();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [types, setTypes] = useState<Terrain[]>([]);
  const [overnightOnly, setOvernightOnly] = useState(false);
  const [clubs, setClubs] = useState<string[]>([]);

  const allRegions = useMemo(
    () => [...new Set(tours.flatMap((t) => t.regions))].sort(),
    [tours]
  );
  const allClubs = useMemo(
    () => [...new Set(tours.map((t) => t.club_name).filter(Boolean))].sort(),
    [tours]
  );

  const filtered = tours.filter(
    (t) =>
      (!dateFrom || t.date >= dateFrom) &&
      (!dateTo || t.date <= dateTo) &&
      (regions.length === 0 || t.regions.some((r) => regions.includes(r))) &&
      (types.length === 0 || t.terrains.some((k) => types.includes(k as Terrain))) &&
      (!overnightOnly || t.overnight) &&
      (clubs.length === 0 || clubs.includes(t.club_name))
  );

  function toggle<T>(list: T[], value: T, set: (v: T[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function reset() {
    setDateFrom("");
    setDateTo("");
    setRegions([]);
    setTypes([]);
    setOvernightOnly(false);
    setClubs([]);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
      {/* Tour grid */}
      <div>
        <h2 className="text-2xl font-bold text-pine">Առաջիկա արշավներ</h2>
        {filtered.length === 0 ? (
          <p className="mt-6 text-neutral-500">
            Ընտրված պայմաններով արշավ չի գտնվել։
          </p>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((t) => (
              <article
                key={t.id}
                className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white"
              >
                {t.photo_urls?.[0] ? (
                  <img src={t.photo_urls[0]} alt="" className="h-32 w-full object-cover" />
                ) : (
                  <div className="h-32 bg-gradient-to-br from-pine to-apricot/70" />
                )}
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-xs font-semibold uppercase text-apricot">
                    {t.regions.map((r) => tr(`region.${r}`)).join(", ")}
                  </p>
                  <h3 className="mt-1 font-semibold">{t.title}</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    {t.date}
                    {t.overnight ? " · գիշերակացով" : ""}
                  </p>
                  <Link
                    href={`/tours/${t.id}`}
                    className="mt-4 self-start rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold hover:bg-stone"
                  >
                    Տեսնել ավելին
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Filters (right) */}
      <aside className="h-fit space-y-5 rounded-xl border border-neutral-200 bg-white p-5 lg:sticky lg:top-24">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Ֆիլտրեր</h3>
          <button onClick={reset} className="text-xs text-apricot">
            Մաքրել
          </button>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium">Ամսաթիվ (միջակայք)</p>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mb-2 w-full rounded-lg border border-neutral-300 p-2 text-sm"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 p-2 text-sm"
          />
        </div>

        <div>
          <p className="mb-1 text-sm font-medium">Մարզ</p>
          {allRegions.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={regions.includes(r)}
                onChange={() => toggle(regions, r, setRegions)}
              />
              {tr(`region.${r}`)}
            </label>
          ))}
        </div>

        <div>
          <p className="mb-1 text-sm font-medium">Տեսակ</p>
          {TERRAINS.map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={types.includes(k)}
                onChange={() => toggle(types, k, setTypes)}
              />
              {tr(`terrain.${k}`)}
            </label>
          ))}
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overnightOnly}
              onChange={(e) => setOvernightOnly(e.target.checked)}
            />
            Գիշերակացով
          </label>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium">Ակումբ</p>
          {allClubs.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={clubs.includes(c)}
                onChange={() => toggle(clubs, c, setClubs)}
              />
              {c}
            </label>
          ))}
        </div>
      </aside>

    </div>
  );
}
