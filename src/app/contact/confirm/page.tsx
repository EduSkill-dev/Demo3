import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { contactInboxEmail, ownerInbox, sendEmail } from "@/lib/email";
import { getT } from "@/i18n/server";
import AuthCard from "@/components/auth/AuthCard";

// /contact/confirm?token=… — the link in the "confirm your message" email.
// Confirming is what delivers a visitor's suggestion to the owner.
export default async function ContactConfirmPage({ searchParams }: { searchParams: { token?: string } }) {
  const t = await getT();
  const token = searchParams.token ?? "";

  let ok = false;
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("contact_messages")
      .select("id, message, email, phone, confirmed_at")
      .eq("token", token)
      .maybeSingle();
    const row = data as { id: string; message: string; email: string | null; phone: string | null; confirmed_at: string | null } | null;
    ok = !!row;

    // Forwarded once — only the update that actually confirms it sends.
    if (row && !row.confirmed_at) {
      const { data: updated } = await admin
        .from("contact_messages")
        .update({ confirmed_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("confirmed_at", null)
        .select("id");
      const inbox = ownerInbox();
      if ((updated ?? []).length > 0 && inbox) {
        await sendEmail(contactInboxEmail({ to: inbox, message: row.message, email: row.email, phone: row.phone }));
      }
    }
  }

  return (
    <AuthCard title={ok ? t("contact.confirmedTitle") : t("newsletter.invalidTitle")}>
      <p
        className={`rounded-lg p-4 text-sm ${
          ok
            ? "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300"
            : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        }`}
      >
        {ok ? t("contact.confirmedText") : t("newsletter.invalidText")}
      </p>
      <Link href="/tours" className="mt-6 inline-block text-sm font-semibold text-apricot hover:text-apricot-dark">
        {t("header.tours")} →
      </Link>
    </AuthCard>
  );
}
