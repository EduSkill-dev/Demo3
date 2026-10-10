"use client";

import PasswordInput from "@/components/ui/PasswordInput";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/client";
import { MIN_PASSWORD, authErrorMessage } from "@/lib/authErrors";
import AuthCard, { authButton, authInput, authLabel } from "@/components/auth/AuthCard";

// Reached from the recovery email: /auth/confirm already signed the person in.
export default function ResetPasswordPage() {
  const t = useT();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(t("auth.weakPassword"));
    if (password !== repeat) return setError(t("auth.passwordsDiffer"));
    setBusy(true);
    const { error: err } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(authErrorMessage(t, err));
    setDone(true);
    setTimeout(() => (window.location.href = "/"), 1500);
  }

  return (
    <AuthCard title={t("auth.resetTitle")}>
      {done ? (
        <p className="rounded-lg bg-green-50 p-4 text-sm text-green-800">{t("auth.passwordSaved")}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="password" className={authLabel}>{t("auth.newPassword")}</label>
            <PasswordInput id="password" required minLength={MIN_PASSWORD} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={authInput} />
            <p className="mt-1 text-xs text-muted">{t("auth.passwordHint")}</p>
          </div>
          <div>
            <label htmlFor="repeat" className={authLabel}>{t("auth.passwordRepeat")}</label>
            <PasswordInput id="repeat" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={authInput} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className={authButton}>
            {busy ? "..." : t("auth.savePassword")}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
