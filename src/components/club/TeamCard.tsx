"use client";

import { useState } from "react";

// One teammate on the club page: a round photo, the name and, a little lower,
// the role; the longer text opens under a small arrow, so the team takes
// little room. Cards are the same size (the grid sets the width; name and
// role keep fixed lines).
export default function TeamCard({ name, role, bio, photo, moreLabel }: { name: string; role: string | null; bio: string | null; photo: string | null; moreLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col items-center rounded-2xl border border-line bg-surface px-4 pb-3 pt-2 text-center shadow-sm">
      <div className="h-[8.5rem] w-[8.5rem] overflow-hidden rounded-full border-4 border-sand bg-sand">
        {photo ? <img src={photo} alt={name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-5xl">🧭</div>}
      </div>
      <div className="mt-1 flex min-h-[2.5rem] items-center justify-center">
        <p className="line-clamp-2 text-[17px] font-bold leading-snug text-heading" title={name}>
          {name}
        </p>
      </div>
      <p className="mt-1 min-h-[1rem] truncate text-xs font-semibold uppercase tracking-wide text-terracotta-500" title={role ?? ""}>
        {role ?? ""}
      </p>
      {bio ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={moreLabel}
            title={moreLabel}
            className="mt-2 flex h-7 w-10 items-center justify-center rounded-full text-muted transition hover:bg-sand hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
          {open && <p className="mt-1 whitespace-pre-line text-left text-sm leading-6 text-muted">{bio}</p>}
        </>
      ) : (
        <span className="mt-2 h-7" aria-hidden="true" />
      )}
    </li>
  );
}
