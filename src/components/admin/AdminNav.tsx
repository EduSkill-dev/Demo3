"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminAction } from "./adminApi";

export type NavEntry = { key: string; label: string; href?: string; children?: { key: string; label: string; href: string }[] };

// The admin area's menu. Sections in the default order (or this admin's own,
// saved), "Platform settings" folding its sub-sections. The pencil switches
// to arranging: drag a row (the whole row, or its ⋮⋮ grip), or use the
// arrows; Save keeps the order for this admin. Phones get a plain strip.
export default function AdminNav({ entries, saved }: { entries: NavEntry[]; saved: string[] | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const ordered = useMemo(() => {
    if (!saved?.length) return entries;
    const rank = new Map(saved.map((k, i) => [k, i]));
    return [...entries].sort((a, b) => (rank.get(a.key) ?? 999) - (rank.get(b.key) ?? 999));
  }, [entries, saved]);
  const [order, setOrder] = useState(ordered);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const links = order.flatMap((e) => (e.children ? e.children : [{ key: e.key, label: e.label, href: e.href! }]));
  const active = links
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const move = (key: string, to: number) =>
    setOrder((list) => {
      const from = list.findIndex((e) => e.key === key);
      if (from < 0 || to < 0 || to >= list.length || from === to) return list;
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });

  async function save(reset = false) {
    setBusy(true);
    await adminAction({ action: "nav.save", order: reset ? [] : order.map((e) => e.key) });
    setBusy(false);
    if (reset) setOrder(entries);
    setEditing(false);
    router.refresh();
  }

  const row = (isActive: boolean) =>
    `flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? "bg-terracotta-500/10 text-terracotta-700 dark:text-terracotta-300" : "text-muted hover:bg-sand/60 hover:text-ink"
    }`;

  return (
    <>
      {/* Phones: one scrolling strip, groups opened out. */}
      <nav aria-label="Ադմին" className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 pb-2 md:hidden">
        {links.map((l) => (
          <Link key={l.key} href={l.href} aria-current={l.href === active ? "page" : undefined} className={`${row(l.href === active)} shrink-0 whitespace-nowrap`}>
            {l.label}
          </Link>
        ))}
      </nav>

      <nav aria-label="Ադմին" className="relative hidden self-start rounded-xl border border-line bg-surface p-2 md:block">
        {editing ? (
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-line px-1 pb-2">
            <span className="text-xs font-bold uppercase tracking-wide text-terracotta-700 dark:text-terracotta-300">Դասավորել</span>
            <button
              type="button"
              onClick={() => {
                setOrder(ordered);
                setEditing(false);
              }}
              title="Չեղարկել"
              aria-label="Չեղարկել"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-sand hover:text-ink"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Փոխել բաժինների հերթականությունը"
            aria-label="Փոխել բաժինների հերթականությունը"
            className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-sand hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z" /></svg>
          </button>
        )}

        <ul className="space-y-0.5">
          {order.map((e, i) => {
            const groupActive = !!e.children?.some((c) => c.href === active);
            const isOpen = open[e.key] ?? groupActive;
            return (
              <li
                key={e.key}
                draggable={editing}
                onDragStart={() => setDragging(e.key)}
                onDragEnd={() => setDragging(null)}
                onDragOver={(ev) => {
                  if (!editing || !dragging || dragging === e.key) return;
                  ev.preventDefault();
                  move(dragging, i);
                }}
                className={`${editing ? "cursor-grab rounded-lg ring-1 ring-line active:cursor-grabbing" : ""} ${dragging === e.key ? "opacity-50" : ""} ${i === 0 && !editing ? "pr-8" : ""}`}
              >
                {editing ? (
                  <div className="flex items-center gap-1.5 py-1 pl-1.5 pr-1 text-[13px] font-medium leading-4 text-ink">
                    <span className="select-none text-muted" aria-hidden="true">⋮⋮</span>
                    <span className="min-w-0 flex-1">{e.label}</span>
                    <span className="flex shrink-0 flex-col">
                      <button type="button" onClick={() => move(e.key, i - 1)} disabled={i === 0} aria-label="Վեր" className="h-4 rounded px-1 text-[10px] leading-none text-muted hover:text-ink disabled:opacity-25">▲</button>
                      <button type="button" onClick={() => move(e.key, i + 1)} disabled={i === order.length - 1} aria-label="Վար" className="h-4 rounded px-1 text-[10px] leading-none text-muted hover:text-ink disabled:opacity-25">▼</button>
                    </span>
                  </div>
                ) : e.children ? (
                  <>
                    <button type="button" onClick={() => setOpen((o) => ({ ...o, [e.key]: !isOpen }))} aria-expanded={isOpen} className={`${row(false)} w-full text-left ${groupActive ? "!text-ink" : ""}`}>
                      <span>{e.label}</span>
                      <svg viewBox="0 0 20 20" className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 8l5 5 5-5" /></svg>
                    </button>
                    {isOpen && (
                      <ul className="mb-1 ml-3 space-y-0.5 border-l-2 border-line pl-2">
                        {e.children.map((c) => (
                          <li key={c.key}>
                            <Link href={c.href} aria-current={c.href === active ? "page" : undefined} className={row(c.href === active)}>
                              {c.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <Link href={e.href!} aria-current={e.href === active ? "page" : undefined} className={row(e.href === active)}>
                    {e.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        {editing && (
          <div className="mt-2 space-y-1.5 border-t border-line pt-2">
            <p className="px-1 text-[11px] leading-4 text-muted">Քաշեք տողերը կամ օգտվեք սլաքներից։</p>
            <button type="button" disabled={busy} onClick={() => save()} className="w-full rounded-lg bg-spruce-500 py-2 text-sm font-semibold text-white hover:bg-spruce-900 disabled:opacity-50">
              {busy ? "…" : "Պահպանել"}
            </button>
            <button type="button" disabled={busy} onClick={() => save(true)} className="w-full rounded-lg py-1.5 text-xs font-semibold text-muted hover:text-ink">
              Վերականգնել սկզբնական հերթականությունը
            </button>
          </div>
        )}
      </nav>
    </>
  );
}
