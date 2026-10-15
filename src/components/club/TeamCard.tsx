"use client";

import { useState } from "react";

// One teammate on the club page: photo, name and role; the longer text opens
// under a small arrow, so the team takes little room.
export default function TeamCard({ name, role, bio, photo, moreLabel }: { name: string; role: string | null; bio: string | null; photo: string | null; moreLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="w-full rounded-2xl border border-line bg-surface p-4 shadow-sm sm:w-[15.5rem]">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-sand bg-sand">
          {photo ? <img src={photo} alt={name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl">🧭</div>}
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 font-semibold leading-tight text-heading" title={name}>{name}</p>
          {role && <p className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-wide text-terracotta-500" title={role}>{role}</p>}
        </div>
      </div>
      {bio && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={moreLabel}
            title={moreLabel}
            className="mx-auto mt-2 flex h-6 w-10 items-center justify-center rounded-full text-muted transition hover:bg-sand hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
          {open && <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted">{bio}</p>}
        </>
      )}
    </li>
  );
}
