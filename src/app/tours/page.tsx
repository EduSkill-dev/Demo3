import { createClient } from "@/lib/supabase/server";
import type { TourWithClub } from "@/types/database";
import { DEMO_TOURS } from "@/data/demoTours";
import ToursExplorer from "@/components/ToursExplorer";

export default async function ToursPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tours")
    .select("*, clubs(name)")
    .order("date", { ascending: true });

  const real: TourWithClub[] = (data ?? []).map((t: any) => ({
    ...t,
    club_name: t.clubs?.name ?? "",
  }));
  const tours = real.length > 0 ? real : DEMO_TOURS;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-center font-serif text-3xl font-semibold text-pine sm:text-4xl">
        Արշավներ
      </h1>
      <p className="mx-auto mt-2 max-w-xl text-center text-neutral-500">
        Ֆիլտրիր ըստ մարզի, ակումբի, տեսակի ու բարդության, կամ ուղղակի սեղմիր
        քարտի վրայի մարզի/ակումբի անվան վրա։
      </p>
      <div className="mt-8">
        <ToursExplorer tours={tours} />
      </div>
    </main>
  );
}
