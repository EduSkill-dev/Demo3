"use client";

import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { adminAction, adminButton } from "./adminApi";

const SECURITY = "/api/admin/security";

// A new device of the super admin: the admin area opens after a touch of the
// security key; the device is trusted from then on. Lost key → recovery code.
export default function KeyGate() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setError(null);
    const start = await adminAction<{ options: Parameters<typeof startAuthentication>[0]["optionsJSON"] }>({ action: "verify.options" }, SECURITY);
    if (start.error !== null) return setBusy(false), setError(start.error);
    let response;
    try {
      response = await startAuthentication({ optionsJSON: start.data.options });
    } catch {
      setBusy(false);
      return setError("Բանալին չհաստատվեց (չեղարկվեց կամ ժամանակը սպառվեց)։ Փորձեք նորից։");
    }
    const done = await adminAction({ action: "verify.verify", response }, SECURITY);
    if (done.error !== null) return setBusy(false), setError(done.error);
    window.location.reload();
  }

  return (
    <div className="max-w-md space-y-4 rounded-2xl border border-line bg-surface p-6">
      <p className="text-sm text-ink">
        Սա նոր սարք է։ Ադմինի վահանակը բացելու համար միացրեք անվտանգության բանալին (YubiKey) և հպեք դրան։ Հետո այս սարքը կհամարվի վստահելի։
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="button" onClick={verify} disabled={busy} className={adminButton}>
        {busy ? "Սպասում ենք բանալուն…" : "Հաստատել բանալիով"}
      </button>
      <p className="text-xs text-muted">
        Բանալին մոտը չէ՞․ <a href="/auth/admin-recovery" className="font-semibold text-terracotta-600 hover:underline">մուտք մեկանգամյա կոդով</a>
      </p>
    </div>
  );
}
