"use client";

import { CANCEL_HOUR_OPTIONS, DEFAULT_CANCEL_HOURS } from "@/lib/catalog";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadImage, removeStored } from "@/lib/storage";
import { CLUB_FOCUS } from "@/lib/catalog";
import { useT } from "@/i18n/client";
import type { Club } from "@/types/database";

const input =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-apricot focus:outline-none focus:ring-2 focus:ring-apricot/20";

// Photo, about text, phone and focus — everything shown on the public club page.
export default function ClubProfileForm({ club }: { club: Club }) {
  const t = useT();
  const router = useRouter();
  const [photo, setPhoto] = useState(club.photo_url);
  const [about, setAbout] = useState(club.description ?? "");
  const [phone, setPhone] = useState(club.phone ?? "");
  const [focus, setFocus] = useState<string[]>(club.focus ?? []);
  const [cancelHours, setCancelHours] = useState(club.cancel_hours ?? DEFAULT_CANCEL_HOURS);
  const [busy, setBusy] = useState<"photo" | "info" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changePhoto(file: File | null) {
    setError(null);
    setMessage(null);
    setBusy("photo");
    let url: string | null = null;
    if (file) {
      const up = await uploadImage("clubs", file);
      if ("error" in up) {
        setBusy(null);
        return setError(t("clubData.uploadFailed", { message: up.error }));
      }
      url = up.url;
    }
    const { error: err } = await createClient().from("clubs").update({ photo_url: url }).eq("id", club.id);
    setBusy(null);
    if (err) return setError(err.message);
    removeStored(photo);
    setPhoto(url);
    router.refresh();
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy("info");
    const { error: err } = await createClient()
      .from("clubs")
      .update({ description: about.trim() || null, phone: phone.trim() || null, focus, cancel_hours: cancelHours })
      .eq("id", club.id);
    setBusy(null);
    if (err) return setError(err.message);
    setMessage(t("clubData.saved"));
    router.refresh();
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-5">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-line bg-sand">
          {photo ? (
            <img src={photo} alt={club.name} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl">🏔️</div>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">{t("clubData.photo")}</p>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-apricot">
              {busy === "photo" ? "..." : t("clubData.upload")}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={busy === "photo"}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) changePhoto(f);
                }}
              />
            </label>
            {photo && (
              <button type="button" onClick={() => changePhoto(null)} disabled={busy === "photo"} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
                {t("clubData.remove")}
              </button>
            )}
          </div>
        </div>
        <Link href={`/clubs/${club.id}`} className="ml-auto text-sm font-semibold text-apricot hover:text-apricot-dark">
          {t("clubData.publicLink")} →
        </Link>
      </div>

      <form onSubmit={saveInfo} className="max-w-2xl space-y-5">
        <div>
          <label htmlFor="about" className="mb-1 block text-sm font-medium text-ink">{t("clubData.about")}</label>
          <textarea id="about" rows={6} placeholder={t("clubData.aboutHint")} value={about} onChange={(e) => setAbout(e.target.value)} className={input} />
        </div>
        <div className="max-w-xs">
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-ink">{t("clubData.phone")}</label>
          <input id="phone" type="tel" placeholder="+374 XX XXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
        </div>
        <div>
          <label htmlFor="cancel-hours" className="mb-1 block text-sm font-medium text-ink">{t("clubData.cancelHours")}</label>
          <select id="cancel-hours" value={cancelHours} onChange={(e) => setCancelHours(Number(e.target.value))} className={input}>
            {CANCEL_HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>{t("clubData.cancelHoursOption", { hours: h })}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">{t("clubData.cancelHoursHint")}</p>
        </div>
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-ink">{t("clubData.focus")}</legend>
          <div className="grid gap-x-4 gap-y-2 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
            {CLUB_FOCUS.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="accent-apricot"
                  checked={focus.includes(k)}
                  onChange={() => setFocus((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))}
                />
                {t(`focus.${k}`)}
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm font-medium text-green-700">{message}</p>}
        <button type="submit" disabled={busy === "info"} className="rounded-lg bg-apricot px-5 py-2.5 font-semibold text-white hover:bg-apricot-dark disabled:opacity-50">
          {busy === "info" ? "..." : t("clubData.saveInfo")}
        </button>
      </form>
    </section>
  );
}
