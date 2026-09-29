"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [step, setStep] = useState<"choose" | "individual">("choose");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
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
      options: {
        data: {
          role: "individual",
          first_name: firstName,
          last_name: lastName,
          age,
          gender,
        },
      },
    });
    if (error) return setError(error.message);
    // If email confirmation is on, there is no session yet.
    if (data.session) window.location.href = "/";
    else setDone(true);
  }

  if (done) {
    return (
      <main className="mx-auto max-w-sm px-6 py-16">
        <h1 className="text-2xl font-bold text-pine">Գրեթե պատրաստ է</h1>
        <p className="mt-3 text-neutral-600">
          Ուղարկեցինք հաստատման նամակ {email} հասցեին։ Սեղմիր նամակի հղմանը և
          հետո մուտք գործիր։
        </p>
      </main>
    );
  }

  if (step === "choose") {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-bold text-pine">Ինչպե՞ս ես ուզում գրանցվել</h1>
        <div className="mt-6 space-y-4">
          <button
            onClick={() => setStep("individual")}
            className="w-full rounded-xl border border-neutral-300 bg-white p-5 text-left hover:border-apricot"
          >
            <b>Որպես անհատ / արշավի մասնակից</b>
            <p className="mt-1 text-sm text-neutral-500">
              Անվճար։ Գտիր արշավներ, գրանցվիր, գնահատիր։
            </p>
          </button>
          <Link
            href="/register/club"
            className="block w-full rounded-xl border border-neutral-300 bg-white p-5 hover:border-apricot"
          >
            <b>Որպես արշավական ակումբ / կազմակերպող</b>
            <p className="mt-1 text-sm text-neutral-500">
              Տարիֆային պլաններ։ Հրապարակիր քո արշավները։
            </p>
          </Link>
        </div>
      </main>
    );
  }

  const input = "w-full rounded-lg border border-neutral-300 p-3";
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-bold text-pine">Գրանցում՝ անհատի համար</h1>
      <p className="mt-1 text-sm text-neutral-500">Անվճար։ Քարտ պարտադիր չէ։</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input required placeholder="Անուն" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={input} />
        <input required placeholder="Ազգանուն" value={lastName} onChange={(e) => setLastName(e.target.value)} className={input} />
        <input required type="number" placeholder="Տարիք" value={age} onChange={(e) => setAge(e.target.value)} className={input} />
        <select required value={gender} onChange={(e) => setGender(e.target.value)} className={input}>
          <option value="">Սեռ</option>
          <option value="male">Արական</option>
          <option value="female">Իգական</option>
        </select>
        <input required type="email" placeholder="Էլ. հասցե" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        <input required type="password" minLength={6} placeholder="Գաղտնաբառ" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded-lg bg-apricot py-3 font-semibold text-white">
          Գրանցվել
        </button>
      </form>
    </main>
  );
}
