import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  DIFFICULTY_LABELS,
  TYPE_LABELS,
  TARIFF_LIMITS,
  type Club,
  type Tariff,
  type Tour,
} from "@/types/database";
import BackLink from "@/components/BackLink";
import TourSignup from "@/components/TourSignup";
import RatingBox from "@/components/RatingBox";

type TourWithClub = Tour & { clubs: Club | null };

function cancelLabel(hours: number) {
  if (hours === 0) return "Ցանկացած պահի";
  if (hours % 24 === 0) return `Մինչև ${hours / 24} օր առաջ`;
  return `Մինչև ${hours} ժամ առաջ`;
}

async function getTour(id: string): Promise<TourWithClub | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tours")
    .select("*, clubs(*)")
    .eq("id", id)
    .maybeSingle();
  return (data as TourWithClub | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const tour = await getTour(params.id);
  if (!tour) return { title: "Արշավ | Highland" };
  return {
    title: `${tour.title} | Highland`,
    description: tour.description ?? `${tour.title} — արշավ Հայաստանում։`,
  };
}

export default async function TourDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const tour = await getTour(params.id);

  if (!tour) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <BackLink fallback="/tours" label="Արշավներ" />
        <h1 className="mt-8 font-serif text-2xl font-semibold text-pine">
          Արշավը չի գտնվել
        </h1>
        <p className="mt-2 text-neutral-500">
          Հնարավոր է՝ այն ջնջվել է կամ դեռ հրապարակված չէ։
        </p>
        <Link
          href="/tours"
          className="mt-6 inline-block rounded-lg bg-apricot px-5 py-3 font-semibold text-white"
        >
          Տեսնել բոլոր արշավները
        </Link>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: takenRaw } = await supabase.rpc("seats_taken", { p_tour: tour.id });
  const taken = typeof takenRaw === "number" ? takenRaw : 0;

  const { data: ratingRows } = await supabase
    .from("ratings")
    .select("id, score, comment, created_at")
    .eq("tour_id", tour.id)
    .order("created_at", { ascending: false });
  const tourRatings = (ratingRows ?? []) as {
    id: string;
    score: number;
    comment: string | null;
    created_at: string;
  }[];
  const avgRating =
    tourRatings.length > 0
      ? tourRatings.reduce((a, r) => a + r.score, 0) / tourRatings.length
      : null;

  const club = tour.clubs;
  const tariff: Tariff = (club?.tariff as Tariff) ?? "start";
  const limit = Math.min(
    tour.max_participants,
    TARIFF_LIMITS[tariff].maxParticipants
  );

  const details: { label: string; value: React.ReactNode }[] = [
    { label: "Ամսաթիվ", value: tour.date },
    { label: "Մարզեր", value: tour.regions.join(", ") || "—" },
    { label: "Տեսակ", value: TYPE_LABELS[tour.type] },
    { label: "Բարդություն", value: DIFFICULTY_LABELS[tour.difficulty] },
    { label: "Գիշերակաց", value: tour.overnight ? "Այո" : "Ոչ" },
    { label: "Մասնակիցների առավելագույն", value: limit },
    {
      label: "Կոորդինատոր",
      value: (
        <a href={`tel:${tour.coordinator_phone.replace(/\s/g, "")}`} className="hover:text-apricot">
          {tour.coordinator_phone}
        </a>
      ),
    },
    ...(tour.meeting_point
      ? [{ label: "Հավաքի վայր", value: tour.meeting_point }]
      : []),
    ...(tour.meeting_time
      ? [{ label: "Հավաքի ժամ", value: tour.meeting_time.slice(0, 5) }]
      : []),
    ...(tour.cancel_deadline_hours != null
      ? [{ label: "Չեղարկում", value: cancelLabel(tour.cancel_deadline_hours) }]
      : []),
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <BackLink fallback="/tours" label="Արշավներ" />

      {/* Cover */}
      {tour.photo_urls?.[0] ? (
        <img
          src={tour.photo_urls[0]}
          alt={tour.title}
          className="mt-5 h-64 w-full rounded-2xl object-cover sm:h-80"
        />
      ) : (
        <div className="mt-5 flex h-48 items-center justify-center rounded-2xl bg-gradient-to-br from-pine to-apricot/70 text-5xl sm:h-64">
          🏔️
        </div>
      )}

      {(tour.photo_urls?.length ?? 0) > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {tour.photo_urls.map((url, i) => (
            <img
              key={`${url}-${i}`}
              src={url}
              alt={`${tour.title} — ${i + 1}`}
              className="h-20 w-28 shrink-0 rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main info */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-apricot">
            {tour.regions.join(" · ")}
            {tour.regions.length > 0 && " · "}
            {club && (
              <Link href={`/clubs/${club.id}`} className="text-pine hover:text-apricot-dark">
                {club.name}
              </Link>
            )}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-pine">
            {tour.title}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {tour.date} · {DIFFICULTY_LABELS[tour.difficulty]}
            {tour.overnight ? " · գիշերակացով" : ""}
          </p>

          {tour.description && (
            <p className="mt-6 whitespace-pre-line leading-7 text-neutral-700">
              {tour.description}
            </p>
          )}

          <dl className="mt-8 grid gap-x-8 gap-y-3 rounded-2xl border border-sand bg-white p-5 sm:grid-cols-2">
            {details.map((d) => (
              <div key={d.label} className="flex justify-between gap-4 text-sm">
                <dt className="text-neutral-500">{d.label}</dt>
                <dd className="text-right font-medium text-neutral-800">{d.value}</dd>
              </div>
            ))}
          </dl>

          {tour.notes && (
            <div className="mt-6 rounded-2xl bg-sand p-5">
              <h2 className="font-semibold text-pine">Ինչ վերցնել</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">
                {tour.notes}
              </p>
            </div>
          )}

          {club && (
            <Link
              href={`/clubs/${club.id}`}
              className="mt-6 inline-block text-sm font-semibold text-apricot hover:text-apricot-dark"
            >
              → Ակումբի մասին՝ {club.name}
            </Link>
          )}

          {/* Ratings */}
          <div className="mt-10 border-t border-sand pt-6">
            <h2 className="font-serif text-lg font-semibold text-pine">
              Գնահատականներ
              {avgRating != null && (
                <span className="ml-2 text-sm font-semibold text-apricot">
                  ★ {avgRating.toFixed(1)} ({tourRatings.length})
                </span>
              )}
            </h2>

            <div className="mt-4 rounded-2xl border border-sand bg-white p-5">
              <RatingBox target="tour" tourId={tour.id} noun="արշավը" />
            </div>

            {tourRatings.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-500">
                Դեռ գնահատական չկա։ Եթե մասնակցել ես, առաջինը գնահատիր։
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {tourRatings
                  .filter((r) => r.comment)
                  .map((r) => (
                    <li key={r.id} className="rounded-lg border border-sand bg-white p-4 text-sm">
                      <span className="font-semibold text-apricot">★ {r.score}</span>
                      <p className="mt-1 text-neutral-600">{r.comment}</p>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sign-up */}
        <aside className="h-fit lg:sticky lg:top-24">
          <TourSignup
            tourId={tour.id}
            date={tour.date}
            taken={taken}
            limit={limit}
            cancelHours={tour.cancel_deadline_hours}
          />
        </aside>
      </div>
    </main>
  );
}
