"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";

// A button on the home page that needs an individual's account. Signed-in
// individuals go straight on; a visitor is told, right under the button,
// that it takes a (free) account, with the ways to get one.
export default function SignUpFirstButton({
  href,
  signedIn,
  label,
  className,
}: {
  href: string;
  signedIn: boolean;
  label: string;
  className: string;
}) {
  const t = useT();
  const [asked, setAsked] = useState(false);
  if (signedIn) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <div>
      <button type="button" onClick={() => setAsked(true)} aria-expanded={asked} className={className}>
        {label}
      </button>
      {asked && (
        <div className="mt-3 rounded-2xl border border-apricot-300 bg-apricot-100 p-3 text-sm text-spruce-900" role="status">
          <p className="font-semibold">{t("home.needAccount")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/register?as=individual&next=${encodeURIComponent(href)}`} className="rounded-lg bg-spruce-500 px-4 py-1.5 font-semibold text-white hover:bg-spruce-900">
              {t("header.register")}
            </Link>
            <Link href={`/login?next=${encodeURIComponent(href)}`} className="rounded-full border-2 border-spruce-900 px-4 py-1 font-semibold text-spruce-900 hover:bg-spruce-900 hover:text-white">
              {t("header.login")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
