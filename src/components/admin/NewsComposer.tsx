"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminAction, adminButton, adminInput } from "./adminApi";

const MAX = 4000; // Telegram's limit for one message

// Writes one platform post: for individuals, clubs or both, ordinary or
// important. The line under the choices says where exactly it goes.
export default function NewsComposer({ channelReady }: { channelReady: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [toIndividuals, setToIndividuals] = useState(false);
  const [toClubs, setToClubs] = useState(true);
  const [important, setImportant] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const who = [toIndividuals && "անհատներին", toClubs && "ակումբներին"].filter(Boolean).join(" և ");
  const where = !who
    ? null
    : [
        `Կայքում՝ բոլոր ${who} (զանգակ)`,
        toClubs ? (channelReady ? "Telegram-ի «Culmen's Community» ալիք" : "Telegram-ի ալիքը կապված չէ") : null,
        important ? `Էլ. նամակ՝ բոլոր ${who}` : `Էլ. նամակ՝ «Ծանուցումներ հարթակից» միացրած ${who}`,
      ].filter(Boolean);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !who) return;
    if (!confirm(`Հրապարակե՞լ գրառումը ${who}${important ? " որպես կարևոր" : ""}։${toClubs ? " Telegram-ում այն փոխել կամ ջնջել կարելի է միայն Telegram-ից։" : ""}`)) return;
    setBusy(true);
    setError(null);
    setDone(null);
    const res = await adminAction<{ emailed?: number; channelError?: string | null }>({ action: "news.post", body, toIndividuals, toClubs, important });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setText("");
    setDone(`Հրապարակված է․ էլ. նամակներ՝ ${res.data?.emailed ?? 0}${res.data?.channelError ? ` · Telegram՝ չստացվեց (${res.data.channelError})` : ""}`);
    router.refresh();
  }

  const box = (on: boolean, set: (v: boolean) => void, label: string, hint: string, tone = "spruce") => (
    <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border-2 px-3 py-2.5 text-sm transition ${on ? (tone === "red" ? "border-red-500 bg-red-50 dark:bg-red-950/30" : "border-spruce-500 bg-spruce-100/60 dark:bg-spruce-900/40") : "border-line bg-surface"}`}>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className={`mt-0.5 h-4 w-4 shrink-0 ${tone === "red" ? "accent-red-600" : "accent-spruce-500"}`} />
      <span>
        <span className="block font-semibold text-ink">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );

  return (
    <form onSubmit={post} className="max-w-3xl space-y-4 rounded-xl border border-line bg-surface p-5">
      <label htmlFor="news-text" className="block text-sm font-medium text-ink">Նոր գրառում</label>
      <textarea
        id="news-text"
        rows={8}
        maxLength={MAX}
        required
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDone(null);
        }}
        placeholder="Օրինակ՝ հարթակում նոր հնարավորություն․ հիմա կարող եք…"
        className={adminInput}
      />
      <div className="grid gap-2 sm:grid-cols-3">
        {box(toIndividuals, setToIndividuals, "Անհատներին", "Կայքում բոլորին, նամակով՝ ըստ կարգավորման")}
        {box(toClubs, setToClubs, "Ակումբներին", "Նաև Telegram-ի ալիքում")}
        {box(important, setImportant, "Կարևոր", "Նամակ բոլորին՝ անկախ կարգավորումից (կանոններ, գաղտնիություն)", "red")}
      </div>
      {where ? (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted">
          {where.map((w) => (
            <li key={w as string}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs font-semibold text-red-600">Ընտրեք՝ անհատներին, ակումբներին կամ երկուսին։</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted">{text.length}/{MAX}</span>
        <div className="flex items-center gap-3">
          {done && <span className="text-sm font-medium text-green-700 dark:text-green-400">{done}</span>}
          <button type="submit" disabled={busy || !text.trim() || !who} className={adminButton}>
            {busy ? "..." : "Հրապարակել"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
