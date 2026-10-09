"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { serverErrorMessage } from "@/lib/serverErrors";
import { useT } from "@/i18n/client";

// The switch at the top of the Notifications section: on = platform news are
// switched OFF for this account (new-hike digests, platform updates).
// Notifications about one's own hikes and favourite clubs keep coming.
export default function NewsToggle({ userId, newsOn }: { userId: string; newsOn: boolean }) {
  const t = useT();
  const router = useRouter();
  const [off, setOff] = useState(!newsOn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function flip() {
    const next = !off;
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().from("profiles").update({ platform_news: !next }).eq("id", userId);
    setBusy(false);
    if (err) return setError(serverErrorMessage(t, err.message));
    setOff(next);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={off}
          aria-labelledby="news-toggle-label"
          disabled={busy}
          onClick={flip}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${off ? "bg-terracotta-500" : "bg-line"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${off ? "left-[22px]" : "left-0.5"}`} />
        </button>
        <span id="news-toggle-label" className="text-sm font-semibold text-ink">{t("account.newsOff")}</span>
      </div>
      <p className="mt-2 text-xs text-muted">{off ? t("account.newsOffHint") : t("account.newsOnHint")}</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
