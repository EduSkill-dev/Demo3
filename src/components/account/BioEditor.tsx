"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/client";
import { BIO_MAX, bioProblem } from "@/lib/socialLinks";

// "About me" in the hiker passport: up to BIO_MAX characters, no links,
// emails or phone numbers (warned as one types; the database checks too).
export default function BioEditor({ userId, initial }: { userId: string; initial: string }) {
  const t = useT();
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = bioProblem(text);
  const warning = problem === "long" ? t("passport.bioLong", { max: BIO_MAX }) : problem === "link" ? t("passport.bioLink") : problem === "phone" ? t("passport.bioPhone") : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (problem) return;
    setBusy(true);
    setError(null);
    const value = text.trim();
    const { error: err } = await createClient().from("profiles").update({ passport_bio: value || null }).eq("id", userId);
    setBusy(false);
    if (err) return setError(err.message.includes("passport_bio") ? t("passport.bioLink") : err.message);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-line bg-surface p-4">
      <label htmlFor="passport-bio" className="text-sm font-semibold text-ink">{t("passport.bioTitle")}</label>
      <p className="mt-0.5 text-xs text-muted">{t("passport.bioHint")}</p>
      <textarea
        id="passport-bio"
        rows={4}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        aria-invalid={!!problem}
        className={`mt-2 w-full rounded-lg border-2 bg-surface px-3 py-2 text-sm text-ink focus:outline-none ${problem ? "border-red-500" : "border-line focus:border-terracotta-500"}`}
      />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs font-semibold ${problem ? "text-red-600" : "text-muted"}`}>{warning ?? ""}</span>
        <span className={`text-xs ${text.length > BIO_MAX ? "font-bold text-red-600" : "text-muted"}`}>{text.length}/{BIO_MAX}</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button type="submit" disabled={busy || !!problem || text.trim() === initial.trim()} className="rounded-full bg-spruce-500 px-4 py-2 text-sm font-semibold text-white hover:bg-spruce-900 disabled:opacity-50">
          {busy ? "..." : t("passport.bioSave")}
        </button>
        {saved && <span className="text-sm font-semibold text-spruce-700 dark:text-spruce-300">{t("passport.bioSaved")}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
