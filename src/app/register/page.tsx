"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import AuthCard from "@/components/auth/AuthCard";
import CheckEmail from "@/components/auth/CheckEmail";
import IndividualRegisterForm from "@/components/auth/IndividualRegisterForm";
import GoogleButton, { AuthDivider } from "@/components/auth/GoogleButton";

export default function RegisterPage() {
  const t = useT();
  // /register?as=individual skips the chooser (the header menu links there).
  const [step, setStep] = useState<"choose" | "individual">("choose");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("as") === "individual") setStep("individual");
  }, []);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) return <CheckEmail email={sentTo} />;

  if (step === "choose") {
    const card =
      "block w-full rounded-xl border border-line bg-surface p-5 text-left transition hover:border-spruce-500 hover:shadow-sm";
    return (
      <AuthCard title={t("auth.chooseTitle")}>
        <div className="space-y-3">
          <button type="button" onClick={() => setStep("individual")} className={card}>
            <span className="text-lg">🥾</span> <b className="text-ink">{t("auth.individual")}</b>
            <p className="mt-1 text-sm text-muted">{t("auth.individualHint")}</p>
          </button>
          <Link href="/register/club" className={card}>
            <span className="text-lg">🏕️</span> <b className="text-ink">{t("auth.club")}</b>
            <p className="mt-1 text-sm text-muted">{t("auth.clubHint")}</p>
          </Link>
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="font-semibold text-terracotta-500 hover:text-terracotta-700">{t("header.login")}</Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("auth.individualTitle")} wide>
      <div className="mx-auto max-w-sm">
        <GoogleButton next="/account" />
      </div>
      <AuthDivider />
      <IndividualRegisterForm onSent={setSentTo} />
    </AuthCard>
  );
}
