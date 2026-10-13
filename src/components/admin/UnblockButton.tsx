"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminAction, adminGhost } from "./adminApi";

// Opens an automatic block before its time.
export default function UnblockButton({ kind, blockKey, label }: { kind: string; blockKey: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    if (!confirm(`Բացե՞լ հիմա՝ ${label}։`)) return;
    setBusy(true);
    setError(null);
    const res = await adminAction({ action: "block.remove", kind, key: blockKey });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    router.refresh();
  }

  return (
    <>
      <button type="button" disabled={busy} className={`${adminGhost} !px-2 !py-1`} onClick={open}>
        {busy ? "..." : "Բացել հիմա"}
      </button>
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </>
  );
}
