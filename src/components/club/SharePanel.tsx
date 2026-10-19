"use client";

import { useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { dateWords, dayAndMonth, dayInWords } from "@/lib/calendar";
import Modal from "@/components/ui/Modal";
import ShareButtons from "@/components/ShareButtons";
import ShareCardButtons from "@/components/club/ShareCardButtons";
import type { Difficulty } from "@/types/database";
import type { ShareNetwork } from "@/lib/share";

export type ShareTour = {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  regions: string[];
  difficulty: Difficulty;
  overnight: boolean;
  left: number; // free seats
  photo: string | null;
};

// "Share" for one active listing: a ready announcement text the club can
// edit and copy, the hike's link, and a button for each social network the
// admins switched on.
export default function SharePanel({
  tour,
  clubName,
  networks,
  blocked,
  onClose,
}: {
  tour: ShareTour;
  clubName: string;
  networks: ShareNetwork[]; // the social networks the platform has switched on
  blocked: string[]; // of those, the ones closed for this club: shown, but inactive
  onClose: () => void;
}) {
  const t = useT();
  const words = dateWords(t);
  const url = `${typeof window === "undefined" ? "" : window.location.origin}/tours/${tour.id}?ref=link`;
  const many = tour.endDate && tour.endDate > tour.date;
  const [text, setText] = useState(() =>
    [
      `🥾 ${tour.title}`,
      `📅 ${dayInWords(tour.date, words)}${many ? ` – ${dayAndMonth(tour.endDate!, words)}` : ""}`,
      `📍 ${tour.regions.map((r) => t(`region.${r}`)).join(", ")}`,
      `⛰ ${t("toursPage.difficulty")}՝ ${t(`difficulty.${tour.difficulty}`)}${tour.overnight ? ` · ${t("calendar.night")}` : ""}`,
      `👥 ${tour.left > 0 ? t("calendar.spotsLeft", { count: tour.left }) : t("calendar.full")}`,
      `🏔 ${t("share.organiser")}՝ ${clubName}`,
      "",
      `${t("share.signUp")}՝ ${url}`,
    ].join("\n")
  );
  const [copied, setCopied] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard access: select the text so it can be copied by hand.
      area.current?.focus();
      area.current?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal open onClose={onClose} title={t("share.title")}>
      <div className="space-y-5">
        <section>
          <h3 className="text-sm font-semibold text-ink">{t("share.text")}</h3>
          <p className="mt-0.5 text-xs text-muted">{t("share.textHint")}</p>
          <textarea
            ref={area}
            data-view
            rows={9}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/30"
          />
          <button data-view type="button" onClick={copy} className="mt-2 rounded-full bg-spruce-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-spruce-900">
            {copied ? t("calendar.copied") : t("share.copyText")}
          </button>
        </section>
        <section className="border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">{t("share.picture")}</h3>
          <p className="mt-0.5 text-xs text-muted">{t("share.pictureHint")}</p>
          <div className="mt-3">
            <ShareCardButtons
              text={text}
              card={{
                title: tour.title,
                when: `${dayInWords(tour.date, words)}${many ? ` – ${dayAndMonth(tour.endDate!, words)}` : ""}`,
                place: tour.regions.map((r) => t(`region.${r}`)).join(", "),
                club: clubName,
                photo: tour.photo,
                url: url.replace(/\?ref=link$/, ""),
                organiserLabel: t("tour.organiser"),
                signUpLabel: t("share.signUp"),
              }}
            />
          </div>
        </section>
        <section className="border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">{t("share.link")}</h3>
          <p className="mt-0.5 break-all text-xs text-muted">{url}</p>
          <div className="mt-3">
            <ShareButtons url={`/tours/${tour.id}`} text={`${tour.title} · ${clubName}`} networks={networks} blocked={blocked} />
          </div>
        </section>
      </div>
    </Modal>
  );
}
