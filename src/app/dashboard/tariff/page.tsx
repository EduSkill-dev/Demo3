"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TARIFF_LIMITS, type Tariff } from "@/types/database";

type Plan = "start" | "advanced" | "pro";

const PLANS: { id: Plan; name: string; lines: string[] }[] = [
  {
    id: "start",
    name: "START",
    lines: [
      `Մինչև ${TARIFF_LIMITS.start.maxListings} հայտարարություն`,
      `Մինչև ${TARIFF_LIMITS.start.maxParticipants} մասնակից արշավի համար`,
      "Ակումբի վարկանիշն ու մեկնաբանությունները չեն երևում",
    ],
  },
  {
    id: "advanced",
    name: "Advanced",
    lines: [
      `Մինչև ${TARIFF_LIMITS.advanced.maxListings} հայտարարություն`,
      `Մինչև ${TARIFF_LIMITS.advanced.maxParticipants} մասնակից արշավի համար`,
      "Վարկանիշն ու մեկնաբանությունները երևում են",
      "Մեկնաբանությունները տեսանելի են նաև վահանակում",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    lines: ["Շուտով"],
  },
];

export default function TariffPage() {
  const [clubId, setClubId] = useState<string | null>(null);
  const [tariff, setTariff] = useState<Tariff>("start");
  const [toursCount, setToursCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setLoading(false);
      const { data: club } = await supabase
        .from("clubs")
        .select("id, tariff")
        .eq("owner_id", auth.user.id)
        .single();
      if (!club) return setLoading(false);
      setClubId(club.id);
      setTariff(club.tariff as Tariff);
      const { count } = await supabase
        .from("tours")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club.id);
      setToursCount(count ?? 0);
      setLoading(false);
    })();
  }, []);

  async function choose(plan: Plan) {
    if (!clubId || plan === tariff || plan === "pro") return;
    const target = PLANS.find((p) => p.id === plan)!;
    const newMax = TARIFF_LIMITS[plan].maxListings;

    if (
      toursCount > newMax &&
      !confirm(
        `Դու ունես ${toursCount} հայտարարություն, իսկ «${target.name}» տարիֆով սահմանը ${newMax} է։ Ավելորդները կմնան, բայց նորերը չես կարող ավելացնել։ Շարունակե՞լ։`
      )
    )
      return;

    setSaving(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("clubs")
      .update({ tariff: plan })
      .eq("id", clubId);

    setSaving(false);
    if (updateError) return setError(updateError.message);

    setTariff(plan);
    setMessage(`Տարիֆը փոխվեց՝ ${target.name}։`);
  }

  if (loading) return <p className="text-neutral-500">Բեռնվում է...</p>;

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-neutral-500">
        Ընթացիկ տարիֆդ՝ <b>{tariff === "start" ? "START" : tariff === "advanced" ? "Advanced" : "Pro"}</b>.
        Հայտարարություններ՝ {toursCount}։
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {PLANS.map((p) => {
          const current = p.id === tariff;
          const enabled = p.id !== "pro";
          return (
            <div
              key={p.id}
              className={`rounded-xl border p-4 ${
                current ? "border-apricot bg-white" : "border-neutral-300 bg-white"
              } ${enabled ? "" : "opacity-60"}`}
            >
              <div className="flex items-center justify-between">
                <b>{p.name}</b>
                {current && (
                  <span className="rounded-full bg-apricot/10 px-2 py-1 text-xs font-semibold text-apricot-dark">
                    Ներկա
                  </span>
                )}
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-neutral-600">
                {p.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {enabled && !current && (
                <button
                  onClick={() => choose(p.id)}
                  disabled={saving}
                  className="mt-4 w-full rounded-lg bg-apricot py-2 text-sm font-semibold text-white hover:bg-apricot-dark disabled:opacity-50"
                >
                  {saving ? "..." : `Ընտրել ${p.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <p className="mt-6 text-xs text-neutral-400">
        Վճարումը կապելիս կլինի ավելի ուշ՝ MVP-ում տարիֆի փոփոխությունը անվճար է։
      </p>
    </div>
  );
}
