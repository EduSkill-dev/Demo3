"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/client";
import { serverErrorMessage } from "@/lib/serverErrors";

// The club's answer to one comment: shown when there is one, written or
// changed in place (empty removes it).
export default function ReplyBox({ ratingId, initial }: { ratingId: string; initial: string }) {
  const t = useT();
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().rpc("club_reply_rating", { p_rating: ratingId, p_reply: text });
    setBusy(false);
    if (err) return setError(serverErrorMessage(t, err.message));
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="mt-3 border-l-2 border-line pl-3">
        {initial && <p className="whitespace-pre-line text-ink"><b>{t("clubComments.yourReply")}</b> {initial}</p>}
        <button type="button" onClick={() => setEditing(true)} className="mt-1 text-xs font-semibold text-terracotta-600 hover:underline dark:text-terracotta-300">
          {initial ? t("clubComments.edit") : t("clubComments.reply")}
        </button>
      </div>
    );
  }
  return (
    <div className="mt-3">
      <textarea
        rows={3}
        maxLength={1000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={t("clubComments.reply")}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/30"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-spruce-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-spruce-900 disabled:opacity-50">
          {busy ? "…" : t("common.save")}
        </button>
        <button type="button" onClick={() => { setText(initial); setEditing(false); setError(null); }} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink">
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
