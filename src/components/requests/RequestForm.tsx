"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REGIONS, TERRAINS } from "@/lib/catalog";
import { hasContactDetails } from "@/lib/requests";
import { serverErrorMessage } from "@/lib/serverErrors";
import { useT } from "@/i18n/client";
import SightPicker, { type SightOption } from "@/components/SightPicker";
import { fieldClass, ghostButton, labelClass, primaryButton, requestAction } from "./api";

const hint = "mt-1 text-xs text-muted";
const boxes = "grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg border border-line bg-surface p-3 sm:grid-cols-3";

// An individual describes the trip they want; clubs answer with offers.
export default function RequestForm({ sights }: { sights: SightOption[] }) {
  const t = useT();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [people, setPeople] = useState("2");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [terrains, setTerrains] = useState<string[]>([]);
  const [sightIds, setSightIds] = useState<string[]>([]);
  const [overnight, setOvernight] = useState(false);
  const [budget, setBudget] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, key: string) =>
    set(list.includes(key) ? list.filter((x) => x !== key) : [...list, key]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (regions.length === 0 && sightIds.length === 0) return setError(t("requests.errPlace"));
    if (dateTo && dateTo < dateFrom) return setError(t("requests.errDates"));
    if (note && hasContactDetails(note)) return setError(t("requests.errContact"));

    setBusy(true);
    const res = await requestAction({
      action: "create",
      people: Number(people),
      dateFrom,
      dateTo: dateTo || dateFrom,
      regions,
      terrains,
      sightIds,
      overnight,
      budget: budget === "" ? null : Number(budget),
      note,
    });
    setBusy(false);
    if (res.error !== null) return setError(serverErrorMessage(t, res.error));
    router.push("/account/requests");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5">
      <p className="text-sm text-muted">{t("requests.formIntro")}</p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="rq-people" className={labelClass}>{t("requests.people")}</label>
          <input id="rq-people" required type="number" min={1} max={200} value={people} onChange={(e) => setPeople(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="rq-from" className={labelClass}>{t("requests.dateFrom")}</label>
          <input id="rq-from" required type="date" min={today} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="rq-to" className={labelClass}>{t("requests.dateTo")}</label>
          <input id="rq-to" type="date" min={dateFrom || today} value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={fieldClass} />
        </div>
      </div>
      <p className={`${hint} !mt-1`}>{t("requests.datesHint")}</p>

      <fieldset>
        <legend className={labelClass}>{t("requests.regions")}</legend>
        <div className={boxes}>
          {REGIONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={regions.includes(r)} onChange={() => toggle(regions, setRegions, r)} className="accent-apricot" />
              {t(`region.${r}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <p className={labelClass}>{t("requests.sights")}</p>
        <SightPicker sights={sights} value={sightIds} onChange={setSightIds} regions={regions} />
        <p className={hint}>{t("requests.placeHint")}</p>
      </div>

      <fieldset>
        <legend className={labelClass}>{t("requests.terrains")}</legend>
        <div className={boxes}>
          {TERRAINS.map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={terrains.includes(k)} onChange={() => toggle(terrains, setTerrains, k)} className="accent-apricot" />
              {t(`terrain.${k}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rq-budget" className={labelClass}>{t("requests.budgetLabel")}</label>
          <input id="rq-budget" type="number" min={0} step="500" value={budget} onChange={(e) => setBudget(e.target.value)} className={fieldClass} />
          <p className={hint}>{t("requests.budgetHint")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-ink sm:mt-8">
          <input type="checkbox" checked={overnight} onChange={(e) => setOvernight(e.target.checked)} className="accent-apricot" />
          {t("tourForm.overnight")}
        </label>
      </div>

      <div>
        <label htmlFor="rq-note" className={labelClass}>{t("requests.note")}</label>
        <textarea id="rq-note" rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} />
        <p className={hint}>{t("requests.noteHint")}</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? "..." : t("requests.submit")}
        </button>
        <button type="button" onClick={() => router.push("/account/requests")} className={ghostButton}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
