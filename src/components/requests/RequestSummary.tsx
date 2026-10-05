"use client";

import { formatAmd } from "@/lib/catalog";
import { useFormatDate, useT } from "@/i18n/client";
import type { RequestStatus, RequestView } from "@/lib/requests";

const STATUS_STYLE: Record<RequestStatus, string> = {
  open: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
  accepted: "bg-apricot/15 text-apricot-dark dark:text-apricot",
  closed: "bg-sand text-muted",
};

// One request, laid out the same way everywhere: the headline facts, the
// places as chips, then the author's own words.
export default function RequestSummary({ request, showAuthor = false }: { request: RequestView; showAuthor?: boolean }) {
  const t = useT();
  const fmt = useFormatDate();
  const dates =
    request.dateFrom === request.dateTo
      ? fmt(request.dateFrom, "long")
      : t("requests.dates", { from: fmt(request.dateFrom, "short"), to: fmt(request.dateTo, "short") });
  const status = { open: t("requests.statusOpen"), accepted: t("requests.statusAccepted"), closed: t("requests.statusClosed") }[request.status];

  const facts: [string, string][] = [
    [t("requests.people"), t("requests.peopleCount", { count: request.people })],
    [t("requests.when"), dates],
    [t("tour.overnight"), request.overnight ? t("tour.yes") : t("tour.no")],
    [t("requests.budget"), request.budget != null ? t("common.perPerson", { price: formatAmd(request.budget) }) : t("requests.budgetOpen")],
  ];
  const chips = [
    ...request.regions.map((r) => ({ key: `r-${r}`, text: t(`region.${r}`), tone: "text-apricot-dark dark:text-apricot bg-apricot/10" })),
    ...request.terrains.map((k) => ({ key: `t-${k}`, text: t(`terrain.${k}`), tone: "text-ink bg-sand" })),
    ...request.sights.map((s) => ({ key: `s-${s}`, text: `📍 ${s}`, tone: "text-ink bg-sand" })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          {showAuthor && request.authorName ? `${t("requests.from", { name: request.authorName })} · ` : ""}
          {t("requests.posted", { date: fmt(request.createdAt, "short") })}
        </span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLE[request.status]}`}>{status}</span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="text-sm font-semibold text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c.key} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.tone}`}>{c.text}</span>
          ))}
        </div>
      )}

      {request.note && <p className="whitespace-pre-line rounded-lg bg-sand/60 p-3 text-sm leading-6 text-ink">{request.note}</p>}
    </div>
  );
}
