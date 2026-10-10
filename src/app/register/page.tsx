"use client";

import PasswordInput from "@/components/ui/PasswordInput";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { MIN_PASSWORD, authErrorMessage } from "@/lib/authErrors";
import AuthCard, { authButton, authInput, authLabel } from "@/components/auth/AuthCard";
import CheckEmail from "@/components/auth/CheckEmail";

const today = () => new Date().toISOString().slice(0, 10);

export default function RegisterPage() {
  const t = useT();
  // /register?as=individual skips the chooser (the header menu links there).
  const [step, setStep] = useState<"choose" | "individual">("choose");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("as") === "individual") setStep("individual");
  }, []);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
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
    if (!birthDate || birthDate > today() || birthDate < "1900-01-01") return setError(t("auth.badBirthDate"));
    if (password.length < MIN_PASSWORD) return setError(t("auth.weakPassword"));
    if (password !== repeat) return setError(t("auth.passwordsDiffer"));

    setBusy(true);
    // The server creates the account: it checks the phone (and club name),
    // counts sign-ups per address and sends the confirmation email.
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "individual", email: email.trim(), password, phone: phone.trim(), firstName: firstName.trim(), lastName: lastName.trim(), birthDate, gender }),
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

  if (step === "choose") {
    const card =
      "block w-full rounded-xl border border-line bg-surface p-5 text-left transition hover:border-spruce-500 hover:shadow-sm";
    return (
      <AuthCard title={t("auth.chooseTitle")}>
        <div className="space-y-3">
          <button type="button" onClick={() => setStep("individual")} className={card}>
            <span className="text-lg">🥾</span> <b className="text-ink">{t("auth.individual")}</b>
            <p className="mt-1 text-sm text-muted">{t("auth.individualHint")}</p>
          </button>
          <Link href="/register/club" className={card}>
            <span className="text-lg">🏕️</span> <b className="text-ink">{t("auth.club")}</b>
            <p className="mt-1 text-sm text-muted">{t("auth.clubHint")}</p>
          </Link>
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="font-semibold text-terracotta-500 hover:text-terracotta-700">{t("header.login")}</Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("auth.individualTitle")} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="first" className={authLabel}>{t("auth.firstName")}</label>
            <input id="first" required maxLength={60} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={authInput} />
          </div>
          <div>
            <label htmlFor="last" className={authLabel}>{t("auth.lastName")}</label>
            <input id="last" required maxLength={60} autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={authInput} />
          </div>
          <div>
            <label htmlFor="birth" className={authLabel}>{t("auth.birthDate")}</label>
            <input id="birth" type="date" required min="1900-01-01" max={today()} autoComplete="bday" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={authInput} />
          </div>
          <div>
            <label htmlFor="gender" className={authLabel}>{t("auth.gender")}</label>
            <select id="gender" required value={gender} onChange={(e) => setGender(e.target.value)} className={authInput}>
              <option value="" disabled>—</option>
              <option value="female">{t("auth.female")}</option>
              <option value="male">{t("auth.male")}</option>
            </select>
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
