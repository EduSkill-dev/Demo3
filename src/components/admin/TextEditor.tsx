"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adminAction, adminButton, adminGhost, adminInput } from "./adminApi";

export type TextEntry = { key: string; original: string; value: string | null }; // value = the saved replacement

// Every text of one section in one language. Changed fields are saved
// together; emptying a field (or "Restore") brings the built-in text back.
export default function TextEditor({ locale, entries }: { locale: string; entries: TextEntry[] }) {
  const router = useRouter();
  const saved = useMemo(() => Object.fromEntries(entries.map((e) => [e.key, e.value ?? e.original])), [entries]);
  const [draft, setDraft] = useState<Record<string, string>>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const dirty = entries.filter((e) => draft[e.key] !== saved[e.key]);

  function change(key: string, value: string) {
    setDone(false);
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    const res = await adminAction({
      action: "text.save",
      locale,
      entries: dirty.map((e) => ({ key: e.key, value: draft[e.key] })),
    });
    setBusy(false);
    if (res.error) return setError(res.error);
    setDone(true);
    router.refresh();
  }

  return (
    <div>
      <ul className="space-y-4">
        {entries.map((e) => {
          const value = draft[e.key];
          const changed = value !== e.original;
          return (
            <li key={e.key} className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <code className="text-xs text-muted">{e.key}</code>
                <div className="flex items-center gap-2">
                  {changed && <span className="rounded-full bg-apricot/15 px-2 py-0.5 text-[11px] font-semibold text-apricot-dark dark:text-apricot">Փոխված է</span>}
                  {changed && (
                    <button type="button" className={adminGhost} onClick={() => change(e.key, e.original)}>
                      Վերականգնել սկզբնականը
                    </button>
                  )}
                </div>
              </div>
              <textarea
                aria-label={e.key}
                rows={Math.min(12, Math.max(1, Math.ceil(value.length / 80) + (value.match(/\n/g)?.length ?? 0)))}
                value={value}
                onChange={(ev) => change(e.key, ev.target.value)}
                className={adminInput}
              />
              {changed && <p className="mt-1 whitespace-pre-line text-xs text-muted">Սկզբնական՝ {e.original}</p>}
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 border-t border-line bg-stone py-3">
        <button type="button" disabled={busy || dirty.length === 0} onClick={save} className={adminButton}>
          {busy ? "..." : `Պահպանել (${dirty.length})`}
        </button>
        {done && dirty.length === 0 && <span className="text-sm text-green-700 dark:text-green-400">✓ Պահպանված է</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
        <span className="text-xs text-muted">{"{name}"} տեսքի փոփոխականները պետք է մնան տեքստում։</span>
      </div>
    </div>
  );
}
