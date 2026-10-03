"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Tour } from "@/types/database";
import {
  DIFFICULTIES,
  PACKAGES,
  REGIONS,
  TERRAINS,
  activePackage,
  type Difficulty,
} from "@/lib/catalog";
import { useT } from "@/i18n/client";

const MAX_PHOTOS = 5;
const BUCKET = "club-assets";

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
  const t = useT();

  const [title, setTitle] = useState(initialTour?.title ?? "");
  const [regions, setRegions] = useState<string[]>(initialTour?.regions ?? []);
  const [date, setDate] = useState(initialTour?.date ?? "");
  const [terrains, setTerrains] = useState<string[]>(initialTour?.terrains ?? []);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialTour?.difficulty ?? "medium");
  const [overnight, setOvernight] = useState(initialTour?.overnight ?? false);
  const [maxParticipants, setMaxParticipants] = useState(
    String(initialTour?.max_participants ?? 15)
  );
  const [coordinatorPhone, setCoordinatorPhone] = useState(initialTour?.coordinator_phone ?? "");
  const [meetingPoint, setMeetingPoint] = useState(initialTour?.meeting_point ?? "");
  const [meetingTime, setMeetingTime] = useState(
    (initialTour?.meeting_time ?? "").slice(0, 5)
  );
  const [price, setPrice] = useState(
    initialTour?.price != null ? String(initialTour.price) : "0"
  );
  const [description, setDescription] = useState(initialTour?.description ?? "");
  const [notes, setNotes] = useState(initialTour?.notes ?? "");

  const [savedPhotos, setSavedPhotos] = useState<string[]>(initialTour?.photo_urls ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [limitInfo, setLimitInfo] = useState<
    { used: number; max: number; seatCap: number } | null
  >(null);

  // Load the package caps in both modes so editing cannot exceed them either.
  // Upcoming active + hidden tours count toward the cap (same rule as the DB).
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: club } = await supabase
        .from("clubs")
        .select("tariff, package_ends_at")
        .eq("id", clubId)
        .single();
      const { count } = await supabase
        .from("tours")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .in("status", ["active", "hidden"])
        .gte("date", new Date().toISOString().slice(0, 10));
      const pkg = activePackage(club as { tariff: string | null; package_ends_at: string | null } | null);
      setLimitInfo({
        used: count ?? 0,
        max: pkg ? PACKAGES[pkg].maxListings : 0,
        seatCap: pkg ? PACKAGES[pkg].maxPerTour : 0,
      });
    })();
  }, [mode, clubId]);

  const atLimit = mode === "create" && limitInfo && limitInfo.used >= limitInfo.max;

  function toggleRegion(r: string) {
    setRegions((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  function toggleTerrain(k: string) {
    setTerrains((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (regions.length === 0) return setError("Ընտրիր առնվազն մեկ մարզ։");
    if (terrains.length === 0) return setError("Ընտրիր առնվազն մեկ տեղանք։");
    if (!coordinatorPhone.trim())
      return setError("Կոորդինատորի հեռախոսահամարը պարտադիր է։");
    if (limitInfo && Number(maxParticipants) > limitInfo.seatCap)
      return setError(`Քո տարիֆով առավելագույնը ${limitInfo.seatCap} մասնակից է։`);
    if (price === "" || Number.isNaN(Number(price)) || Number(price) < 0)
      return setError("Գինը նշիր ճիշտ՝ 0 կամ բարձր (դրամով)։");

    setSaving(true);
    const supabase = createClient();

    // Upload the new photos first, keeping the ones already stored.
    const photoUrls = [...savedPhotos];
    if (newFiles.length > 0) {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setSaving(false);
        return setError("Նորից մուտք գործիր։");
      }
      for (const file of newFiles) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `tours/${auth.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || "image/jpeg" });
        if (uploadError) {
          setSaving(false);
          return setError(`Նկարը բեռնվել չկարողացավ՝ ${uploadError.message}`);
        }
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        if (pub?.publicUrl) photoUrls.push(pub.publicUrl);
      }
      setNewFiles([]);
    }

    const payload = {
      club_id: clubId,
      title,
      regions,
      date,
      terrains,
      difficulty,
      overnight,
      max_participants: Number(maxParticipants),
      coordinator_phone: coordinatorPhone.trim(),
      meeting_point: meetingPoint.trim() || null,
      meeting_time: meetingTime || null,
      price: Number(price) || 0,
      description: description || null,
      notes: notes || null,
      photo_urls: photoUrls,
    };

    const { data: created, error: dbError = null } =
      mode === "create"
        ? await supabase.from("tours").insert(payload).select("id").single()
        : await supabase.from("tours").update(payload).eq("id", initialTour!.id);

    setSaving(false);
    if (dbError) return setError(dbError.message);

    // The database trigger already wrote one notification per follower; this
    // turns them into emails — fire-and-forget so a slow mail server never
    // blocks the club from seeing its new listing.
    if (mode === "create" && created) {
      fetch("/api/tours/announce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tour_id: (created as { id: string }).id }),
      }).catch(() => {});
    }

    router.push("/dashboard");
    router.refresh();
  }

  const input = "w-full rounded-lg border border-neutral-300 p-3";

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setNewFiles((cur) => {
      const room = MAX_PHOTOS - savedPhotos.length - cur.length;
      return room > 0 ? [...cur, ...files].slice(0, cur.length + room) : cur;
    });
    e.target.value = "";
  }

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
            {limitInfo?.max === 0
              ? "Հայտարարություն ավելացնելու համար ընտրեք Ձեզ հարմար փաթեթը։"
              : "Հասել եք փաթեթի սահմանաչափին։ Ջնջեք մի հայտարարություն կամ ընտրեք ավելի մեծ փաթեթ։"}
          </p>
          <Link href="/dashboard/packages" className="mt-2 inline-block font-semibold underline">
            Փաթեթներ
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
          {REGIONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={regions.includes(r)} onChange={() => toggleRegion(r)} />
              {t(`region.${r}`)}
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

      <div>
        <label className="mb-1 block text-sm font-medium">Տեղանք</label>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-300 p-3 sm:grid-cols-3">
          {TERRAINS.map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={terrains.includes(k)} onChange={() => toggleTerrain(k)} />
              {t(`terrain.${k}`)}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Բարդություն</label>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className={input}>
          {DIFFICULTIES.map((k) => (
            <option key={k} value={k}>{t(`difficulty.${k}`)}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={overnight} onChange={(e) => setOvernight(e.target.checked)} />
        Գիշերակացով
      </label>

      <div>
        <label className="mb-1 block text-sm font-medium">Գին՝ դրամով (֏)</label>
        <input
          type="number"
          min={0}
          step="100"
          placeholder="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className={input}
        />
        <p className="mt-1 text-xs text-neutral-400">
          0 — անվճար գրանցում։ Բարձր գինը մասնակիցը վճարում է գրանցվելիս (թեստային քարտով)։
        </p>
      </div>

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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Հավաքի վայր</label>
          <input
            placeholder="Օր.՝ Կասկադ, արձանի մոտ"
            value={meetingPoint}
            onChange={(e) => setMeetingPoint(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Հավաքի ժամ</label>
          <input
            type="time"
            value={meetingTime}
            onChange={(e) => setMeetingTime(e.target.value)}
            className={input}
          />
        </div>
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

      <div>
        <label className="mb-1 block text-sm font-medium">
          Լուսանկարներ ({savedPhotos.length + newFiles.length} / {MAX_PHOTOS})
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          disabled={savedPhotos.length + newFiles.length >= MAX_PHOTOS}
          className="w-full text-sm"
        />

        {savedPhotos.length + newFiles.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {savedPhotos.map((url) => (
              <div key={url} className="relative">
                <img src={url} alt="" className="h-20 w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setSavedPhotos((cur) => cur.filter((u) => u !== url))}
                  title="Հեռացնել նկարը"
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm text-neutral-600 shadow"
                >
                  ✕
                </button>
              </div>
            ))}
            {newFiles.map((f, i) => (
              <div key={`${f.name}-${i}`} className="relative">
                <img src={URL.createObjectURL(f)} alt="" className="h-20 w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setNewFiles((cur) => cur.filter((_, idx) => idx !== i))}
                  title="Հեռացնել նկարը"
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm text-neutral-600 shadow"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-neutral-400">
          Առաջին նկարը կդառնա քարտի պատկերը։ Նկարները բեռնվում են հրապարակման պահին։
        </p>
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
