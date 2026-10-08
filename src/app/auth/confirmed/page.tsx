import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/i18n/server";
import AuthCard from "@/components/auth/AuthCard";

// Where /auth/confirm lands: green on success, red when the link failed.
export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const t = await getT();
  const status = searchParams.status;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: string | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = (data as { role?: string } | null)?.role ?? null;
  }

  if (status === "other_browser") {
    return (
      <AuthCard title={t("auth.otherBrowserTitle")}>
        <p className="rounded-lg bg-sand/60 p-4 text-sm text-ink">{t("auth.otherBrowserText")}</p>
        <Link href="/login" className="mt-6 inline-block rounded-full bg-spruce-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-spruce-900">
          {t("header.login")}
        </Link>
      </AuthCard>
    );
  }

  if (status === "invalid") {
    return (
      <AuthCard title={t("auth.linkInvalidTitle")}>
        <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {t("auth.linkInvalidText")}
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/login" className="text-terracotta-500 hover:text-terracotta-700">{t("header.login")}</Link>
          <Link href="/auth/forgot" className="text-terracotta-500 hover:text-terracotta-700">{t("auth.forgot")}</Link>
        </div>
      </AuthCard>
    );
  }

  const [title, text] =
    status === "email"
      ? [t("auth.emailChangedTitle"), t("auth.emailChangedText")]
      : status === "email_pending"
        ? [t("auth.emailPendingTitle"), t("auth.emailPendingText")]
        : [t("auth.confirmedTitle"), t("auth.confirmedText")];

  const next =
    role === "club"
      ? { href: "/dashboard", label: t("auth.goDashboard") }
      : role === "individual"
        ? { href: "/account", label: t("auth.goAccount") }
        : { href: "/login", label: t("header.login") };

  return (
    <AuthCard title={title}>
      <div className="flex items-start gap-3 rounded-xl border border-green-600/30 bg-green-50 p-4 text-green-800 dark:bg-green-950/40 dark:text-green-300">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <p className="text-sm font-medium">{text}</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={next.href} className="rounded-full bg-spruce-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-spruce-900">
          {next.label}
        </Link>
        <Link href="/" className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:border-spruce-500">
          {t("auth.goHome")}
        </Link>
      </div>
    </AuthCard>
  );
}
