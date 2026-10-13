"use client";

import { useEffect } from "react";
import { useT } from "@/i18n/client";
import { reportClientError } from "@/components/ErrorReporter";

// Shown instead of a page that failed to load. The fault is reported to the
// admins; the visitor can try again or go home.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    reportClientError(error, error.digest);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="font-serif text-2xl font-semibold text-heading">{t("errors.pageTitle")}</h1>
      <p className="mt-3 text-muted">{t("errors.pageText")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button data-view type="button" onClick={reset} className="rounded-full bg-spruce-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-spruce-900">
          {t("errors.tryAgain")}
        </button>
        <a href="/" className="rounded-full border-2 border-spruce-900 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-sand dark:border-line">
          {t("errors.goHome")}
        </a>
      </div>
    </main>
  );
}
