import Link from "next/link";

export const PAGE_SIZES = [25, 50, 75, 100] as const;
export const readPageSize = (v: string | undefined, fallback = 50) => {
  const n = Number(v);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : fallback;
};

// The page numbers under a long admin list: in the middle 1 … 4 5 [6] 7 8 … 16
// (with "Start" once one is a few pages in), on the right how many rows a
// page shows. Changing the size keeps the first row in view on its page.
// Every link lands at the list's top (`anchor`), not the top of the page.
export default function Pager({
  page,
  pages,
  size,
  href,
  anchor,
}: {
  page: number;
  pages: number;
  size: number;
  href: (page: number, size: number) => string; // without the #anchor
  anchor: string;
}) {
  const near = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter((p) => p >= 1 && p <= pages));
  const numbers = [...near].sort((a, b) => a - b);
  const cell = "flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-sm font-semibold tabular-nums transition";
  const to = (p: number, s = size) => `${href(p, s)}#${anchor}`;

  return (
    <nav className="mt-4 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]" aria-label="Էջեր">
      <span className="hidden sm:block" />
      <div className="flex flex-wrap items-center justify-center gap-1">
        {page > 3 && (
          <Link href={to(1)} className={`${cell} mr-1 text-muted hover:bg-sand hover:text-ink`}>
            ← Սկիզբ
          </Link>
        )}
        {numbers.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            {i > 0 && p - numbers[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
            {p === page ? (
              <span aria-current="page" className={`${cell} bg-spruce-500 text-white`}>{p}</span>
            ) : (
              <Link href={to(p)} className={`${cell} text-ink hover:bg-sand`}>{p}</Link>
            )}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1 text-xs text-muted sm:justify-end">
        <span className="mr-1">Տողեր էջում՝</span>
        {PAGE_SIZES.map((s) =>
          s === size ? (
            <span key={s} aria-current="true" className={`${cell} h-7 min-w-[1.75rem] bg-sand text-ink`}>{s}</span>
          ) : (
            <Link key={s} href={to(Math.floor(((page - 1) * size) / s) + 1, s)} className={`${cell} h-7 min-w-[1.75rem] hover:bg-sand hover:text-ink`}>
              {s}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
