import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold text-pine">
        Every hike in Armenia, in one place.
      </h1>
      <p className="mt-4 text-lg text-neutral-600">
        Highland brings together the country&apos;s hiking clubs and tour
        operators so you can find a trip, book it, and go.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/tours"
          className="rounded-lg bg-apricot px-5 py-3 font-semibold text-white"
        >
          Find a hike
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-neutral-300 px-5 py-3 font-semibold"
        >
          Create an account
        </Link>
      </div>
    </main>
  );
}
