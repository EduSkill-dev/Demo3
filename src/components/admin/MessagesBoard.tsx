"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatDate } from "@/i18n/client";
import { adminAction, adminButton } from "./adminApi";

export type Line = { id: string; fromAdmin?: boolean; adminName: string | null; body: string; at: string; via: string };
export type SupportThread = { userId: string; who: string; kind: "club" | "individual"; email: string; messages: Line[]; waiting: boolean; lastAt: string };
export type SuggestionItem = { id: string; message: string; email: string | null; phone: string | null; at: string; replies: Line[] };

const REFRESH_MS = 20_000; // every admin sees the others' answers within this
const SAVED = "culmen-admin-messages-collapsed";

// Two panes side by side: help chats and suggestions. Either can be folded
// away (the other then takes the whole width; remembered in this browser).
// Each item opens in place with its history and a box to answer.
export default function MessagesBoard({
  threads,
  suggestions,
  openThread,
  openSuggestion,
}: {
  threads: SupportThread[];
  suggestions: SuggestionItem[];
  openThread: string | null;
  openSuggestion: string | null;
}) {
  const router = useRouter();
  const [folded, setFolded] = useState<{ chat: boolean; ideas: boolean }>({ chat: false, ideas: false });
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(SAVED) ?? "null");
      if (v && typeof v.chat === "boolean" && typeof v.ideas === "boolean") setFolded(v);
    } catch {
      /* private mode: start unfolded */
    }
  }, []);
  const fold = (key: "chat" | "ideas") =>
    setFolded((f) => {
      const next = { ...f, [key]: !f[key] };
      try {
        localStorage.setItem(SAVED, JSON.stringify(next));
      } catch {
        /* nothing to keep */
      }
      return next;
    });

  // Others' answers (here or in Telegram) appear without reloading.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [router]);

  const waitingChats = threads.filter((x) => x.waiting).length;
  const waitingIdeas = suggestions.filter((x) => x.replies.length === 0).length;
  const both = !folded.chat && !folded.ideas;

  return (
    <div className={`mt-5 grid items-start gap-4 ${both ? "xl:grid-cols-2" : ""}`}>
      <Pane title="Օգնության չաթ" waiting={waitingChats} total={threads.length} folded={folded.chat} onFold={() => fold("chat")}>
        {threads.length === 0 ? (
          <Empty text="Դեռ գրող չկա։" />
        ) : (
          threads.map((x) => (
            <Item
              key={x.userId}
              startOpen={openThread === x.userId}
              title={x.who}
              subtitle={x.email}
              tag={x.kind === "club" ? "Ակումբ" : "Անհատ"}
              preview={x.messages[x.messages.length - 1].body}
              at={x.lastAt}
              answeredBy={x.waiting ? null : x.messages[x.messages.length - 1].adminName}
              lines={x.messages}
              send={(text) => adminAction({ action: "support.reply", userId: x.userId, body: text })}
              maxLength={1000}
              hint="Պատասխանը կհայտնվի մարդու չաթում, իսկ նամակով կիմանա, որ պատասխանել են։"
            />
          ))
        )}
      </Pane>

      <Pane title="Առաջարկներ" waiting={waitingIdeas} total={suggestions.length} folded={folded.ideas} onFold={() => fold("ideas")}>
        {suggestions.length === 0 ? (
          <Empty text="Դեռ առաջարկ չկա։" />
        ) : (
          suggestions.map((x) => (
            <Item
              key={x.id}
              startOpen={openSuggestion === x.id}
              title={x.email ?? "—"}
              subtitle={x.phone ?? ""}
              preview={x.message}
              at={x.replies.length ? x.replies[x.replies.length - 1].at : x.at}
              answeredBy={x.replies.length ? x.replies[x.replies.length - 1].adminName : null}
              lines={[{ id: "q", adminName: null, body: x.message, at: x.at, via: "site" }, ...x.replies.map((r) => ({ ...r, fromAdmin: true }))]}
              send={(text) => adminAction({ action: "suggestion.reply", id: x.id, body: text })}
              maxLength={4000}
              hint="Պատասխանը նամակով կգնա առաջարկի հեղինակին։"
              disabled={!x.email}
            />
          ))
        )}
      </Pane>
    </div>
  );
}

