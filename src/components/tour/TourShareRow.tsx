"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import SocialIcon, { SOCIAL_COLOR } from "@/components/club/SocialIcon";
import { shareHref } from "@/lib/share";

type Net = "facebook" | "instagram";

// Facebook and Instagram buttons on a hike's page (before "My calendar").
// The link carries ?ref=<network>, so the club's report counts who came
// from where. Facebook opens its share window; Instagram has none on the
// web: phones get the system share sheet (Instagram is in it), computers
// get the link copied and Instagram opened.
export default function TourShareRow({ path, text, nets }: { path: string; text: string; nets: Net[] }) {
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
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && navigator.share) {
      try {
        await navigator.share({ title: text, url });
        return;
      } catch {
        /* closed, or not allowed: fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setNote(t("share.instagramCopied"));
    } catch {
      window.prompt(t("share.copyLink"), url);
    }
    window.open(shareHref("instagram", url, text), "_blank", "noopener,noreferrer");
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
