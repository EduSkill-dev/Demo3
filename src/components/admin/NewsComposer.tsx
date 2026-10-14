"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminAction, adminButton, adminInput } from "./adminApi";

const MAX = 4000; // Telegram's limit for one message

// Writes one post to the clubs' news channel.
export default function NewsComposer() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !confirm("Հրապարակե՞լ այս գրառումը ալիքում։ Հետո այն կարելի է փոխել կամ ջնջել միայն Telegram-ում։")) return;
    setBusy(true);
    setError(null);
    setDone(false);
    const res = await adminAction({ action: "news.post", body });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setText("");
    setDone(true);
    router.refresh();
  }

  return (
    <form onSubmit={post} className="max-w-3xl space-y-3 rounded-xl border border-line bg-surface p-5">
      <label htmlFor="news-text" className="block text-sm font-medium text-ink">Նոր գրառում</label>
      <textarea
        id="news-text"
        rows={8}
        maxLength={MAX}
        required
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDone(false);
        }}
        placeholder="Օրինակ՝ հարթակում նոր հնարավորություն․ հիմա կարող եք…"
        className={adminInput}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted">{text.length}/{MAX}</span>
        <div className="flex items-center gap-3">
          {done && <span className="text-sm font-medium text-green-700 dark:text-green-400">Հրապարակված է</span>}
          <button type="submit" disabled={busy || !text.trim()} className={adminButton}>
            {busy ? "..." : "Հրապարակել ալիքում"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
