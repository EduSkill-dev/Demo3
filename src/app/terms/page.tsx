import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import LegalPage from "@/components/layout/LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getT())("legal.termsTitle")} | Highland` };
}

// Placeholder until the final text is ready.
export default async function TermsPage() {
  const t = await getT();
  return (
    <LegalPage title={t("legal.termsTitle")}>
      <p className="text-muted">{t("legal.placeholder")}</p>
    </LegalPage>
  );
}
