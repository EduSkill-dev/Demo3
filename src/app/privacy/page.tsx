import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import LegalPage from "@/components/layout/LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getT())("legal.privacyTitle")}` };
}

// Placeholder until the final text is ready.
export default async function PrivacyPage() {
  const t = await getT();
  return (
    <LegalPage title={t("legal.privacyTitle")}>
      <p className="text-muted">{t("legal.placeholder")}</p>
    </LegalPage>
  );
}
