"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function ClubRegisterPage() {
  const [clubName, setClubName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: "club", club_name: clubName } },
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
          հետո մուտք գործիր։ Փաթեթը կընտրես վահանակից։
        </p>
      </main>
    );
  }

  const input = "w-full rounded-lg border border-neutral-300 p-3";
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-bold text-pine">Գրանցում՝ ակումբի համար</h1>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
