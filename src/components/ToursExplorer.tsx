"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TourWithClub } from "@/types/database";
import { DIFFICULTIES, TERRAINS, formatAmd, type Difficulty, type Terrain } from "@/lib/catalog";
import { useT } from "@/i18n/client";
import FilterDropdown from "./FilterDropdown";

export default function ToursExplorer({ tours }: { tours: TourWithClub[] }) {
  const tr = useT();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [clubs, setClubs] = useState<string[]>([]);
  const [types, setTypes] = useState<Terrain[]>([]);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [overnightOnly, setOvernightOnly] = useState(false);
  const [popularOnly, setPopularOnly] = useState(false);
  const [openFilter, setOpenFilter] = useState<
    "region" | "type" | "club" | "difficulty" | null
  >(null);

  function toggleFilter(key: "region" | "type" | "club" | "difficulty") {
    setOpenFilter((cur) => (cur === key ? null : key));
  }

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
      (clubs.length === 0 || clubs.includes(t.club_name)) &&
      (types.length === 0 || t.terrains.some((k) => types.includes(k as Terrain))) &&
      (difficulties.length === 0 || difficulties.includes(t.difficulty)) &&
      (!overnightOnly || t.overnight) &&
      (!popularOnly || t.popular)
  );

  const activeCount =
    regions.length +
    clubs.length +
    types.length +
    difficulties.length +
    (overnightOnly ? 1 : 0) +
    (popularOnly ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  function clearAll() {
    setDateFrom("");
    setDateTo("");
    setRegions([]);
    setClubs([]);
    setTypes([]);
    setDifficulties([]);
    setOvernightOnly(false);
    setPopularOnly(false);
  }

  return (
    <div>
      {/* Top filter bar */}
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-sand bg-white p-3">
        <FilterDropdown
          label="Մարզ"
          options={allRegions}
          labels={Object.fromEntries(allRegions.map((r) => [r, tr(`region.${r}`)]))}
          selected={regions}
          onChange={setRegions}
          isOpen={openFilter === "region"}
          onToggle={() => toggleFilter("region")}
        />
        <FilterDropdown
          label="Տեղանք"
          options={[...TERRAINS]}
          labels={Object.fromEntries(TERRAINS.map((k) => [k, tr(`terrain.${k}`)])) as Record<Terrain, string>}
          selected={types}
          onChange={setTypes}
          isOpen={openFilter === "type"}
          onToggle={() => toggleFilter("type")}
        />
        <FilterDropdown
          label="Ակումբ"
          options={allClubs}
          selected={clubs}
          onChange={setClubs}
          isOpen={openFilter === "club"}
          onToggle={() => toggleFilter("club")}
        />
        <FilterDropdown
          label="Բարդություն"
          options={[...DIFFICULTIES]}
          labels={Object.fromEntries(DIFFICULTIES.map((k) => [k, tr(`difficulty.${k}`)])) as Record<Difficulty, string>}
          selected={difficulties}
          onChange={setDifficulties}
          isOpen={openFilter === "difficulty"}
          onToggle={() => toggleFilter("difficulty")}
        />

        <div className="flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[130px] outline-none"
          />
          <span className="text-neutral-400">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[130px] outline-none"
          />
        </div>

        <label className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
          <input type="checkbox" checked={overnightOnly} onChange={(e) => setOvernightOnly(e.target.checked)} />
          Գիշերակացով
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm">
          <input type="checkbox" checked={popularOnly} onChange={(e) => setPopularOnly(e.target.checked)} />
          Ամենաշատ այցելած
        </label>

        {activeCount > 0 && (
          <button onClick={clearAll} className="rounded-lg px-3 py-2 text-sm font-semibold text-apricot">
            Մաքրել ({activeCount})
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="mt-8">
        {filtered.length === 0 ? (
          <p className="text-center text-neutral-500">Ընտրված պայմաններով արշավ չի գտնվել։</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((t) => (
              <article key={t.id} className="flex flex-col overflow-hidden rounded-xl border border-sand bg-white">
                {t.photo_urls?.[0] ? (
                  <img src={t.photo_urls[0]} alt="" className="h-32 w-full object-cover" />
                ) : (
                  <div className="h-32 bg-gradient-to-br from-pine to-apricot/70" />
                )}
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex flex-wrap items-center gap-1 text-xs font-semibold uppercase">
                    {t.regions.map((r, i) => (
                      <span key={r}>
                        {i > 0 && <span className="text-neutral-300">, </span>}
                        <button
                          onClick={() => {
                            setRegions([r]);
                            setOpenFilter(null);
                          }}
                          className="text-apricot underline-offset-2 hover:underline"
                        >
                          {tr(`region.${r}`)}
                        </button>
                      </span>
                    ))}
                    <span className="text-neutral-300">·</span>
                    <button
                      onClick={() => {
                        setClubs([t.club_name]);
                        setOpenFilter(null);
                      }}
                      className="text-pine underline-offset-2 hover:underline"
                    >
                      {t.club_name}
                    </button>
                  </div>
                  <h3 className="mt-2 font-semibold">{t.title}</h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    {t.date}
                    {t.overnight ? " · գիշերակացով" : ""} · {tr(`difficulty.${t.difficulty}`)}
                  </p>
                  {Number(t.price) > 0 && (
                    <p className="mt-1 text-sm font-semibold text-pine">
                      {formatAmd(Number(t.price))}
                    </p>
                  )}
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

    </div>
  );
}
