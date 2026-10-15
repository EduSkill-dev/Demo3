"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { serverErrorMessage } from "@/lib/serverErrors";
import { useT } from "@/i18n/client";

// Show or hide one's hiker passport on the public Hikers page.
export default function PassportToggle({ userId, shown }: { userId: string; shown: boolean }) {
  const t = useT();
  const router = useRouter();
  const [on, setOn] = useState(shown);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function flip() {
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().from("profiles").update({ show_passport: !on }).eq("id", userId);
    setBusy(false);
    if (err) return setError(serverErrorMessage(t, err.message));
    setOn(!on);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="passport-toggle-label"
          disabled={busy}
          onClick={flip}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${on ? "bg-spruce-500" : "bg-line"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
        </button>
        <span id="passport-toggle-label" className="text-sm font-semibold text-ink">{t("passport.show")}</span>
      </div>
      <p className="mt-2 text-xs text-muted">{t("passport.showHint")}</p>
      {on && (
        <Link href={`/hikers/${userId}`} className="mt-2 inline-block text-sm font-semibold text-terracotta-700 underline underline-offset-4 hover:text-terracotta-500 dark:text-terracotta-300">
          {t("passport.publicLink")}
        </Link>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