function Pane({ title, waiting, total, folded, onFold, children }: { title: string; waiting: number; total: number; folded: boolean; onFold: () => void; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-surface">
      <button type="button" onClick={onFold} aria-expanded={!folded} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="font-serif text-lg font-semibold text-heading">{title}</span>
        {waiting > 0 && <span className="rounded-full bg-terracotta-500 px-2 py-0.5 text-xs font-bold text-white">{waiting} սպասող</span>}
        <span className="text-xs text-muted">ընդամենը՝ {total}</span>
        <svg viewBox="0 0 20 20" className={`ml-auto h-5 w-5 text-muted transition ${folded ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      {!folded && <div className="max-h-[75vh] space-y-2 overflow-y-auto border-t border-line p-3">{children}</div>}
    </section>
  );
}

const Empty = ({ text }: { text: string }) => <p className="px-2 py-6 text-center text-sm text-muted">{text}</p>;

function Item(props: {
  startOpen: boolean;
  title: string;
  subtitle: string;
  tag?: string;
  preview: string;
  at: string;
  answeredBy: string | null;
  lines: Line[];
  send: (text: string) => Promise<{ error: string | null }>;
  maxLength: number;
  hint: string;
  disabled?: boolean;
}) {
  const fmt = useFormatDate();
  const router = useRouter();
  const [open, setOpen] = useState(props.startOpen);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    const res = await props.send(text.trim());
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setText("");
    router.refresh();
  }

  const waiting = props.answeredBy === null;
  return (
    <article className={`rounded-xl border ${waiting ? "border-terracotta-500/50" : "border-line"} bg-stone/40`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 px-3 py-2.5 text-left">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${waiting ? "bg-terracotta-500" : "bg-spruce-300"}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="truncate font-semibold text-ink">{props.title}</span>
            {props.tag && <span className="text-[11px] font-semibold uppercase text-muted">{props.tag}</span>}
            <span className="ml-auto shrink-0 text-xs text-muted">{fmt(props.at, "dateTime")}</span>
          </span>
          {props.subtitle && <span className="block truncate text-xs text-muted">{props.subtitle}</span>}
          {!open && <span className="mt-0.5 block truncate text-sm text-ink/80">{props.preview}</span>}
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${waiting ? "bg-terracotta-100 text-terracotta-700" : "bg-spruce-100 text-spruce-700"}`}>
            {waiting ? "Սպասում է պատասխանի" : `Պատասխանեց՝ ${props.answeredBy}`}
          </span>
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-3 pb-3 pt-2">
          <ul className="space-y-2">
            {props.lines.map((l) => (
              <li key={l.id} className={`flex ${l.fromAdmin ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${l.fromAdmin ? "bg-spruce-500 text-white" : "border border-line bg-surface text-ink"}`}>
                  <p className="whitespace-pre-line break-words">{l.body}</p>
                  <p className={`mt-1 text-[11px] ${l.fromAdmin ? "text-white/75" : "text-muted"}`}>
                    {l.fromAdmin ? `${l.adminName ?? "Ադմին"} · ${l.via === "site" ? "կայքից" : "Telegram-ից"} · ` : ""}
                    {fmt(l.at, "dateTime")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {props.disabled ? (
            <p className="mt-3 text-xs text-muted">Հեղինակը էլ. հասցե չի թողել, պատասխանել հնարավոր չէ։</p>
          ) : (
            <form onSubmit={submit} className="mt-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={props.maxLength}
                placeholder="Ձեր պատասխանը…"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-terracotta-500 focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button type="submit" disabled={busy || !text.trim()} className={adminButton}>
                  {busy ? "..." : "Պատասխանել"}
                </button>
                <span className="text-xs text-muted">{props.hint}</span>
              </div>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </form>
          )}
        </div>
      )}
    </article>
  );
}
