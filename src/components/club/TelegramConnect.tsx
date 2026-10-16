"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useT } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "culmen_support_bot";

// Connecting someone to the club's roll call: open the bot on this device, scan
// the QR with a phone, or copy the link and send it to whoever leads the hike.
// The link carries the club's secret code; "New link" makes the old one stop
// working.
export default function TelegramConnect({ allowNew = false }: { allowNew?: boolean }) {
  const t = useT();
  const [code, setCode] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = code ? `https://t.me/${BOT}?start=c_${code}` : "";

  async function load(fresh = false) {
    setError(null);
    const { data, error: err } = await createClient().rpc("club_tg_code", { p_new: fresh });
    if (err) return setError(err.message);
    setCode(data as string);
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!link) return;
    QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: "#12332D", light: "#FFFDF8" } }).then(setQr).catch(() => setQr(null));
  }, [link]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("rollcall.copy"), link);
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!code) return <p className="text-sm text-muted">{t("common.loading")}</p>;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {qr && <img src={qr} alt={t("rollcall.qrAlt")} className="h-36 w-36 shrink-0 self-center rounded-xl border border-line bg-[#FFFDF8] p-1" />}
      <div className="min-w-0 flex-1 space-y-2.5">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#229ED9] px-5 text-sm font-semibold text-white hover:opacity-90"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="M21.9 4.3 18.7 19.4c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.1 13 1.3 11.5c-1-.3-1.1-1 .2-1.5L20.5 2.7c.9-.3 1.7.2 1.4 1.6z" />
          </svg>
          {t("rollcall.openBot")}
        </a>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface pl-3">
          <span className="min-w-0 flex-1 truncate text-xs text-muted" title={link}>{link}</span>
          <button type="button" onClick={copy} aria-label={t("rollcall.copy")} title={t("rollcall.copy")} className="flex h-9 shrink-0 items-center gap-1.5 rounded-r-lg border-l border-line px-3 text-xs font-semibold text-ink hover:bg-sand">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="7" y="7" width="10" height="10" rx="2" />
              <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
            </svg>
            {copied ? t("calendar.copied") : t("rollcall.copy")}
          </button>
        </div>
        <p className="text-xs text-muted">{t("rollcall.connectHint")}</p>
        {allowNew && (
          <button type="button" onClick={() => window.confirm(t("rollcall.newLinkConfirm")) && load(true)} className="text-xs font-semibold text-terracotta-700 hover:text-terracotta-500 dark:text-terracotta-300">
            {t("rollcall.newLink")}
          </button>
        )}
      </div>
    </div>
  );
}
