import { getPublicTours } from "@/lib/publicTours";
import ToursExplorer from "@/components/ToursExplorer";

export default async function ToursPage() {
  const tours = await getPublicTours();

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
