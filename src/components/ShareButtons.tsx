"use client";

import { useT } from "@/i18n/client";
import CopyLinkButton from "@/components/ui/CopyLinkButton";

export const SHARE_NETWORKS = ["Facebook", "Instagram", "WhatsApp", "Viber", "Telegram"] as const;

const pill = "flex h-11 items-center justify-center rounded-full border-2 border-spruce-900 px-4 text-sm font-semibold text-ink dark:border-line";

// Sharing a hike: the link can be copied right away; the social networks are
// buttons only for now (how each one should post is still to be decided).
// `networks` is the club's plan flag (share_buttons).
export default function ShareButtons({ url, networks = true }: { url: string; networks?: boolean }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      <CopyLinkButton href={url} label={t("share.copyLink")} copiedLabel={t("calendar.copied")} className={`${pill} hover:bg-sand`} />
      {networks &&
        SHARE_NETWORKS.map((name) => (
          <button key={name} type="button" disabled aria-disabled="true" title={t("packagesPage.comingSoon")} className={`${pill} cursor-not-allowed opacity-50`}>
            {name}
          </button>
        ))}
    </div>
  );
}
