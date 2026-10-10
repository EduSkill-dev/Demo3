"use client";

import PasswordInput from "@/components/ui/PasswordInput";
import { useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { MIN_PASSWORD, authErrorMessage } from "@/lib/authErrors";
import AuthCard, { authButton, authInput, authLabel } from "@/components/auth/AuthCard";
import CheckEmail from "@/components/auth/CheckEmail";

// Clubs sign up with just the basics; the package is chosen later from the
// dashboard's Packages section.
export default function ClubRegisterPage() {
  const t = useT();
  const [clubName, setClubName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(t("auth.weakPassword"));
    if (password !== repeat) return setError(t("auth.passwordsDiffer"));

    setBusy(true);
    // The server creates the account: it checks the phone (and club name),
    // counts sign-ups per address and sends the confirmation email.
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "club", email: email.trim(), password, phone: phone.trim(), clubName: clubName.trim() }),
    }).catch(() => null);
    const data = res
      ? ((await res.json().catch(() => ({}))) as { session?: boolean; error?: { code?: string; message: string; status?: number } })
      : null;
    setBusy(false);
    if (!res?.ok || !data) return setError(data?.error ? authErrorMessage(t, data.error) : t("errors.network"));
    if (data.session) window.location.href = "/auth/confirmed";
    else setSentTo(email.trim());
  }

  if (sentTo) return <CheckEmail email={sentTo} />;

  return (
    <AuthCard title={t("auth.clubTitle")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className={authLabel}>{t("auth.clubName")}</label>
          <input id="name" required minLength={2} maxLength={100} autoComplete="organization" value={clubName} onChange={(e) => setClubName(e.target.value)} className={authInput} />
        </div>
        <div>
          <label htmlFor="email" className={authLabel}>{t("auth.email")}</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={authInput} />
        </div>
        <div>
          <label htmlFor="phone" className={authLabel}>{t("auth.phone")}</label>
          <input id="phone" type="tel" required pattern="[+0-9 \(\)\-]{8,20}" placeholder="+374 XX XXXXXX" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={authInput} />
        </div>
        <div>
          <label htmlFor="password" className={authLabel}>{t("auth.password")}</label>
          <PasswordInput id="password" required minLength={MIN_PASSWORD} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={authInput} />
          <p className="mt-1 text-xs text-muted">{t("auth.passwordHint")}</p>
        </div>
        <div>
          <label htmlFor="repeat" className={authLabel}>{t("auth.passwordRepeat")}</label>
          <PasswordInput id="repeat" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={authInput} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={authButton}>
          {busy ? "..." : t("auth.registerButton")}
        </button>
        <p className="text-center text-sm text-muted">
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="font-semibold text-terracotta-500 hover:text-terracotta-700">{t("header.login")}</Link>
        </p>
      </form>
    </AuthCard>
  );
}
