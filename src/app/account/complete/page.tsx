"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/client";
import { serverErrorMessage } from "@/lib/serverErrors";
import AuthCard, { authButton, authInput, authLabel } from "@/components/auth/AuthCard";

const today = () => new Date().toISOString().slice(0, 10);

// Shown once to someone who came in through Google: the details every
// individual account has. What Google already gave (the name) is filled in.
export default function CompleteProfilePage() {
  const t = useT();
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return window.location.replace("/login");
      setUserId(auth.user.id);
      setEmail(auth.user.email ?? "");
      const { data } = await supabase.from("profiles").select("first_name, last_name, birth_date, gender, phone").eq("id", auth.user.id).single();
      const p = (data ?? {}) as { first_name?: string | null; last_name?: string | null; birth_date?: string | null; gender?: string | null; phone?: string | null };
      // Google sends the full name; split it where the form has two fields.
      const meta = auth.user.user_metadata as { given_name?: string; family_name?: string; full_name?: string; name?: string };
      const full = (meta.full_name ?? meta.name ?? "").trim().split(/\s+/);
      setFirstName(p.first_name ?? meta.given_name ?? full[0] ?? "");
      setLastName(p.last_name ?? meta.family_name ?? full.slice(1).join(" "));
      setBirthDate(p.birth_date ?? "");
      setGender(p.gender ?? "");
      setPhone(p.phone ?? "");
      setReady(true);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    if (!birthDate || birthDate > today() || birthDate < "1900-01-01") return setError(t("auth.badBirthDate"));
    setBusy(true);
    const { error: err } = await createClient()
      .from("profiles")
      .update({ first_name: firstName.trim(), last_name: lastName.trim(), birth_date: birthDate, gender, phone: phone.trim() })
      .eq("id", userId);
    if (err) {
      setBusy(false);
      return setError(serverErrorMessage(t, err.message));
    }
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  }

  if (!ready) return <AuthCard title={t("auth.completeTitle")}><p className="text-center text-muted">{t("common.loading")}</p></AuthCard>;

  return (
    <AuthCard title={t("auth.completeTitle")}>
      <p className="mb-5 text-center text-sm text-muted">{t("auth.completeText")}</p>
      <form onSubmit={save} className="space-y-4">
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
        </div>
        <div>
          <label htmlFor="phone" className={authLabel}>{t("auth.phone")}</label>
          <input id="phone" type="tel" required pattern="[+0-9 \(\)\-]{8,20}" placeholder="+374 XX XXXXXX" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={authInput} />
        </div>
        <div>
          <label htmlFor="email" className={authLabel}>{t("auth.email")}</label>
          <input id="email" type="email" value={email} readOnly disabled className={`${authInput} opacity-70`} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={authButton}>
          {busy ? "..." : t("auth.completeButton")}
        </button>
      </form>
    </AuthCard>
  );
}
