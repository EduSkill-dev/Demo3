import { redirect } from "next/navigation";

// Following clubs became saved searches (a club-only search does the same).
export default function FavoritesPage() {
  redirect("/account/searches");
}
