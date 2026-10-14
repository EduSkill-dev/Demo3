"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/client";
import { serverErrorMessage } from "@/lib/serverErrors";
import AuthCard, { authButton, authInput, authLabel } from "@/components/auth/AuthCard";

// The second step of registering a club with Google: the club's name, the
// person registering it (taken from Google, can be corrected) and a phone.
export default function ClubWithGooglePage() {
  const t = useT();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [clubName, setClubName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return window.location.replace("/register/club");
      const { data: p } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
      if ((p as { role?: string } | null)?.role === "club") return window.location.replace("/dashboard");
      setEmail(auth.user.email ?? "");
      const meta = auth.user.user_metadata as { given_name?: string; family_name?: string; full_name?: string; name?: string };
      const full = (meta.full_name ?? meta.name ?? "").trim().split(/\s+/);
      setFirstName(meta.given_name ?? full[0] ?? "");
      setLastName(meta.family_name ?? full.slice(1).join(" "));
      setReady(true);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/become-club", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubName: clubName.trim(), firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : null;
    if (!res?.ok) {
      setBusy(false);
      return setError(data?.error ? serverErrorMessage(t, data.error) : t("errors.network"));
    }
    window.location.href = "/dashboard";
  }

  if (!ready) return <AuthCard title={t("auth.clubTitle")}><p className="text-center text-muted">{t("common.loading")}</p></AuthCard>;

  return (
    <AuthCard title={t("auth.clubTitle")}>
      <p className="mb-5 text-center text-sm text-muted">{t("auth.clubGoogleText")}</p>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label htmlFor="name" className={authLabel}>{t("auth.clubName")}</label>
          <input id="name" required minLength={2} maxLength={100} autoComplete="organization" value={clubName} onChange={(e) => setClubName(e.target.value)} className={authInput} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="first" className={authLabel}>{t("auth.firstName")}</label>
            <input id="first" required maxLength={60} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={authInput} />
          </div>
          <div>
            <label htmlFor="last" className={authLabel}>{t("auth.lastName")}</label>
            <input id="last" required maxLength={60} autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={authInput} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted">{t("auth.clubPersonHint")}</p>
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
