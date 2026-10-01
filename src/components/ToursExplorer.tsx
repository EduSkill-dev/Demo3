"use client";

import { useMemo, useState } from "react";
import type { TourWithClub, TourType, Difficulty } from "@/types/database";
import { DIFFICULTY_LABELS } from "@/types/database";
import FilterDropdown from "./FilterDropdown";

const TYPE_LABELS: Record<TourType, string> = {
  mountain: "Արշավ սարերում",
  lake: "Արշավ լճերի մոտ",
  other: "Այլ",
};

export default function ToursExplorer({ tours }: { tours: TourWithClub[] }) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [clubs, setClubs] = useState<string[]>([]);
  const [types, setTypes] = useState<TourType[]>([]);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [overnightOnly, setOvernightOnly] = useState(false);
  const [popularOnly, setPopularOnly] = useState(false);
  const [selected, setSelected] = useState<TourWithClub | null>(null);
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
      (types.length === 0 || types.includes(t.type)) &&
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
          selected={regions}
          onChange={setRegions}
          isOpen={openFilter === "region"}
          onToggle={() => toggleFilter("region")}
        />
        <FilterDropdown
          label="Տեսակ"
          options={["mountain", "lake", "other"] as TourType[]}
          labels={TYPE_LABELS}
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
          options={["easy", "medium", "hard", "prof"] as Difficulty[]}
          labels={DIFFICULTY_LABELS}
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
                <div className="h-32 bg-gradient-to-br from-pine to-apricot/70" />
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
                          {r}
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
                    {t.overnight ? " · գիշերակացով" : ""} · {DIFFICULTY_LABELS[t.difficulty]}
                  </p>
                  <button
                    onClick={() => setSelected(t)}
                    className="mt-4 self-start rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold hover:bg-stone"
                  >
                    Տեսնել ավելին
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-[8vh]"
          onClick={() => setSelected(null)}
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelected(null)}
              aria-label="Փակել"
              className="absolute right-4 top-4 text-xl text-neutral-500 hover:text-black"
            >
              ✕
            </button>
            <p className="text-xs font-semibold uppercase text-apricot">{selected.regions.join(", ")}</p>
            <h3 className="mt-1 pr-8 text-xl font-bold text-pine">{selected.title}</h3>
            <dl className="mt-4 space-y-1 text-sm text-neutral-700">
              <div><b>Ամսաթիվ՝</b> {selected.date}</div>
              <div><b>Ակումբ՝</b> {selected.club_name || "—"}</div>
              <div><b>Կոորդինատոր՝</b> {selected.coordinator_phone}</div>
              <div><b>Տեսակ՝</b> {TYPE_LABELS[selected.type]}</div>
              <div><b>Բարդություն՝</b> {DIFFICULTY_LABELS[selected.difficulty]}</div>
              <div><b>Գիշերակաց՝</b> {selected.overnight ? "Այո" : "Ոչ"}</div>
              <div><b>Առավելագույն մասնակիցներ՝</b> {selected.max_participants}</div>
            </dl>
            {selected.description && <p className="mt-4 text-neutral-600">{selected.description}</p>}
            {selected.notes && (
              <p className="mt-2 text-sm text-neutral-500"><b>Ինչ վերցնել՝</b> {selected.notes}</p>
            )}
            <button
              disabled
              className="mt-6 w-full cursor-not-allowed rounded-lg bg-apricot/60 py-3 font-semibold text-white"
              title="Գրանցումը կավելացվի հաջորդ փուլում"
            >
              Գրանցվել արշավին (շուտով)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
