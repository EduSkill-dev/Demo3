"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import TourForm from "@/components/TourForm";
import type { Tour } from "@/types/database";

export default function EditTourPage() {
  const params = useParams<{ id: string }>();
  const [tour, setTour] = useState<Tour | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tours")
        .select("*")
        .eq("id", params.id)
        .single();
      if (error || !data) return setNotFound(true);
      setTour(data as Tour);
    })();
  }, [params.id]);

  if (notFound) return <p className="text-neutral-500">Հայտարարությունը չի գտնվել։</p>;
  if (!tour) return <p className="text-neutral-500">Բեռնվում է...</p>;

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-pine">Խմբագրել հայտարարությունը</h2>
      <TourForm mode="edit" clubId={tour.club_id} initialTour={tour} />
    </div>
  );
}
