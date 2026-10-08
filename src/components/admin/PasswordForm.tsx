"use client";

import { useState } from "react";
import { adminAction, adminButton, adminInput } from "./adminApi";

// Replaces the one-time password (required before anything else) or lets an
// admin change their own password later.
export default function PasswordForm({ forced }: { forced: boolean }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== repeat) return setError("Գաղտնաբառերը չեն համընկնում։");
    setBusy(true);
    const res = await adminAction({ action: "password.change", password });
    setBusy(false);
    if (res.error) return setError(res.error);
    if (forced) return window.location.assign("/admin");
    setPassword("");
    setRepeat("");
    setDone(true);
  }

  return (
    <form onSubmit={submit} className="max-w-sm space-y-4">
      {forced && (
        <p className="rounded-lg border border-terracotta-500/40 bg-terracotta-500/10 p-3 text-sm text-ink">
          Դուք մուտք եք գործել մեկանգամյա գաղտնաբառով։ Շարունակելու համար սահմանեք Ձեր սեփական գաղտնաբառը։
        </p>
      )}
      <div>
        <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-ink">Նոր գաղտնաբառ</label>
        <input id="new-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={adminInput} />
      </div>
      <div>
        <label htmlFor="repeat-password" className="mb-1 block text-sm font-medium text-ink">Կրկնեք գաղտնաբառը</label>
        <input id="repeat-password" type="password" required minLength={8} autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={adminInput} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-green-700 dark:text-green-400">✓ Գաղտնաբառը փոխված է։</p>}
      <button type="submit" disabled={busy} className={adminButton}>
        {busy ? "..." : "Պահպանել գաղտնաբառը"}
      </button>
    </form>
  );
}
