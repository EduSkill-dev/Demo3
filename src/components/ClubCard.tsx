import Link from "next/link";
import type { Club } from "@/types/database";

export default function ClubCard({
  club,
  showRating,
  rating,
  ratingCount,
}: {
  club: Club;
  showRating: boolean;
  rating: number | null;
  ratingCount: number;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-sand bg-white">
      <Link href={`/clubs/${club.id}`}>
        {club.photo_url ? (
          <img src={club.photo_url} alt={club.name} className="h-44 w-full object-cover" />
        ) : (
          <div className="flex h-44 items-center justify-center bg-gradient-to-br from-pine to-apricot/70 text-4xl">
            🏔️
          </div>
        )}
      </Link>
      <div className="p-5">
        <Link href={`/clubs/${club.id}`} className="font-serif text-xl font-semibold text-pine hover:text-apricot-dark">
          {club.name}
        </Link>

        {showRating && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="font-semibold text-apricot">
              {rating != null ? `★ ${rating.toFixed(1)}` : "Դեռ գնահատական չկա"}
            </span>
            {rating != null && <span className="text-neutral-400">({ratingCount})</span>}
          </div>
        )}

        <Link
          href={`/clubs/${club.id}#comments`}
          className="mt-2 inline-block text-sm font-medium text-neutral-500 hover:text-apricot"
        >
          Մեկնաբանություններ
        </Link>
      </div>
    </article>
  );
}
