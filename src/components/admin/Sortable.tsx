import Link from "next/link";

// Sorting for the admin lists: a column header with small up/down arrows.
// Client lists use SortButton (state); server pages use SortLink (the order
// lives in the URL: ?sort=column&dir=asc|desc). The first click sorts up,
// the next one down.

export type SortDir = "asc" | "desc";
export type SortState = { col: string; dir: SortDir };

const collator = new Intl.Collator("hy", { sensitivity: "base", numeric: true });

// Sort a copy of the rows by one column. Text is compared the Armenian way,
// numbers and dates (ISO strings) as such; empty values always go last.
export function sortRows<T>(rows: T[], getters: Record<string, (row: T) => string | number | null | undefined>, s: SortState): T[] {
  const get = getters[s.col];
  if (!get) return rows;
  const sign = s.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    const xe = x === null || x === undefined || x === "";
    const ye = y === null || y === undefined || y === "";
    if (xe || ye) return xe && ye ? 0 : xe ? 1 : -1;
    return sign * (typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y)));
  });
}

// The order asked for in the URL, if it names a known column.
export function readSort(params: { sort?: string; dir?: string }, columns: string[], fallback: SortState): SortState {
  return columns.includes(params.sort ?? "") ? { col: params.sort!, dir: params.dir === "desc" ? "desc" : "asc" } : fallback;
}

export const nextSort = (s: SortState, col: string): SortState => ({ col, dir: s.col === col && s.dir === "asc" ? "desc" : "asc" });

function Arrows({ on, dir }: { on: boolean; dir: SortDir }) {
  return (
    <span className="ml-1 inline-flex flex-col leading-none" aria-hidden="true">
      <svg viewBox="0 0 10 6" className={`h-[6px] w-2.5 ${on && dir === "asc" ? "text-terracotta-500" : "opacity-35"}`} fill="currentColor"><path d="M5 0l5 6H0z" /></svg>
      <svg viewBox="0 0 10 6" className={`mt-px h-[6px] w-2.5 ${on && dir === "desc" ? "text-terracotta-500" : "opacity-35"}`} fill="currentColor"><path d="M0 0h10L5 6z" /></svg>
    </span>
  );
}

const inner = "inline-flex items-center gap-0.5 uppercase tracking-wide hover:text-ink";

export function SortButton({ label, col, sort, onSort }: { label: string; col: string; sort: SortState; onSort: (s: SortState) => void }) {
  const on = sort.col === col;
  return (
    <button type="button" onClick={() => onSort(nextSort(sort, col))} className={`${inner} ${on ? "text-ink" : ""}`}>
      {label}
      <Arrows on={on} dir={sort.dir} />
    </button>
  );
}

export function SortLink({ label, col, sort, href }: { label: string; col: string; sort: SortState; href: (s: SortState) => string }) {
  const on = sort.col === col;
  return (
    <Link href={href(nextSort(sort, col))} scroll={false} className={`${inner} ${on ? "text-ink" : ""}`}>
      {label}
      <Arrows on={on} dir={sort.dir} />
    </Link>
  );
}
