"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TourForm from "@/components/TourForm";

export default function NewTourPage() {
  const [clubId, setClubId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setLoaded(true);
      const { data: club } = await supabase
        .from("clubs")
        .select("id")
        .eq("owner_id", auth.user.id)
        .single();
      setClubId(club?.id ?? null);
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return <p className="text-neutral-500">Բեռնվում է...</p>;
  if (!clubId)
    return (
      <p className="text-neutral-500">
        Ակումբը չի գտնվել։ Վերարժեգրիր և փորձիր նորից։
      </p>
    );

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-pine">Նոր հայտարարություն</h2>
      <TourForm mode="create" clubId={clubId} />
    </div>
  );
}
