import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PACKAGES, isPackageId } from "@/lib/catalog";
import { getT } from "@/i18n/server";
import ReceiptView, { type ReceiptPayment } from "@/components/ReceiptView";
import AutoPrint from "@/components/ui/AutoPrint";

// A printable receipt. "Download" opens it with ?print=1, which brings up the
// browser's print dialog where it can be saved as a PDF.
export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { print?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/receipts/${params.id}`);

  // RLS: people read only their own payments.
  const { data } = await supabase
    .from("payments")
    .select("id, created_at, amount, currency, card_last4, period_start, period_end, kind, tariff, status, tours(title), clubs(name)")
    .eq("id", params.id)
    .eq("status", "succeeded")
    .maybeSingle();
  if (!data) notFound();

  type Row = ReceiptPayment & {
    kind: "booking" | "subscription";
    tariff: string | null;
    tours: { title: string } | null;
    clubs: { name: string } | null;
  };
  const p = data as unknown as Row;
  const { data: profile } = await supabase.from("profiles").select("first_name, last_name, email").eq("id", user.id).single();
  const prof = profile as { first_name: string | null; last_name: string | null; email: string } | null;

  const t = await getT();
  const item =
    p.kind === "subscription"
      ? `${isPackageId(p.tariff) ? PACKAGES[p.tariff].name : "—"}${p.clubs ? ` · ${p.clubs.name}` : ""}`
      : p.tours?.title ?? "—";
  const payer =
    p.kind === "subscription" && p.clubs
      ? `${p.clubs.name} · ${prof?.email ?? ""}`
      : [[prof?.first_name, prof?.last_name].filter(Boolean).join(" "), prof?.email].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto max-w-lg px-4 py-10 print:max-w-none print:p-0">
      <h1 className="mb-4 font-serif text-2xl font-semibold text-heading">{t("receipt.title")}</h1>
      <div className="rounded-2xl border border-line bg-surface p-6 print:border-0 print:p-0">
        <ReceiptView payment={p} item={item} payer={payer} />
      </div>
      {searchParams.print === "1" && <AutoPrint />}
    </main>
  );
}
