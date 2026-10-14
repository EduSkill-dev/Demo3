import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import LegalPage from "@/components/layout/LegalPage";
import LegalSections from "@/components/layout/LegalSections";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getT())("legal.privacyTitle")}` };
}

// The text lives in the dictionary (legal.privacyNTitle / legal.privacyNText)
// and is edited in Admin → Site pages.
export default async function PrivacyPage() {
  const t = await getT();
  return (
    <LegalPage title={t("legal.privacyTitle")}>
      <LegalSections t={t} prefix="privacy" count={10} />
    </LegalPage>
  );
}
