"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/client";
import { authErrorMessage, confirmUrl } from "@/lib/authErrors";
import AuthCard from "./AuthCard";

// "We sent you a link" — shown right after signing up, with a resend button.
export default function CheckEmail({ email }: { email: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setState("busy");
    setError(null);
    const { error: err } = await createClient().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: confirmUrl() },
    });
    if (err) {
      setState("idle");
      return setError(authErrorMessage(t, err));
    }
    setState("sent");
  }

  return (
    <AuthCard title={t("auth.checkEmailTitle")}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-3xl">✉️</span>
        <div className="space-y-2 text-sm text-ink">
          <p>{t("auth.checkEmailText", { email })}</p>
          <p className="text-muted">{t("auth.checkSpam")}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={resend}
        disabled={state !== "idle"}
        className="mt-6 text-sm font-semibold text-terracotta-500 hover:text-terracotta-700 disabled:opacity-60"
      >
        {state === "sent" ? t("auth.resent") : t("auth.resend")}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </AuthCard>
  );
}
