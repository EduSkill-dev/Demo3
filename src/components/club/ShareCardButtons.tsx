"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { drawShareCard, shareOrDownload, type CardFormat, type CardTour } from "@/lib/shareCard";

// "A picture for Instagram": a post (4:5) or a story (9:16) of the hike,
// made in the browser; phones open the share sheet, computers download it.
export default function ShareCardButtons({ card, text }: { card: CardTour; text: string }) {
  const t = useT();
  const [busy, setBusy] = useState<CardFormat | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function make(format: CardFormat) {
    setBusy(format);
    setNote(null);
    const blob = await drawShareCard(card, format);
    setBusy(null);
    if (!blob) return setNote(t("share.cardFailed"));
    const how = await shareOrDownload(blob, `culmen-${format}.jpg`, text);
    if (how === "downloaded") setNote(t("share.cardDownloaded"));
  }

  const pill = "flex h-11 items-center justify-center gap-2 rounded-full border-2 border-[#D62976] px-4 text-sm font-semibold text-ink hover:bg-[#D62976]/10 disabled:opacity-50";
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(["post", "story"] as const).map((f) => (
          <button key={f} type="button" disabled={!!busy} onClick={() => make(f)} className={pill}>
            <span aria-hidden="true">{f === "post" ? "🖼️" : "📱"}</span>
            {busy === f ? "…" : f === "post" ? t("share.cardPost") : t("share.cardStory")}
          </button>
        ))}
      </div>
      {note && <p className="mt-2 text-xs text-muted" aria-live="polite">{note}</p>}
    </div>
  );
}
