"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TARIFF_LIMITS, type Tariff } from "@/types/database";

interface TourRow {
  id: string;
  title: string;
  date: string;
  max_participants: number;
}

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  gender: string | null;
  email: string;
  phone: string | null;
}

interface Applicant {
  id: string;
  status: "confirmed" | "cancelled";
  created_at: string;
  tour_id: string;
  // PostgREST returns an object for this to-one embed, but older responses
  // shape it as a one-element array — normalise both.
  profiles: Profile | Profile[] | null;
}

function profileOf(a: Applicant): Profile | null {
  if (!a.profiles) return null;
  return Array.isArray(a.profiles) ? (a.profiles[0] ?? null) : a.profiles;
}

function nameOf(a: Applicant) {
  const p = profileOf(a);
  const full = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim();
  return full || p?.email || "Անանուն";
}

export default function ApplicationsPage() {
  const [clubId, setClubId] = useState<string | null>(null);
  const [tariff, setTariff] = useState<Tariff>("start");
  const [tours, setTours] = useState<TourRow[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
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

    const { data: tourRows } = await supabase
      .from("tours")
      .select("id, title, date, max_participants")
      .eq("club_id", club.id)
      .order("date", { ascending: true });
    const tourList = (tourRows ?? []) as TourRow[];
    setTours(tourList);

    if (tourList.length > 0) {
      const { data: rows } = await supabase
        .from("bookings")
        .select("id, status, created_at, tour_id, profiles(id, first_name, last_name, age, gender, email, phone)")
        .in(
          "tour_id",
          tourList.map((t) => t.id)
        )
        .order("created_at", { ascending: true });
      setApplicants((rows ?? []) as unknown as Applicant[]);
    } else {
      setApplicants([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <p className="text-neutral-500">Բեռնվում է...</p>;

  if (tours.length === 0) {
    return (
      <p className="text-neutral-500">
        Դեռ արշավ չունես։{" "}
        <Link href="/dashboard/listings/new" className="font-semibold text-apricot">
          Ստեղծիր առաջինը
        </Link>
        , որպեսզի մարդիկ կարողանան գրանցվել։
      </p>
    );
  }

  const seatCap = (t: TourRow) =>
    Math.min(t.max_participants, TARIFF_LIMITS[tariff].maxParticipants);

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-500">
        {clubId ? `Ակումբի տարիֆ՝ ${tariff === "start" ? "START" : tariff === "advanced" ? "Advanced" : "Pro"}` : null}
      </p>

      {tours.map((t) => {
        const rows = applicants.filter((a) => a.tour_id === t.id);
        const confirmed = rows.filter((a) => a.status === "confirmed");
        const cap = seatCap(t);

        return (
          <section key={t.id} className="rounded-2xl border border-sand bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-pine">{t.title}</h2>
                <p className="text-sm text-neutral-500">
                  {t.date} · Գրանցված՝ {confirmed.length} / {cap}
                </p>
              </div>
              <Link
                href={`/dashboard/listings/${t.id}/edit`}
                className="text-sm font-semibold text-apricot"
              >
                Խմբագրել
              </Link>
            </div>

            {rows.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-500">Դեռ ոչ ոք չի գրանցվել։</p>
            ) : (
              <ul className="mt-4 divide-y divide-sand">
                {rows.map((a) => {
                  const p = profileOf(a);
                  return (
                  <li
                    key={a.id}
                    className={`flex flex-wrap items-center justify-between gap-3 py-3 text-sm ${
                      a.status === "cancelled" ? "opacity-60" : ""
                    }`}
                  >
                    <div>
                      <p className="font-medium text-neutral-800">
                        {nameOf(a)}
                        {p?.age ? `, ${p.age} տարեկան` : ""}
                        {p?.gender === "female" ? " (իգ.)" : p?.gender === "male" ? " (ար.)" : ""}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {p?.email}
                        {p?.phone ? ` · ${p.phone}` : ""}
                      </p>
                    </div>

                    {a.status === "cancelled" ? (
                      <span className="text-xs font-semibold text-neutral-400">
                        Չեղարկված է
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                        Գրանցված
                      </span>
                    )}
                  </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
