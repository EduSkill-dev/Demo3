"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TARIFF_LIMITS, type Tariff, type Tour } from "@/types/database";

export default function DashboardHome() {
  const router = useRouter();
  const [clubId, setClubId] = useState<string | null>(null);
  const [tariff, setTariff] = useState<Tariff>("start");
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLimit, setShowLimit] = useState(false);

  async function load() {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
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
      .select("*")
      .eq("club_id", club.id)
      .order("date", { ascending: true });
    setTours((tourRows ?? []) as Tour[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Ջնջե՞լ այս հայտարարությունը։")) return;
    const supabase = createClient();
    await supabase.from("tours").delete().eq("id", id);
    load();
  }

  if (loading) return <p className="text-neutral-500">Բեռնվում է...</p>;

  const max = TARIFF_LIMITS[tariff].maxListings;
  const atLimit = tours.length >= max;
  const tariffLabel = tariff === "start" ? "START" : tariff === "advanced" ? "Advanced" : "Pro";

  function handleNew() {
    if (atLimit) setShowLimit(true);
    else router.push("/dashboard/listings/new");
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Հայտարարություններ՝ {tours.length} / {max === Infinity ? "անսահմանափակ" : max}
        </p>
        <button
          onClick={handleNew}
          className="rounded-lg bg-apricot px-4 py-2 text-sm font-semibold text-white hover:bg-apricot-dark"
        >
          + Նոր տուր
        </button>
      </div>

      {showLimit && atLimit && (
        <div className="mt-5 rounded-xl border border-apricot/40 bg-apricot/10 p-4 text-sm text-apricot-dark">
          <p className="font-semibold">
            Դու արդեն սպառել ես «{tariffLabel}» տարիֆով սահմանված {max} հայտարարությունները։
          </p>
          <p className="mt-1 text-neutral-700">
            Ազատիր տեղ՝ ջնջելով մեկ հայտարարություն, կամ բարձրացրու տարիֆդ՝ նոր արշավներ հրապարակելու համար։
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/dashboard/tariff"
              className="rounded-lg bg-apricot px-4 py-2 font-semibold text-white hover:bg-apricot-dark"
            >
              Փոխել տարիֆը
            </Link>
            <button
              onClick={() => setShowLimit(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2 font-semibold text-neutral-600"
            >
              Փակել
            </button>
          </div>
        </div>
      )}

      {tours.length === 0 ? (
        <p className="mt-8 text-neutral-500">Դեռ հայտարարություն չկա։</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-sand text-left text-xs uppercase text-neutral-500">
                <th className="py-2">Անուն</th>
                <th className="py-2">Ամսաթիվ</th>
                <th className="py-2">Մարզ</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tours.map((t) => (
                <tr key={t.id} className="border-b border-sand text-sm">
                  <td className="py-3">{t.title}</td>
                  <td className="py-3">{t.date}</td>
                  <td className="py-3">{t.regions.join(", ")}</td>
                  <td className="py-3 text-right">
                    <Link href={`/dashboard/listings/${t.id}/edit`} className="mr-4 font-semibold text-apricot">
                      Խմբագրել
                    </Link>
                    <button onClick={() => handleDelete(t.id)} className="font-semibold text-red-600">
                      Ջնջել
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
