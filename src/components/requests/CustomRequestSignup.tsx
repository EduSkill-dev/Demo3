"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import CheckEmail from "@/components/auth/CheckEmail";
import IndividualRegisterForm from "@/components/auth/IndividualRegisterForm";

// What a visitor sees after pressing "Order a custom hike": the reason an
// account is needed, with the sign-up fields right below it.
export default function CustomRequestSignup() {
  const t = useT();
  const [sentTo, setSentTo] = useState<string | null>(null);
  if (sentTo) return <CheckEmail email={sentTo} confirmPath="/auth/confirm-request" />;

  const steps = [t("custom.step1"), t("custom.step2"), t("custom.step3")];
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-center font-serif text-3xl font-semibold text-heading">{t("custom.title")}</h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted">{t("custom.text")}</p>

      <div className="mt-8 rounded-2xl border border-terracotta-500/40 bg-terracotta-500/10 p-5 text-ink">
        <p className="font-semibold">{t("custom.needAccountTitle")}</p>
        <p className="mt-1 text-sm">{t("custom.needAccountText")}</p>
        <ol className="mt-3 space-y-1 text-sm">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-spruce-500 text-xs font-bold text-card">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <h2 className="mb-5 font-serif text-xl font-semibold text-heading">{t("auth.individualTitle")}</h2>
        <IndividualRegisterForm then="request" loginHref="/login?next=/account/requests/new" onSent={setSentTo} />
      </div>
    </main>
  );
}
