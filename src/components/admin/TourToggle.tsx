"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminAction, adminDanger, adminGhost } from "./adminApi";

// Take a listing off the site, or put it back.
export default function TourToggle({ tourId, hidden, title }: { tourId: string; hidden: boolean; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const question = hidden
      ? `Բացե՞լ «${title}» հայտարարությունը։ Այն նորից կերևա հարթակում։`
      : `Փակե՞լ «${title}» հայտարարությունը։ Այն չի երևա հարթակում, և նոր գրանցումներ չեն ընդունվի։`;
    if (!confirm(question)) return;
    setBusy(true);
    setError(null);
    const res = await adminAction({ action: "tour.setHidden", tourId, hidden: !hidden });
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="text-right">
      <button type="button" disabled={busy} onClick={toggle} className={hidden ? adminGhost : adminDanger}>
        {hidden ? "Բացել" : "Փակել"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
