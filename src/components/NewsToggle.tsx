"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { serverErrorMessage } from "@/lib/serverErrors";
import { useT } from "@/i18n/client";

type Pref = "platform_news" | "new_tours_digest";

// The two switches at the top of the Notifications section, each saying
// what it turns on:
//   platform_news     news from the platform (updates, rule changes)
//   new_tours_digest  an email about every newly published hike (clubs start with it off)
// Notifications about one's own hikes keep coming either way.
export default function NewsToggle({ userId, newsOn, toursOn }: { userId: string; newsOn: boolean; toursOn: boolean }) {
  const t = useT();
  const router = useRouter();
  const [on, setOn] = useState<Record<Pref, boolean>>({ platform_news: newsOn, new_tours_digest: toursOn });
  const [busy, setBusy] = useState<Pref | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function flip(key: Pref) {
    const next = !on[key];
    setBusy(key);
    setError(null);
    const { error: err } = await createClient().from("profiles").update({ [key]: next }).eq("id", userId);
    setBusy(null);
    if (err) return setError(serverErrorMessage(t, err.message));
    setOn((o) => ({ ...o, [key]: next }));
    router.refresh();
  }

  const row = (key: Pref, label: string, hint: string) => (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on[key]}
        aria-labelledby={`pref-${key}`}
        disabled={busy !== null}
        onClick={() => flip(key)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${on[key] ? "bg-spruce-500" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${on[key] ? "left-[22px]" : "left-0.5"}`} />
      </button>
      <span>
        <span id={`pref-${key}`} className="block text-sm font-semibold text-ink">{label}</span>
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      </span>
    </div>
  );

  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface p-4">
      {row("platform_news", t("account.prefNews"), t("account.prefNewsHint"))}
      {row("new_tours_digest", t("account.prefTours"), t("account.prefToursHint"))}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
