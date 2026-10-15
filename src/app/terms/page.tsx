import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import LegalPage from "@/components/layout/LegalPage";
import LegalSections from "@/components/layout/LegalSections";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getT())("legal.termsTitle")}` };
}

// The text lives in the dictionary (legal.termsNTitle / legal.termsNText)
// and is edited in Admin → Site pages.
export default async function TermsPage() {
  const t = await getT();
  return (
    <LegalPage title={t("legal.termsTitle")}>
      <LegalSections t={t} prefix="terms" count={11} />
    </LegalPage>
  );
}
