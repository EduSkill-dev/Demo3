"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import CopyLinkButton from "@/components/ui/CopyLinkButton";
import { SHARE_NETWORKS, shareHref, type ShareNetwork } from "@/lib/share";

const pill = "flex h-11 items-center justify-center rounded-full border-2 border-spruce-900 px-4 text-sm font-semibold text-ink hover:bg-sand dark:border-line";

// Sharing a hike: copy its link, or send it to one of the social networks
// the admins switched on (`networks`; none = only the copy button). A
// network an admin closed for this club (`blocked`) keeps its button, but
// the button is inactive.
export default function ShareButtons({
  url,
  text = "",
  networks,
  blocked = [],
}: {
  url: string;
  text?: string;
  networks: ShareNetwork[];
  blocked?: string[];
}) {
  const t = useT();
  const [note, setNote] = useState<string | null>(null);

  async function share(network: ShareNetwork) {
    const full = url.startsWith("/") ? window.location.origin + url : url;
    setNote(null);
    if (network === "instagram") {
      // No share address: the link goes to the clipboard, Instagram opens.
      try {
        await navigator.clipboard.writeText(full);
        setNote(t("share.instagramCopied"));
      } catch {
        window.prompt(t("share.copyLink"), full);
      }
    }
    const target = shareHref(network, full, text);
    if (target.startsWith("http")) window.open(target, "_blank", "noopener,noreferrer");
    else window.location.href = target; // an app link (Viber)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <CopyLinkButton href={url} label={t("share.copyLink")} copiedLabel={t("calendar.copied")} className={pill} />
        {SHARE_NETWORKS.filter((n) => networks.includes(n.id)).map((n) =>
          blocked.includes(n.id) ? (
            <button key={n.id} type="button" disabled aria-disabled="true" title={t("share.closedForClub")} className={`${pill} cursor-not-allowed opacity-45 hover:bg-transparent`}>
              {n.name}
            </button>
          ) : (
            <button key={n.id} data-view type="button" onClick={() => share(n.id)} className={pill}>
              {n.name}
            </button>
          )
        )}
      </div>
      {note && <p className="mt-2 text-xs text-muted" aria-live="polite">{note}</p>}
      {networks.some((id) => blocked.includes(id)) && <p className="mt-2 text-xs text-muted">{t("share.closedForClub")}</p>}
    </div>
  );
}
