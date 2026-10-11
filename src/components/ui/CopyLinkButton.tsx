"use client";

import { useState } from "react";

// Copies a link (a site path becomes a full address) and says so for two
// seconds. Where the clipboard is not available, the address is shown in a
// prompt to copy by hand.
export default function CopyLinkButton({
  href,
  label,
  copiedLabel,
  className,
}: {
  href: string; // "/tours/…" or a full URL
  label: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = href.startsWith("/") ? window.location.origin + href : href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(label, url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button data-view type="button" onClick={copy} className={className} aria-live="polite">
      {copied ? copiedLabel : label}
    </button>
  );
}
