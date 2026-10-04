"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PACKAGES,
  PACKAGE_IDS,
  RENEW_WINDOW_DAYS,
  activePackage,
  addOneMonth,
  formatAmd,
  type PackageId,
} from "@/lib/catalog";
import { serverErrorMessage } from "@/lib/serverErrors";
import { useFormatDate, useT } from "@/i18n/client";
import PaymentSheet, { type ChargeResponse } from "@/components/PaymentSheet";
import Modal from "@/components/ui/Modal";
import ReceiptView, { type ReceiptPayment } from "@/components/ReceiptView";
import ReceiptDownload from "@/components/ui/ReceiptDownload";

type ClubRow = { id: string; name: string; tariff: PackageId | null; package_ends_at: string | null };
type PaymentRow = ReceiptPayment & { tariff: PackageId | null };

export default function PackagesPage() {
  const t = useT();
  const fmt = useFormatDate();
  const [club, setClub] = useState<ClubRow | null>(null);
  const [email, setEmail] = useState("");
  const [history, setHistory] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState<PackageId | null>(null);
  const [receipt, setReceipt] = useState<PaymentRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const day = (iso: string | Date) => fmt(iso, "long");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setLoading(false);
    setEmail(auth.user.email ?? "");
    const { data: clubRow } = await supabase
      .from("clubs")
      .select("id, name, tariff, package_ends_at")
      .eq("owner_id", auth.user.id)
      .single();
    if (!clubRow) return setLoading(false);
    setClub(clubRow as ClubRow);
    const { data: payments } = await supabase
      .from("payments")
      .select("id, created_at, amount, currency, card_last4, period_start, period_end, tariff")
      .eq("club_id", (clubRow as ClubRow).id)
      .eq("kind", "subscription")
      .eq("status", "succeeded")
      .order("created_at", { ascending: false });
    setHistory((payments ?? []) as PaymentRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-muted">{t("common.loading")}</p>;
  if (!club) return null;

  const active = activePackage(club);
  const endsAt = club.package_ends_at ? new Date(club.package_ends_at) : null;
  const daysLeft = active && endsAt ? (endsAt.getTime() - Date.now()) / 86400000 : null;
  const canExtend = daysLeft != null && daysLeft <= RENEW_WINDOW_DAYS;
  // "Recommended" sits on Advanced unless the club already has Advanced or PRO.
  const recommendAdvanced = active === null || active === "start";

  async function buy(id: PackageId) {
    setMessage(null);
    setError(null);
    if (PACKAGES[id].priceAmd > 0) return setPaying(id);

    setBusy(true);
    const res = await fetch("/api/payments/charge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "subscription", tariff: id }),
    });
    const data = (await res.json().catch(() => ({}))) as ChargeResponse;
    setBusy(false);
    if (!res.ok || data.status !== "succeeded") return setError(serverErrorMessage(t, data.error));
    done(id, data.package_ends_at);
  }

  function done(id: PackageId, until?: string) {
    setPaying(null);
    if (until) setMessage(t("packagesPage.activated", { name: PACKAGES[id].name, date: day(until) }));
    load();
  }

  return (
    <div className="space-y-8">
      {/* Status line */}
      <div className="rounded-xl border border-line bg-surface p-4 text-sm">
        {active && endsAt ? (
          <p className="text-ink">
            <b>{t("packagesPage.current", { name: PACKAGES[active].name })}</b>,{" "}
            <span className="text-muted">{t("packagesPage.until", { date: day(endsAt) })}</span>
          </p>
        ) : (
          <>
            {club.tariff && endsAt && (
              <p className="mb-1 font-semibold text-red-600">
                {t("packagesPage.lapsed", { name: PACKAGES[club.tariff].name, date: day(endsAt) })}
              </p>
            )}
            <p className="text-ink">{t("packagesPage.none")}</p>
          </>
        )}
      </div>

      {/* Package cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {PACKAGE_IDS.map((id) => {
          const p = PACKAGES[id];
          const isActive = active === id;
          const recommended = id === "advanced" && recommendAdvanced;
          const lower = active !== null && p.rank < PACKAGES[active].rank;
          const lines = [
            t("package.listings", { count: p.maxListings }),
            t("package.perTour", { count: p.maxPerTour }),
            p.showsRatings ? t("package.ratingsVisible") : t("package.ratingsHidden"),
            ...(p.monthlyReport ? [`${t("package.monthlyReport")} (${t("package.soon")})`] : []),
            ...(p.analytics ? [`${t("package.analytics")} (${t("package.soon")})`] : []),
          ];

          return (
            <div
              key={id}
              className="relative flex flex-col rounded-2xl border border-line bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif text-xl font-semibold text-heading">{p.name}</h3>
                {isActive ? (
                  <span className="rounded-full bg-green-600 px-2.5 py-1 text-xs font-semibold text-white">
                    {t("packagesPage.active")}
                  </span>
                ) : recommended ? (
                  <span className="rounded-full bg-apricot px-2.5 py-1 text-xs font-semibold text-white">
                    {t("packagesPage.recommended")}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-lg font-semibold text-ink">
                {p.priceAmd > 0 ? t("package.perMonth", { price: formatAmd(p.priceAmd) }) : t("common.free")}
              </p>
              <ul className="mt-3 flex-1 list-disc space-y-1 pl-5 text-sm text-muted">
                {lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>

              {isActive ? (
                canExtend && endsAt ? (
                  <div className="mt-5">
                    <button
                      onClick={() => buy(id)}
                      disabled={busy}
                      className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {t("packagesPage.extend")}
                    </button>
                    <p className="mt-1.5 text-xs text-muted">
                      {t("packagesPage.extendHint", { date: day(addOneMonth(endsAt)) })}
                    </p>
                  </div>
                ) : null
              ) : (
                <div className="mt-5">
                  <button
                    onClick={() => buy(id)}
                    disabled={busy || lower}
                    title={lower ? t("packagesPage.afterExpiry") : undefined}
                    className="w-full rounded-lg border border-line py-2.5 text-sm font-semibold text-ink transition hover:border-apricot hover:text-apricot-dark disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("packagesPage.choose", { name: p.name })}
                  </button>
                  {lower && <p className="mt-1.5 text-xs text-muted">{t("packagesPage.afterExpiry")}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {message && <p className="text-sm font-medium text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* History */}
      <div>
        <h2 className="font-serif text-lg font-semibold text-heading">{t("packagesPage.history")}</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("packagesPage.historyEmpty")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase text-muted">
                  <th className="px-4 py-2.5">{t("packagesPage.colStart")}</th>
                  <th className="px-4 py-2.5">{t("packagesPage.colEnd")}</th>
                  <th className="px-4 py-2.5">{t("packagesPage.colPackage")}</th>
                  <th className="px-4 py-2.5">{t("packagesPage.colAmount")}</th>
                  <th className="px-4 py-2.5 text-right">{t("packagesPage.colReceipt")}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  // The row whose period is running now, for the package in force.
                  const live =
                    !!active && h.tariff === active && !!h.period_start && !!h.period_end &&
                    new Date(h.period_start).getTime() <= Date.now() && Date.now() < new Date(h.period_end).getTime();
                  return (
                  <tr key={h.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5">{day(h.period_start ?? h.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">{h.period_end ? day(h.period_end) : "—"}</td>
                    <td className="px-4 py-2.5">
                      {h.tariff ? PACKAGES[h.tariff].name : "—"}
                      {live && (
                        <span className="ml-2 rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                          {t("packagesPage.active")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {Number(h.amount) > 0 ? formatAmd(h.amount) : t("common.free")}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => setReceipt(h)}
                        className="font-semibold text-apricot hover:text-apricot-dark"
                      >
                        {t("packagesPage.viewReceipt")}
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted">{t("packagesPage.testNote")}</p>

      <Modal
        open={!!paying}
        onClose={() => setPaying(null)}
        title={paying ? t("packagesPage.payTitle", { name: PACKAGES[paying].name }) : ""}
      >
        {paying && (
          <PaymentSheet
            kind="subscription"
            tariff={paying}
            amount={PACKAGES[paying].priceAmd}
            label={t("packagesPage.payTitle", { name: PACKAGES[paying].name })}
            onCancel={() => setPaying(null)}
            onSuccess={(data) => done(paying, data.package_ends_at)}
          />
        )}
      </Modal>

      <Modal
        open={!!receipt}
        onClose={() => setReceipt(null)}
        title={t("receipt.title")}
        actions={receipt ? <ReceiptDownload paymentId={receipt.id} /> : null}
      >
        {receipt && (
          <ReceiptView
            payment={receipt}
            item={receipt.tariff ? `${PACKAGES[receipt.tariff].name}` : "—"}
            payer={`${club.name} · ${email}`}
          />
        )}
      </Modal>
    </div>
  );
}
