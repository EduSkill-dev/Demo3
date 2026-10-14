"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadImage, IMAGE_ACCEPT } from "@/lib/storage";
import type { Tour } from "@/types/database";
import { BRING_ITEMS, CANCEL_HOUR_OPTIONS, DEFAULT_CANCEL_HOURS, DIFFICULTIES, type Difficulty } from "@/lib/catalog";
import SightPicker, { type SightOption } from "@/components/SightPicker";
import { serverErrorMessage } from "@/lib/serverErrors";
import { useT } from "@/i18n/client";
import PlannerPanel from "@/components/club/PlannerPanel";
import { DIFFICULTY_COLORS } from "@/lib/calendar";

const MAX_PHOTOS = 5;

const input =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/30";
const label = "mb-1 block text-sm font-medium text-ink";
const hint = "mt-1 text-xs text-muted";

// Create / edit a listing. The club picks the places the hike visits; the
// regions, the kinds of place and the difficulty follow from them (the
// hardest place sets the difficulty — the database writes the same, so the
// two never disagree). The rest is the club's: dates, size, price, cancel
// window, contact, meeting point and time, description, what to bring and
// photos. `seatCap` is how many sign-ups the platform takes under the plan.
export default function TourForm({
  mode,
  clubId,
  clubPhone = "",
  initialTour,
  template,
  seatCap,
  sights,
  planner = false,
}: {
  mode: "create" | "edit";
  clubId: string;
  clubPhone?: string; // the club's phone: the coordinator's number by default
  initialTour?: Tour;
  template?: Tour; // "publish again": a new listing pre-filled from this one, without its date
  seatCap: number;
  sights: SightOption[];
  planner?: boolean; // the plan shows what other clubs have on the chosen day
}) {
  const router = useRouter();
  const t = useT();
  const today = new Date().toISOString().slice(0, 10);

  const source = initialTour ?? template;

  const [sightIds, setSightIds] = useState<string[]>(source?.sight_ids ?? []);
  const [title, setTitle] = useState(source?.title ?? "");
  const [titleTouched, setTitleTouched] = useState(!!source?.title);
  const [date, setDate] = useState(initialTour?.date ?? "");
  const [endDate, setEndDate] = useState(initialTour?.end_date ?? "");
  const [overnight, setOvernight] = useState(source?.overnight ?? false);
  const [cancelHours, setCancelHours] = useState(source?.cancel_hours ?? DEFAULT_CANCEL_HOURS);
  const [maxParticipants, setMaxParticipants] = useState(String(source?.max_participants ?? (seatCap || "")));
  const [price, setPrice] = useState(source?.price != null ? String(source.price) : "0");
  const [coordinatorPhone, setCoordinatorPhone] = useState(source?.coordinator_phone ?? clubPhone);
  const [meetingPoint, setMeetingPoint] = useState(source?.meeting_point ?? "");
  const [meetingTime, setMeetingTime] = useState((source?.meeting_time ?? "").slice(0, 5));
  const [description, setDescription] = useState(source?.description ?? "");
  const [bring, setBring] = useState<string[]>(source?.bring_items ?? []);
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [savedPhotos, setSavedPhotos] = useState<string[]>(source?.photo_urls ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // What the chosen places say about the hike.
  const chosen = useMemo(() => sightIds.map((id) => sights.find((s) => s.id === id)).filter((s): s is SightOption => !!s), [sightIds, sights]);
  const regions = useMemo(() => [...new Set(chosen.map((s) => s.region))], [chosen]);
  const terrains = useMemo(() => [...new Set(chosen.map((s) => s.terrain).filter((x): x is string => !!x))], [chosen]);
  const difficulty: Difficulty | null = useMemo(() => {
    const levels = chosen.map((s) => DIFFICULTIES.indexOf((s.difficulty ?? "") as Difficulty)).filter((i) => i >= 0);
    return levels.length ? DIFFICULTIES[Math.max(...levels)] : null;
  }, [chosen]);
  const suggestedTitle = chosen.map((s) => s.name).join(" – ");

  function pickPlaces(ids: string[]) {
    setSightIds(ids);
    if (!titleTouched) {
      const names = ids.map((id) => sights.find((s) => s.id === id)?.name).filter(Boolean);
      setTitle(names.join(" – ").slice(0, 150));
    }
  }

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
    if (chosen.length === 0) return setError(t("tourForm.errPlaces"));
    if (mode === "create" && date < today) return setError(t("tourForm.errDate"));
    if (endDate && endDate < date) return setError(t("tourForm.errEndDate"));
    if (!Number.isInteger(Number(maxParticipants)) || Number(maxParticipants) < 1) return setError(t("tourForm.errCapacity"));
    if (price === "" || Number.isNaN(Number(price)) || Number(price) < 0) return setError(t("tourForm.errPrice"));
    if (!coordinatorPhone.trim()) return setError(t("tourForm.errPhone"));
    if (!meetingPoint.trim() || !meetingTime) return setError(t("tourForm.errMeeting"));

    setSaving(true);
    const supabase = createClient();

    // Upload the new photos first, keeping the ones already stored.
    const photoUrls = [...savedPhotos];
    if (newFiles.length > 0) {
      for (const file of newFiles) {
        const up = await uploadImage("tours", file);
        if ("error" in up) {
          setSaving(false);
          return setError(t("clubData.uploadFailed", { message: up.error }));
        }
        photoUrls.push(up.url);
      }
      setNewFiles([]);
    }

    const payload = {
      club_id: clubId,
      title: (title.trim() || suggestedTitle).slice(0, 150),
      // The database recomputes these three from the places; sent so the
      // listing is right even before that.
      regions,
      terrains: terrains.length ? terrains : ["other"],
      difficulty: difficulty ?? "medium",
      sight_ids: sightIds,
      date,
      end_date: endDate && endDate > date ? endDate : null,
      overnight,
      cancel_hours: cancelHours,
      max_participants: Number(maxParticipants),
      coordinator_phone: coordinatorPhone.trim(),
      meeting_point: meetingPoint.trim() || null,
      meeting_time: meetingTime || null,
      price: Number(price) || 0,
      description: description.trim() || null,
      bring_items: BRING_ITEMS.filter((k) => bring.includes(k)),
      notes: notes.trim() || null,
      photo_urls: photoUrls,
    };

    const { data: created, error: dbError = null } =
      mode === "create"
        ? await supabase.from("tours").insert(payload).select("id").single()
        : await supabase.from("tours").update(payload).eq("id", initialTour!.id);

    setSaving(false);
    if (dbError) return setError(serverErrorMessage(t, dbError.message));

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

  const previews = [
    ...savedPhotos.map((url) => ({ key: url, src: url, remove: () => setSavedPhotos((c) => c.filter((u) => u !== url)) })),
    ...newFiles.map((f, i) => ({
      key: `${f.name}-${i}`,
      src: URL.createObjectURL(f),
      remove: () => setNewFiles((c) => c.filter((_, idx) => idx !== i)),
    })),
  ];
  const tag = "rounded-full bg-sand px-2.5 py-1 text-xs font-semibold text-ink";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      {mode === "create" && template && (
        <p className="rounded-lg border border-terracotta-500/40 bg-terracotta-500/10 p-3 text-sm text-ink">{t("tourForm.copyNotice")}</p>
      )}

      {/* 1. Where: the places decide regions, kinds and difficulty. */}
      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <div>
          <p className={label}>{t("tourForm.places")}</p>
          <SightPicker sights={sights} value={sightIds} onChange={pickPlaces} />
          <p className={hint}>
            {t("tourForm.placesHint")}{" "}
            <Link href="/help" className="font-semibold text-terracotta-700 underline dark:text-terracotta-300">{t("tourForm.placeMissing")}</Link>
          </p>
        </div>
        {chosen.length > 0 && (
          <dl className="grid gap-2 border-t border-line pt-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted">{t("tourForm.regions")}</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">{regions.map((r) => <span key={r} className={tag}>{t(`region.${r}`)}</span>)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("tourForm.terrains")}</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">{terrains.map((k) => <span key={k} className={tag}>{t(`terrain.${k}`)}</span>)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("tourForm.difficulty")}</dt>
              <dd className="mt-1">
                {difficulty && (
                  <span className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: DIFFICULTY_COLORS[difficulty].bg, color: DIFFICULTY_COLORS[difficulty].text }}>
                    {t(`difficulty.${difficulty}`)}
                  </span>
                )}
              </dd>
            </div>
            <p className="text-xs text-muted sm:col-span-3">{t("tourForm.autoTags")}</p>
          </dl>
        )}
        <div>
          <label htmlFor="title" className={label}>{t("tourForm.title")}</label>
          <input
            id="title"
            maxLength={150}
            placeholder={suggestedTitle || t("tourForm.placeHint")}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleTouched(true);
            }}
            className={input}
          />
          <p className={hint}>{t("tourForm.titleHint")}</p>
        </div>
      </section>

      {/* 2. When and how many. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className={label}>{t("tourForm.date")}</label>
          <input id="date" required type="date" min={mode === "create" ? today : undefined} value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="end-date" className={label}>{t("tourForm.endDate")}</label>
          <input id="end-date" type="date" min={date || (mode === "create" ? today : undefined)} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} />
          <p className={hint}>{t("tourForm.endDateHint")}</p>
        </div>
        {planner && date && <PlannerPanel date={date} endDate={endDate} regions={regions} exclude={initialTour?.id} />}
        <label className="flex items-center gap-2 text-sm font-medium text-ink sm:col-span-2">
          <input type="checkbox" checked={overnight} onChange={(e) => setOvernight(e.target.checked)} className="accent-spruce-500" />
          {t("tourForm.overnight")}
        </label>
        <div>
          <label htmlFor="cap" className={label}>{t("tourForm.capacity")}</label>
          <input id="cap" required type="number" min={1} max={10000} step={1} value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} className={input} />
          {seatCap > 0 && <p className={hint}>{t("tourForm.capacityHint", { max: seatCap })}</p>}
        </div>
        <div>
          <label htmlFor="price" className={label}>{t("tourForm.price")}</label>
          <input id="price" required type="number" min={0} step="100" value={price} onChange={(e) => setPrice(e.target.value)} className={input} />
          <p className={hint}>{t("tourForm.priceHint")}</p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="cancel-hours" className={label}>{t("tourForm.cancelHours")}</label>
          <select id="cancel-hours" value={cancelHours} onChange={(e) => setCancelHours(Number(e.target.value))} className={input}>
            {CANCEL_HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>{t("tourForm.cancelHoursOption", { hours: h })}</option>
            ))}
          </select>
          <p className={hint}>{t("tourForm.cancelHoursHint")}</p>
        </div>
      </div>

      {/* 3. Meeting. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="phone" className={label}>{t("tourForm.coordinatorPhone")}</label>
          <input id="phone" required type="tel" placeholder="+374 XX XXXXXX" value={coordinatorPhone} onChange={(e) => setCoordinatorPhone(e.target.value)} className={input} />
          {clubPhone && coordinatorPhone === clubPhone && <p className={hint}>{t("tourForm.phoneFromClub")}</p>}
        </div>
        <div>
          <label htmlFor="mpoint" className={label}>{t("tourForm.meetingPoint")}</label>
          <input id="mpoint" required maxLength={200} placeholder={t("tourForm.meetingPointHint")} value={meetingPoint} onChange={(e) => setMeetingPoint(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="mtime" className={label}>{t("tourForm.meetingTime")}</label>
          <input id="mtime" required type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} className={input} />
        </div>
      </div>
      {mode === "edit" && <p className={hint}>{t("tourForm.changeNotice")}</p>}

      <div>
        <label htmlFor="desc" className={label}>{t("tourForm.description")}</label>
        <textarea id="desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={input} />
      </div>

      {/* 4. What to bring: from the list, plus anything else in words. */}
      <fieldset>
        <legend className={label}>{t("tourForm.bring")}</legend>
        <div className="flex flex-wrap gap-2">
          {BRING_ITEMS.map((k) => {
            const on = bring.includes(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => setBring((cur) => (on ? cur.filter((x) => x !== k) : [...cur, k]))}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  on ? "border-spruce-500 bg-spruce-500 text-white" : "border-line bg-surface text-ink hover:border-spruce-500"
                }`}
              >
                {on ? "✓ " : ""}
                {t(`bring.${k}`)}
              </button>
            );
          })}
        </div>
        <textarea id="notes" rows={2} placeholder={t("tourForm.bringMore")} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${input} mt-2`} />
      </fieldset>

      <div>
        <label htmlFor="photos" className={label}>
          {t("tourForm.photos", { count: previews.length, max: MAX_PHOTOS })}
        </label>
        <input
          id="photos"
          type="file"
          accept={IMAGE_ACCEPT}
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
          className="rounded-full bg-spruce-500 px-5 py-3 font-semibold text-white hover:bg-spruce-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? t("tourForm.saving") : mode === "create" ? t("tourForm.create") : t("tourForm.save")}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-lg border border-line px-5 py-3 font-semibold text-ink hover:border-spruce-500"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
