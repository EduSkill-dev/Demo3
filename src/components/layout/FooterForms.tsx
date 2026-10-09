"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { serverErrorMessage } from "@/lib/serverErrors";

const field =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-apricot-500 focus:outline-none";

// The signed-in person's verified contact details (null for visitors).
export type FooterViewer = { email: string; phone: string | null; news: boolean };

const locked = "cursor-not-allowed opacity-70";

// Hidden from people, visible to bots that fill in every input.
const Honeypot = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <input
    type="text"
    tabIndex={-1}
    autoComplete="off"
    aria-hidden
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="absolute -left-[9999px] h-0 w-0 opacity-0"
    name="website"
  />
);

async function post(url: string, body: object): Promise<boolean> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return !!res?.ok;
}

// What the server answered, as the sentence to show.
type NewsState = "subscribed" | "already" | "sent" | "pending" | "account";

export function NewsletterForm({ viewer }: { viewer: FooterViewer | null }) {
  const t = useT();
  const [email, setEmail] = useState(viewer?.email ?? "");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  // A signed-in account that receives the news has nothing to fill in.
  const [done, setDone] = useState<NewsState | null>(viewer?.news ? "already" : null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, website }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { state?: NewsState; error?: { message?: string } }) : null;
    setBusy(false);
    if (!res?.ok || !data?.state) return setError(serverErrorMessage(t, data?.error?.message));
    setDone(data.state);
  }

  const message: Record<NewsState, string> = {
    subscribed: `✓ ${t("footer.subscribedDirect")}`,
    already: `✓ ${t("footer.alreadySubscribed")}`,
    sent: `✉️ ${t("footer.subscribed")}`,
    pending: `✉️ ${t("footer.pendingConfirm")}`,
    account: t("footer.accountExists"),
  };

  return (
    <div>
      <h2 className="font-serif text-lg font-semibold text-white">{t("footer.newsletterTitle")}</h2>
      <p className="mt-1 text-sm text-white/70">{t("footer.newsletterText")}</p>
      {done ? (
        <p role="status" className="mt-4 rounded-lg bg-white/10 p-3 text-sm text-white">
          {message[done]}
          {viewer && <span className="mt-1 block text-xs text-white/70">{t("footer.manageNews")}</span>}
        </p>
      ) : (
        <form onSubmit={submit} className="relative mt-4 flex flex-col gap-2 sm:flex-row">
          <Honeypot value={website} onChange={setWebsite} />
          <label className="sr-only" htmlFor="newsletter-email">{t("auth.email")}</label>
          <input
            id="newsletter-email"
            required
            type="email"
            placeholder={t("auth.email")}
            value={email}
            readOnly={!!viewer}
            onChange={(e) => setEmail(e.target.value)}
            className={`${field} ${viewer ? locked : ""}`}
          />
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 rounded-full bg-apricot-500 px-4 py-2.5 text-sm font-bold text-spruce-900 hover:bg-apricot-300 disabled:opacity-60"
          >
            {t("footer.subscribe")}
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}

export function SuggestionForm({ viewer }: { viewer: FooterViewer | null }) {
  const t = useT();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(viewer?.email ?? "");
  const [phone, setPhone] = useState(viewer?.phone ?? "");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setState((await post("/api/contact", { message, email, phone, website })) ? "sent" : "error");
  }

  return (
    <div>
      <h2 className="font-serif text-lg font-semibold text-white">{t("footer.suggestTitle")}</h2>
      <p className="mt-1 text-sm text-white/70">{t("footer.suggestText")}</p>
      {state === "sent" ? (
        <p className="mt-4 rounded-lg bg-white/10 p-3 text-sm text-white">{viewer ? `✓ ${t("footer.sentDirect")}` : `✉️ ${t("footer.sent")}`}</p>
      ) : (
        <form onSubmit={submit} className="relative mt-4 space-y-2">
          <Honeypot value={website} onChange={setWebsite} />
          <label className="sr-only" htmlFor="suggest-message">{t("footer.message")}</label>
          <textarea
            id="suggest-message"
            required
            rows={3}
            maxLength={4000}
            placeholder={t("footer.message")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={field}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input type="email" required aria-label={t("auth.email")} placeholder={t("auth.email")} value={email} readOnly={!!viewer} onChange={(e) => setEmail(e.target.value)} className={`${field} ${viewer ? locked : ""}`} />
            <input type="tel" aria-label={t("auth.phone")} placeholder={t("footer.phoneOptional")} value={phone} readOnly={!!viewer?.phone} onChange={(e) => setPhone(e.target.value)} className={`${field} ${viewer?.phone ? locked : ""}`} />
          </div>
          {!viewer && <p className="text-xs text-white/60">{t("footer.confirmNote")}</p>}
          <button
            type="submit"
            disabled={state === "busy"}
            className="rounded-full bg-apricot-500 px-4 py-2.5 text-sm font-bold text-spruce-900 hover:bg-apricot-300 disabled:opacity-60"
          >
            {t("footer.send")}
          </button>
        </form>
      )}
      {state === "error" && <p className="mt-2 text-xs text-red-300">{t("common.error")}</p>}
    </div>
  );
}
