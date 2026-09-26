import { createClient } from "@/lib/supabase/server";
import type { Tour } from "@/types/database";

export default async function ToursPage() {
  const supabase = createClient();

  // Once the "tours" table has real data, this will return it directly.
  // Until then it will just return an empty array — that's expected.
  const { data: tours } = await supabase
    .from("tours")
    .select("*")
    .order("date", { ascending: true });

  const list = (tours ?? []) as Tour[];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-bold text-pine">Discover & book</h1>

      {list.length === 0 ? (
        <p className="mt-6 text-neutral-500">
          No tours yet — once clubs start publishing, they&apos;ll show up
          here.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {list.map((tour) => (
            <div
              key={tour.id}
              className="rounded-xl border border-neutral-200 p-5"
            >
              <p className="text-xs font-semibold uppercase text-apricot">
                {tour.region}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{tour.title}</h2>
              <p className="mt-2 text-sm text-neutral-500">{tour.date}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
