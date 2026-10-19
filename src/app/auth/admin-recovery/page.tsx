"use client";

import { useState } from "react";
import AuthCard, { authButton, authInput, authLabel } from "@/components/auth/AuthCard";

// The super admin's way in with a recovery code (admin area: Armenian only).
// Not linked from the public login form — it shows up after a 30-minute
// lock and on "forgot password" for such an address.
export default function AdminRecoveryPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), code }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { target?: string; error?: string }) : null;
    if (!res?.ok || !data?.target) {
      setBusy(false);
      return setError(data?.error ?? "Սերվերին կապվել չստացվեց։ Փորձեք նորից։");
    }
    window.location.href = data.target;
  }

  return (
    <AuthCard title="Մուտք մեկանգամյա կոդով">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">
          Գլխավոր ադմինի համար․ Ձեր երկու հասցեներից որևէ մեկը և պահված 10 կոդերից մեկը։ Կոդը գործում է մեկ անգամ, մյուս բոլոր սարքերից հաշիվը դուրս կգա։
        </p>
        <div>
          <label htmlFor="email" className={authLabel}>Էլ. հասցե</label>
          <input id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={authInput} />
        </div>
        <div>
          <label htmlFor="code" className={authLabel}>Մեկանգամյա կոդ</label>
          <input
            id="code"
            required
            autoComplete="one-time-code"
            spellCheck={false}
            placeholder="XXXX-XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className={`${authInput} font-mono tracking-wider`}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={authButton}>
          {busy ? "..." : "Մուտք"}
        </button>
      </form>
    </AuthCard>
  );
}
