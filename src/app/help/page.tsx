import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/i18n/server";
import LegalPage from "@/components/layout/LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getT())("legal.helpTitle")} | Highland` };
}

export default async function HelpPage() {
  const t = await getT();
  return (
    <LegalPage title={t("legal.helpTitle")}>
      <p>{t("legal.helpText")}</p>
      <p>
        <Link href="/faq" className="font-semibold text-apricot hover:text-apricot-dark">
          {t("header.faq")} →
        </Link>
      </p>
      <p className="text-muted">{t("legal.placeholder")}</p>
    </LegalPage>
  );
}
