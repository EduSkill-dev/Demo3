"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/client";
import { authErrorMessage, confirmUrl } from "@/lib/authErrors";
import AuthCard, { authButton, authInput, authLabel } from "@/components/auth/AuthCard";

// Only ever redirect to a path on this site (blocks //evil.com etc.).
function safeNext(): string | null {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export default function LoginPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setUnconfirmed(false);
    // The server signs in (and sets the session cookie): it logs the sign-in
    // and knows an admin's second address.
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    }).catch(() => null);
    const data = res
      ? ((await res.json().catch(() => ({}))) as {
          target?: string;
          role?: string;
          error?: { code?: string; message: string; status?: number };
        })
      : null;
    if (!res?.ok || !data?.target) {
      setBusy(false);
      const err = data?.error;
      setUnconfirmed(err?.code === "email_not_confirmed");
      return setError(err ? authErrorMessage(t, err) : t("errors.network"));
    }
    // Back to where they came from, else to their own dashboard. Admins
    // always land in the admin area.
    window.location.href = (data.role !== "admin" && safeNext()) || data.target;
  }

  async function resend() {
    const { error: err } = await createClient().auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: confirmUrl() },
    });
    if (err) return setError(authErrorMessage(t, err));
    setResent(true);
  }

  return (
    <AuthCard title={t("auth.loginTitle")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className={authLabel}>{t("auth.email")}</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={authInput} />
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <label htmlFor="password" className="text-sm font-medium text-ink">{t("auth.password")}</label>
            <Link href="/auth/forgot" className="text-xs font-semibold text-terracotta-500 hover:text-terracotta-700">
              {t("auth.forgot")}
            </Link>
          </div>
          <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={authInput} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {unconfirmed && (
          <button type="button" onClick={resend} disabled={resent} className="text-sm font-semibold text-terracotta-500 hover:text-terracotta-700 disabled:opacity-60">
            {resent ? t("auth.resent") : t("auth.resend")}
          </button>
        )}
        <button type="submit" disabled={busy} className={authButton}>
          {busy ? "..." : t("auth.loginButton")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-semibold text-terracotta-500 hover:text-terracotta-700">
          {t("header.register")}
        </Link>
      </p>
    </AuthCard>
  );
}
