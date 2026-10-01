"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ARMENIA_REGIONS,
  DIFFICULTY_LABELS,
  TARIFF_LIMITS,
  type Difficulty,
  type Tariff,
  type Tour,
  type TourType,
} from "@/types/database";

const TYPE_LABELS: Record<TourType, string> = {
  mountain: "Սար",
  lake: "Լիճ",
  other: "Այլ",
};

export default function TourForm({
  mode,
  clubId,
  initialTour,
}: {
  mode: "create" | "edit";
  clubId: string;
  initialTour?: Tour;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(initialTour?.title ?? "");
  const [regions, setRegions] = useState<string[]>(initialTour?.regions ?? []);
  const [date, setDate] = useState(initialTour?.date ?? "");
  const [type, setType] = useState<TourType>(initialTour?.type ?? "mountain");
  const [difficulty, setDifficulty] = useState<Difficulty>(initialTour?.difficulty ?? "medium");
  const [overnight, setOvernight] = useState(initialTour?.overnight ?? false);
  const [maxParticipants, setMaxParticipants] = useState(
    String(initialTour?.max_participants ?? 15)
  );
  const [coordinatorPhone, setCoordinatorPhone] = useState(initialTour?.coordinator_phone ?? "");
  const [description, setDescription] = useState(initialTour?.description ?? "");
  const [notes, setNotes] = useState(initialTour?.notes ?? "");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [limitInfo, setLimitInfo] = useState<
    { used: number; max: number; seatCap: number } | null
  >(null);

  useEffect(() => {
    if (mode !== "create") return;
    (async () => {
      const supabase = createClient();
      const { data: club } = await supabase
        .from("clubs")
        .select("tariff")
        .eq("id", clubId)
        .single();
      const { count } = await supabase
        .from("tours")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId);
      const tariff = (club?.tariff ?? "start") as Tariff;
      setLimitInfo({
        used: count ?? 0,
        max: TARIFF_LIMITS[tariff].maxListings,
        seatCap: TARIFF_LIMITS[tariff].maxParticipants,
      });
    })();
  }, [mode, clubId]);

  const atLimit = mode === "create" && limitInfo && limitInfo.used >= limitInfo.max;

  function toggleRegion(r: string) {
    setRegions((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (regions.length === 0) return setError("Ընտրիր առնվազն մեկ մարզ։");
    if (!coordinatorPhone.trim())
      return setError("Կոորդինատորի հեռախոսահամարը պարտադիր է։");
    if (limitInfo && Number(maxParticipants) > limitInfo.seatCap)
      return setError(`Քո տարիֆով առավելագույնը ${limitInfo.seatCap} մասնակից է։`);

    setSaving(true);
    const supabase = createClient();
    const payload = {
      club_id: clubId,
      title,
      regions,
      date,
      type,
      difficulty,
      overnight,
      max_participants: Number(maxParticipants),
      coordinator_phone: coordinatorPhone.trim(),
      description: description || null,
      notes: notes || null,
    };

    const { error: dbError } =
      mode === "create"
        ? await supabase.from("tours").insert(payload)
        : await supabase.from("tours").update(payload).eq("id", initialTour!.id);

    setSaving(false);
    if (dbError) return setError(dbError.message);
    router.push("/dashboard");
    router.refresh();
  }

  const input = "w-full rounded-lg border border-neutral-300 p-3";

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
      {mode === "create" && limitInfo && (
        <p className="text-sm text-neutral-500">
          Հայտարարություններ՝ {limitInfo.used} / {limitInfo.max}
        </p>
      )}
      {atLimit && (
        <div className="rounded-lg bg-apricot/10 p-3 text-sm text-apricot-dark">
          <p>
            Հասել ես քո տարիֆի սահմանաչափին։ Ջնջիր մի հայտարարություն կամ բարձրացրու տարիֆդ նոր տուր ավելացնելու համար։
          </p>
          <Link href="/dashboard/tariff" className="mt-2 inline-block font-semibold underline">
            Փոխել տարիֆը
          </Link>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Տեղի անունը</label>
        <input
          required
          placeholder="օր. Արայի լեռ, կամ՝ Խոր Վիրապ – Նորավանք – Տաթև"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={input}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Մարզ(եր)</label>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-300 p-3 sm:grid-cols-3">
          {ARMENIA_REGIONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={regions.includes(r)} onChange={() => toggleRegion(r)} />
              {r}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Ամսաթիվ</label>
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Մասնակիցների առավելագույն թիվ</label>
          <input
            required
            type="number"
            min={1}
            max={limitInfo?.seatCap ?? undefined}
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            className={input}
          />
          {limitInfo && Number(maxParticipants) > limitInfo.seatCap && (
            <p className="mt-1 text-xs text-red-600">
              Քո տարիֆով առավելագույնը {limitInfo.seatCap} մասնակից է։
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Տեսակ</label>
          <select value={type} onChange={(e) => setType(e.target.value as TourType)} className={input}>
            {(Object.keys(TYPE_LABELS) as TourType[]).map((k) => (
              <option key={k} value={k}>{TYPE_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Բարդություն</label>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className={input}>
            {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((k) => (
              <option key={k} value={k}>{DIFFICULTY_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={overnight} onChange={(e) => setOvernight(e.target.checked)} />
        Գիշերակացով
      </label>

      <div>
        <label className="mb-1 block text-sm font-medium">Կոորդինատորի հեռախոսահամար *</label>
        <input
          required
          placeholder="+374 XX XXXXXX"
          value={coordinatorPhone}
          onChange={(e) => setCoordinatorPhone(e.target.value)}
          className={input}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Նկարագրություն</label>
        <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={3} className={input} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Ինչ վերցնել / նշումներ</label>
        <textarea
          placeholder="Օր.՝ հարմարավետ կոշիկ, ջուր, արևապաշտպան քսուք..."
          value={notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={input}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving || !!atLimit}
        className="rounded-lg bg-apricot px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Պահպանվում է..." : mode === "create" ? "Ստեղծել հայտարարությունը" : "Պահպանել փոփոխությունները"}
      </button>
    </form>
  );
}
