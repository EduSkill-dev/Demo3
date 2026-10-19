"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import SocialIcon, { SOCIAL_COLOR } from "@/components/club/SocialIcon";
import { shareHref } from "@/lib/share";
import { drawShareCard, shareOrDownload, type CardTour } from "@/lib/shareCard";

type Net = "facebook" | "instagram";

// Facebook and Instagram buttons on a hike's page (before "Add to my
// calendar"). The link carries ?ref=<network>, so the club's report counts
// who came from where. Facebook opens its share window (the preview comes
// from the page's Open Graph data). Instagram takes pictures, not links: the
// button draws the hike's post picture — phones share it through the system
// sheet, computers download it — and copies the link for the caption.
export default function TourShareRow({ path, text, nets, card }: { path: string; text: string; nets: Net[]; card: Omit<CardTour, "url"> }) {
  const t = useT();
  const [note, setNote] = useState<string | null>(null);
  if (nets.length === 0) return null;

  async function share(net: Net) {
    const url = `${window.location.origin}${path}?ref=${net}`;
    setNote(null);
    if (net === "facebook") {
      window.open(shareHref("facebook", url, text), "_blank", "noopener,noreferrer");
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
    } catch {
      /* no clipboard: the picture still carries the address */
    }
    const blob = await drawShareCard({ ...card, url: `${window.location.origin}${path}` }, "post");
    if (!blob) return setNote(t("share.cardFailed"));
    const how = await shareOrDownload(blob, "culmen-instagram.jpg", `${text}\n${url}`);
    if (how === "downloaded") setNote(t("share.instagramPicture"));
  }

  return (
    <>
      {nets.map((net) => (
        <button
          key={net}
          type="button"
          onClick={() => share(net)}
          aria-label={t("share.on", { network: net === "facebook" ? "Facebook" : "Instagram" })}
          title={t("share.on", { network: net === "facebook" ? "Facebook" : "Instagram" })}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:opacity-90"
          style={{ background: SOCIAL_COLOR[net] }}
        >
          <SocialIcon net={net} className="h-5 w-5" />
        </button>
      ))}
      {note && <p className="basis-full text-center text-xs text-muted" aria-live="polite">{note}</p>}
    </>
  );
}
