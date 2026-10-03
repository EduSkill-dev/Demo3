"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Tour } from "@/types/database";
import { DIFFICULTIES, REGIONS, TERRAINS, type Difficulty } from "@/lib/catalog";
import { useT } from "@/i18n/client";

const MAX_PHOTOS = 5;
const BUCKET = "club-assets";

const input =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-apricot focus:outline-none focus:ring-2 focus:ring-apricot/20";
const label = "mb-1 block text-sm font-medium text-ink";
const hint = "mt-1 text-xs text-muted";

// Create / edit a listing. The page passes in the package's seat cap; the
// listing cap and every other rule are enforced again by the database.
export default function TourForm({
  mode,
  clubId,
  initialTour,
  seatCap,
}: {
  mode: "create" | "edit";
  clubId: string;
  initialTour?: Tour;
  seatCap: number;
}) {
  const router = useRouter();
  const t = useT();
  const today = new Date().toISOString().slice(0, 10);

  const [title, setTitle] = useState(initialTour?.title ?? "");
  const [regions, setRegions] = useState<string[]>(initialTour?.regions ?? []);
  const [terrains, setTerrains] = useState<string[]>(initialTour?.terrains ?? []);
  const [date, setDate] = useState(initialTour?.date ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(initialTour?.difficulty ?? "medium");
  const [overnight, setOvernight] = useState(initialTour?.overnight ?? false);
  const [maxParticipants, setMaxParticipants] = useState(
    String(initialTour?.max_participants ?? seatCap)
  );
  const [price, setPrice] = useState(initialTour?.price != null ? String(initialTour.price) : "0");
  const [coordinatorPhone, setCoordinatorPhone] = useState(initialTour?.coordinator_phone ?? "");
  const [meetingPoint, setMeetingPoint] = useState(initialTour?.meeting_point ?? "");
  const [meetingTime, setMeetingTime] = useState((initialTour?.meeting_time ?? "").slice(0, 5));
  const [description, setDescription] = useState(initialTour?.description ?? "");
  const [notes, setNotes] = useState(initialTour?.notes ?? "");
  const [savedPhotos, setSavedPhotos] = useState<string[]>(initialTour?.photo_urls ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, key: string) =>
    set(list.includes(key) ? list.filter((x) => x !== key) : [...list, key]);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setNewFiles((cur) => {
      const room = MAX_PHOTOS - savedPhotos.length - cur.length;
      return room > 0 ? [...cur, ...files].slice(0, cur.length + room) : cur;
    });
    e.target.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (regions.length === 0) return setError(t("tourForm.errRegion"));
    if (terrains.length === 0) return setError(t("tourForm.errTerrain"));
    if (mode === "create" && date < today) return setError(t("tourForm.errDate"));
    if (Number(maxParticipants) > seatCap) return setError(t("tourForm.errCapacity", { max: seatCap }));
    if (price === "" || Number.isNaN(Number(price)) || Number(price) < 0) return setError(t("tourForm.errPrice"));

    setSaving(true);
    const supabase = createClient();

    // Upload the new photos first, keeping the ones already stored.
    const photoUrls = [...savedPhotos];
    if (newFiles.length > 0) {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setSaving(false);
        return setError(t("common.error"));
      }
      for (const file of newFiles) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `tours/${auth.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || "image/jpeg" });
        if (uploadError) {
          setSaving(false);
          return setError(t("clubData.uploadFailed", { message: uploadError.message }));
        }
        photoUrls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      }
      setNewFiles([]);
    }

    const payload = {
      club_id: clubId,
      title: title.trim(),
      regions,
      terrains,
      date,
      difficulty,
      overnight,
      max_participants: Number(maxParticipants),
      coordinator_phone: coordinatorPhone.trim(),
      meeting_point: meetingPoint.trim() || null,
      meeting_time: meetingTime || null,
      price: Number(price) || 0,
      description: description.trim() || null,
      notes: notes.trim() || null,
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

  const checkboxGrid = "grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-line bg-surface p-3 sm:grid-cols-3";
  const previews = [
    ...savedPhotos.map((url) => ({ key: url, src: url, remove: () => setSavedPhotos((c) => c.filter((u) => u !== url)) })),
    ...newFiles.map((f, i) => ({
      key: `${f.name}-${i}`,
      src: URL.createObjectURL(f),
      remove: () => setNewFiles((c) => c.filter((_, idx) => idx !== i)),
    })),
  ];

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <div>
        <label htmlFor="title" className={label}>{t("tourForm.place")}</label>
        <input id="title" required placeholder={t("tourForm.placeHint")} value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
      </div>

      <fieldset>
        <legend className={label}>{t("tourForm.regions")}</legend>
        <div className={checkboxGrid}>
          {REGIONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={regions.includes(r)} onChange={() => toggle(regions, setRegions, r)} className="accent-apricot" />
              {t(`region.${r}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={label}>{t("tourForm.terrains")}</legend>
        <div className={checkboxGrid}>
          {TERRAINS.map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={terrains.includes(k)} onChange={() => toggle(terrains, setTerrains, k)} className="accent-apricot" />
              {t(`terrain.${k}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className={label}>{t("tourForm.date")}</label>
          <input id="date" required type="date" min={mode === "create" ? today : undefined} value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="cap" className={label}>{t("tourForm.capacity")}</label>
          <input id="cap" required type="number" min={1} max={seatCap} value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} className={input} />
          <p className={hint}>{t("tourForm.capacityHint", { max: seatCap })}</p>
        </div>
        <div>
          <label htmlFor="difficulty" className={label}>{t("tourForm.difficulty")}</label>
          <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className={input}>
            {DIFFICULTIES.map((k) => (
              <option key={k} value={k}>{t(`difficulty.${k}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="price" className={label}>{t("tourForm.price")}</label>
          <input id="price" type="number" min={0} step="100" value={price} onChange={(e) => setPrice(e.target.value)} className={input} />
          <p className={hint}>{t("tourForm.priceHint")}</p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink">
        <input type="checkbox" checked={overnight} onChange={(e) => setOvernight(e.target.checked)} className="accent-apricot" />
        {t("tourForm.overnight")}
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="phone" className={label}>{t("tourForm.coordinatorPhone")}</label>
          <input id="phone" required type="tel" placeholder="+374 XX XXXXXX" value={coordinatorPhone} onChange={(e) => setCoordinatorPhone(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="mpoint" className={label}>{t("tourForm.meetingPoint")}</label>
          <input id="mpoint" placeholder={t("tourForm.meetingPointHint")} value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="mtime" className={label}>{t("tourForm.meetingTime")}</label>
          <input id="mtime" type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} className={input} />
        </div>
      </div>
      {mode === "edit" && <p className={hint}>{t("tourForm.changeNotice")}</p>}

      <div>
        <label htmlFor="desc" className={label}>{t("tourForm.description")}</label>
        <textarea id="desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={input} />
      </div>
      <div>
        <label htmlFor="notes" className={label}>{t("tourForm.notes")}</label>
        <textarea id="notes" rows={3} placeholder={t("tourForm.notesHint")} value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
      </div>

      <div>
        <label htmlFor="photos" className={label}>
          {t("tourForm.photos", { count: previews.length, max: MAX_PHOTOS })}
        </label>
        <input
          id="photos"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          disabled={previews.length >= MAX_PHOTOS}
          className="w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-sand file:px-3 file:py-2 file:font-semibold file:text-ink"
        />
        {previews.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {previews.map((p) => (
              <div key={p.key} className="relative">
                <img src={p.src} alt="" className="h-20 w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={p.remove}
                  aria-label={t("tourForm.removePhoto")}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-sm text-muted shadow"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <p className={hint}>{t("tourForm.photosHint")}</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-apricot px-5 py-3 font-semibold text-white hover:bg-apricot-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? t("tourForm.saving") : mode === "create" ? t("tourForm.create") : t("tourForm.save")}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-lg border border-line px-5 py-3 font-semibold text-ink hover:border-apricot"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
