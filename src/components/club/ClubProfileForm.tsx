"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadImage, removeStored, IMAGE_ACCEPT } from "@/lib/storage";
import { CLUB_FOCUS } from "@/lib/catalog";
import { useT } from "@/i18n/client";
import type { Club } from "@/types/database";

const input =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/30";

// Photo, about text, phone and focus — everything shown on the public club page.
export default function ClubProfileForm({ club }: { club: Club }) {
  const t = useT();
  const router = useRouter();
  const [photo, setPhoto] = useState(club.photo_url);
  const [about, setAbout] = useState(club.description ?? "");
  const [phone, setPhone] = useState(club.phone ?? "");
  const [slug, setSlug] = useState(club.slug ?? "");
  const [focus, setFocus] = useState<string[]>(club.focus ?? []);
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
    const address = slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(address) || address.length < 3 || address.length > 40) return setError(t("clubData.slugInvalid"));
    setBusy("info");
    const { error: err } = await createClient()
      .from("clubs")
      .update({ description: about.trim() || null, phone: phone.trim() || null, focus, slug: address })
      .eq("id", club.id);
    setBusy(null);
    if (err) return setError(err.code === "23505" && err.message.includes("slug") ? t("clubData.slugTaken") : err.code === "23514" ? t("clubData.slugInvalid") : err.message);
    setSlug(address);
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
            <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-spruce-500">
              {busy === "photo" ? "..." : t("clubData.upload")}
              <input
                type="file"
                accept={IMAGE_ACCEPT}
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
        <Link href={`/clubs/${club.slug ?? club.id}`} className="ml-auto text-sm font-semibold text-terracotta-500 hover:text-terracotta-700">
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
        <div className="max-w-md">
          <label htmlFor="slug" className="mb-1 block text-sm font-medium text-ink">{t("clubData.slug")}</label>
          <div className="flex items-center rounded-lg border border-line bg-surface focus-within:border-terracotta-500 focus-within:ring-2 focus-within:ring-terracotta-500/30">
            <span className="select-none whitespace-nowrap pl-3 text-sm text-muted">/clubs/</span>
            <input
              id="slug"
              required
              minLength={3}
              maxLength={40}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              autoCapitalize="none"
              spellCheck={false}
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              className="min-w-0 flex-1 rounded-lg bg-transparent py-2.5 pl-0.5 pr-3 text-ink focus:outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-muted">{t("clubData.slugHint")}</p>
        </div>
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-ink">{t("clubData.focus")}</legend>
          <div className="grid gap-x-4 gap-y-2 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2">
            {CLUB_FOCUS.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="accent-spruce-500"
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
        <button type="submit" disabled={busy === "info"} className="rounded-full bg-spruce-500 px-5 py-2.5 font-semibold text-white hover:bg-spruce-900 disabled:opacity-50">
          {busy === "info" ? "..." : t("clubData.saveInfo")}
        </button>
      </form>
    </section>
  );
}
