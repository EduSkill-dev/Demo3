"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { serverErrorMessage } from "@/lib/serverErrors";

// Cancels a guest's booking by the token from the email.
export default function GuestCancelButton({ token, name }: { token: string; name: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm(t("guest.cancelConfirm"))) return;
    setState("busy");
    setError(null);
    const res = await fetch("/api/bookings/guest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel", token }) }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : null;
    if (!res?.ok) {
      setState("idle");
      return setError(data?.error ? serverErrorMessage(t, data.error) : t("errors.network"));
    }
    setState("done");
  }

  if (state === "done") return <p className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800">{t("guest.cancelled")}</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">{t("guest.cancelAsk", { name })}</p>
      <button type="button" onClick={cancel} disabled={state === "busy"} className="w-full rounded-lg border-2 border-red-600 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300">
        {state === "busy" ? "…" : t("guest.cancelButton")}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
