import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { newSubscriberEmail, ownerInbox, sendEmail } from "@/lib/email";
import { getT } from "@/i18n/server";
import AuthCard from "@/components/auth/AuthCard";

// /newsletter/confirm?token=… and /newsletter/unsubscribe?token=… — the two
// links in newsletter emails.
export default async function NewsletterActionPage({
  params,
  searchParams,
}: {
  params: { action: string };
  searchParams: { token?: string };
}) {
  if (params.action !== "confirm" && params.action !== "unsubscribe") notFound();
  const t = await getT();
  const token = searchParams.token ?? "";
  const valid = /^[0-9a-f-]{36}$/i.test(token);

  let ok = false;
  if (valid) {
    const patch =
      params.action === "confirm"
        ? { confirmed_at: new Date().toISOString(), unsubscribed_at: null }
        : { unsubscribed_at: new Date().toISOString() };
    const admin = createAdminClient();
    const { data: before } = await admin
      .from("newsletter_subscribers")
      .select("email, confirmed_at, unsubscribed_at")
      .eq("token", token)
      .maybeSingle();
    const { data } = await admin.from("newsletter_subscribers").update(patch).eq("token", token).select("id");
    ok = (data ?? []).length > 0;

    // The owner hears about a subscription once — not on every reload of the link.
    const was = before as { email: string; confirmed_at: string | null; unsubscribed_at: string | null } | null;
    if (ok && params.action === "confirm" && was && (!was.confirmed_at || was.unsubscribed_at)) {
      await sendEmail(newSubscriberEmail({ to: ownerInbox(), email: was.email }));
    }
  }

  const [title, text] = !ok
    ? [t("newsletter.invalidTitle"), t("newsletter.invalidText")]
    : params.action === "confirm"
      ? [t("newsletter.confirmedTitle"), t("newsletter.confirmedText")]
      : [t("newsletter.unsubscribedTitle"), t("newsletter.unsubscribedText")];

  return (
    <AuthCard title={title}>
      <p
        className={`rounded-lg p-4 text-sm ${
          ok
            ? "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300"
            : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        }`}
      >
        {text}
      </p>
      <Link href="/tours" className="mt-6 inline-block text-sm font-semibold text-terracotta-500 hover:text-terracotta-700">
        {t("header.tours")} →
      </Link>
    </AuthCard>
  );
}
