import Link from "next/link";
import { getT } from "@/i18n/server";
import { getViewer } from "@/lib/viewer";

// The invitation to order a custom hike (home page, Tours page). A visitor is
// taken to the sign-up that leads to the request form, an individual straight
// to the form. Clubs and admins do not order hikes, so they do not see it.
export default async function CustomTourCta() {
  const [t, viewer] = await Promise.all([getT(), getViewer()]);
  if (viewer && viewer.role !== "individual") return null;

  return (
    <section className="rounded-2xl bg-spruce-900 p-6 text-card sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-serif text-2xl font-bold">{t("custom.title")}</h2>
          <p className="mt-2 text-sm text-card/85">{t("custom.text")}</p>
        </div>
        <Link
          href={viewer ? "/account/requests/new" : "/requests/new"}
          className="shrink-0 rounded-lg bg-apricot-500 px-6 py-3 text-center font-bold text-spruce-900 hover:bg-apricot-300"
        >
          {t("custom.button")}
        </Link>
      </div>
    </section>
  );
}
