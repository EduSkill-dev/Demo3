"use client";

import { useState } from "react";
import AuthCard, { authButton } from "@/components/auth/AuthCard";

// The link from the email to the super admin's other address: one press
// confirms that this address's password may be changed (a press, not the
// opening, so a mail scanner that opens links confirms nothing).
export default function AdminConfirmPage() {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setState("busy");
    setError(null);
    const t = new URLSearchParams(window.location.search).get("t") ?? "";
    const res = await fetch("/api/admin/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", t }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : null;
    if (!res?.ok) {
      setState("idle");
      return setError(data?.error ?? "Սերվերին կապվել չստացվեց։ Փորձեք նորից։");
    }
    setState("done");
  }

  return (
    <AuthCard title="Գաղտնաբառի փոփոխություն">
      {state === "done" ? (
        <p className="rounded-lg bg-green-50 p-4 text-sm text-green-800">✓ Հաստատված է։ Վերադարձեք ադմինի վահանակ և սահմանեք նոր գաղտնաբառը։</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">Հաստատեք, որ այս հասցեի գաղտնաբառը փոխում եք Դուք։ Եթե ոչ՝ փակեք էջը և փոխեք Ձեր գաղտնաբառերը։</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="button" onClick={confirm} disabled={state === "busy"} className={authButton}>
            {state === "busy" ? "..." : "Հաստատել"}
          </button>
        </div>
      )}
    </AuthCard>
  );
}
