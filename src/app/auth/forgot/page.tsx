"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/client";
import { authErrorMessage, confirmUrl } from "@/lib/authErrors";
import AuthCard, { authButton, authInput, authLabel } from "@/components/auth/AuthCard";

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const router = useRouter();

  // A blocked account reads the notice, then lands on the home page.
  useEffect(() => {
    if (!blocked) return;
    const timer = setTimeout(() => router.push("/"), 6000);
    return () => clearTimeout(timer);
  }, [blocked, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const check = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    })
      .then((r) => r.json() as Promise<{ blocked?: boolean }>)
      .catch(() => ({ blocked: false }));
    if (check.blocked) {
      setBusy(false);
      return setBlocked(true);
    }
    const { error: err } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: confirmUrl("recovery"),
    });
    setBusy(false);
    // Same answer whether or not the account exists (no account probing).
    if (err && err.status === 429) return setError(authErrorMessage(t, err));
    setSent(true);
  }

  return (
    <AuthCard title={t("auth.forgotTitle")}>
      {blocked ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{t("auth.blockedNoAction")}</p>
      ) : sent ? (
        <p className="rounded-lg bg-green-50 p-4 text-sm text-green-800">{t("auth.linkSent")}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted">{t("auth.forgotText")}</p>
          <div>
            <label htmlFor="email" className={authLabel}>{t("auth.email")}</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={authInput} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className={authButton}>
            {busy ? "..." : t("auth.sendLink")}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
