import Link from "next/link";

const links = [
  { href: "/about", label: "Մեր մասին" },
  { href: "/tours", label: "Արշավներ" },
  { href: "/clubs", label: "Ակումբներ" },
  { href: "/faq", label: "ՀՈՒՊ" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-stone/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <Link href="/" className="text-lg font-bold text-pine">
          🏔️ Highland
        </Link>
        <nav className="order-3 flex w-full gap-6 text-sm font-medium text-neutral-700 sm:order-none sm:w-auto">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-apricot">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex gap-2">
          <Link
            href="/login"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold"
          >
            Մուտք
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-apricot px-4 py-2 text-sm font-semibold text-white"
          >
            Գրանցվել
          </Link>
        </div>
      </div>
    </header>
  );
}
