"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useFormatDate, useT } from "@/i18n/client";
import { serverErrorMessage } from "@/lib/serverErrors";

type Message = { id: number; body: string; from_admin: boolean; admin_name: string | null; created_at: string };
const MAX = 1000;

// The help chat on the Help page. A signed-in individual or club writes to
// the admins and sees the whole conversation; answers appear by themselves
// while the page is open. Visitors are pointed to sign-in and to the
// suggestions form at the bottom of the site.
export default function SupportChat() {
  const t = useT();
  const fmt = useFormatDate();
  const [state, setState] = useState<"loading" | "guest" | "admin" | "ready">("loading");
  const [blocked, setBlocked] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const userId = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!userId.current) return;
    const { data } = await createClient().from("support_messages").select("id, body, from_admin, admin_name, created_at").eq("user_id", userId.current).order("id").limit(500);
    if (data) setMessages((cur) => (cur.length === data.length ? cur : (data as Message[])));
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setState("guest");
      const { data: p } = await supabase.from("profiles").select("role, chat_blocked").eq("id", auth.user.id).single();
      const profile = p as { role?: string; chat_blocked?: boolean } | null;
      if (profile?.role === "admin") return setState("admin");
      userId.current = auth.user.id;
      setBlocked(profile?.chat_blocked === true);
      await load();
      setState("ready");
    })();
  }, [load]);

  // Answers arrive from Telegram: look for them while the page is visible.
  useEffect(() => {
    if (state !== "ready") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 8000);
    return () => clearInterval(timer);
  }, [state, load]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { error?: string; message?: Message }) : null;
    setBusy(false);
    if (!res?.ok || !data?.message) return setError(data?.error ? serverErrorMessage(t, data.error) : t("errors.network"));
    setMessages((cur) => [...cur, data.message!]);
    setText("");
  }

  if (state === "loading") return <p className="text-muted">{t("common.loading")}</p>;
  if (state === "admin") return null;

  if (state === "guest") {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-serif text-xl font-semibold text-heading">{t("support.title")}</h2>
        <p className="mt-2 text-ink">{t("support.guestText")}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/login?next=/help" className="rounded-full bg-spruce-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-spruce-900">{t("header.login")}</Link>
          <Link href="/register" className="rounded-full border-2 border-spruce-900 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand dark:border-line">{t("header.register")}</Link>
        </div>
        <p className="mt-4 text-sm text-muted">{t("support.guestForm")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="border-b border-line px-5 py-3">
        <h2 className="font-serif text-xl font-semibold text-heading">{t("support.title")}</h2>
        <p className="text-sm text-muted">{t("support.intro")}</p>
      </header>
      <div ref={list} className="max-h-[26rem] min-h-[10rem] space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
        {messages.length === 0 && <p className="py-6 text-center text-sm text-muted">{t("support.empty")}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from_admin ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${m.from_admin ? "bg-sand text-ink" : "bg-spruce-500 text-white"}`}>
              {m.from_admin && <p className="mb-0.5 text-xs font-semibold text-terracotta-700 dark:text-terracotta-300">{m.admin_name || t("support.admin")}</p>}
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-1 text-[11px] ${m.from_admin ? "text-muted" : "text-white/70"}`}>{fmt(m.created_at, "dateTime")}</p>
            </div>
          </div>
        ))}
      </div>
      {blocked ? (
        <p className="border-t border-line px-5 py-4 text-sm text-red-600">{t("support.blocked")}</p>
      ) : (
        <form onSubmit={send} className="border-t border-line px-5 py-4">
          <label htmlFor="support-text" className="sr-only">{t("support.placeholder")}</label>
          <textarea
            id="support-text"
            data-view
            rows={3}
            maxLength={MAX}
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("support.placeholder")}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/30"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-muted">{text.length}/{MAX}</span>
            <button data-view type="submit" disabled={busy || !text.trim()} className="rounded-full bg-spruce-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-spruce-900 disabled:opacity-50">
              {busy ? "..." : t("support.send")}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </form>
      )}
    </section>
  );
}
