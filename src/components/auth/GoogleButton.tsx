"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/client";

// "Continue with Google": signs in, or creates an individual account the
// first time (the missing details are asked right after). `next` is where
// the person was heading.
export default function GoogleButton({ next }: { next?: string | null }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const fromUrl = new URLSearchParams(window.location.search).get("next");
    const target = next ?? (fromUrl && fromUrl.startsWith("/") && !fromUrl.startsWith("//") ? fromUrl : null);
    const { error: err } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback${target ? `?next=${encodeURIComponent(target)}` : ""}` },
    });
    if (err) {
      setBusy(false);
      setError(t("errors.network"));
    }
  }

  return (
    <div>
      <button
        data-view
        type="button"
        onClick={go}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-spruce-500 disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8L20 3.1A12 12 0 0 0 1.300 6.6l4 3.1c.9-2.9 3.600-4.900 6.700-4.900Z" />
        </svg>
        {busy ? "..." : t("auth.withGoogle")}
      </button>
      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}

// The line between the outside-account button and the form.
export function AuthDivider() {
  const t = useT();
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-line" />
      {t("auth.or")}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
