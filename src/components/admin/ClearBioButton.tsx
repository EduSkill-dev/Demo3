"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminAction } from "./adminApi";

// Shown to admins on a public passport: removes a text that breaks the rules.
export default function ClearBioButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(`Հեռացնե՞լ ${name}-ի անձնագրի տեքստը։`)) return;
        setBusy(true);
        const res = await adminAction({ action: "account.clearBio", userId });
        setBusy(false);
        if (res.error) return window.alert(res.error);
        router.refresh();
      }}
      className="mt-3 self-start rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
    >
      {busy ? "..." : "Ադմին․ հեռացնել տեքստը"}
    </button>
  );
}
