"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TARIFF_LIMITS } from "@/types/database";

type Plan = "start" | "advanced" | "pro";

const PLANS: { id: Plan; name: string; enabled: boolean; lines: string[] }[] = [
  {
    id: "start",
    name: "START",
    enabled: true,
    lines: [
      `Մինչև ${TARIFF_LIMITS.start.maxListings} հայտարարություն`,
      `Մինչև ${TARIFF_LIMITS.start.maxParticipants} մասնակից արշավի համար`,
      "Ակումբի վարկանիշն ու մեկնաբանությունները չեն երևում",
    ],
  },
  {
    id: "advanced",
    name: "Advanced",
    enabled: true,
    lines: [
      `Մինչև ${TARIFF_LIMITS.advanced.maxListings} հայտարարություն`,
      `Մինչև ${TARIFF_LIMITS.advanced.maxParticipants} մասնակից արշավի համար`,
      "Վարկանիշն ու մեկնաբանությունները երևում են",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    enabled: false,
    lines: ["Շուտով"],
  },
];

export default function ClubRegisterPage() {
  const [clubName, setClubName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<Plan>("start");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: "club", club_name: clubName, tariff: plan } },
    });
    if (error) return setError(error.message);
    if (data.session) window.location.href = "/";
    else setDone(true);
  }

  if (done) {
    return (
      <main className="mx-auto max-w-sm px-6 py-16">
        <h1 className="text-2xl font-bold text-pine">Գրեթե պատրաստ է</h1>
        <p className="mt-3 text-neutral-600">
          Ուղարկեցինք հաստատման նամակ {email} հասցեին։ Սեղմիր նամակի հղմանը և
          հետո մուտք գործիր։ (Վճարումը կավելացվի հաջորդ փուլում։)
        </p>
      </main>
    );
  }

  const input = "w-full rounded-lg border border-neutral-300 p-3";
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold text-pine">Գրանցում՝ ակումբի համար</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {PLANS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={!p.enabled}
            onClick={() => setPlan(p.id)}
            className={`rounded-xl border p-4 text-left ${
              plan === p.id ? "border-apricot bg-white" : "border-neutral-300 bg-white"
            } ${p.enabled ? "" : "cursor-not-allowed opacity-50"}`}
          >
            <b>{p.name}</b>
            <ul className="mt-2 list-disc pl-4 text-sm text-neutral-600">
              {p.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-8 max-w-sm space-y-4">
        <input required placeholder="Ակումբի անվանում" value={clubName} onChange={(e) => setClubName(e.target.value)} className={input} />
        <input required type="email" placeholder="Էլ. հասցե" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        <input required type="password" minLength={6} placeholder="Գաղտնաբառ" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded-lg bg-apricot py-3 font-semibold text-white">
          Գրանցել ակումբը
        </button>
      </form>
    </main>
  );
}
