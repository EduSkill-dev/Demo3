// Hiker badges, from the places a person has been to (see passport_places and
// public_hikers in migration 0057). One badge per kind: the highest step
// reached, written "10" on the step itself and "10+" past it.
//   mountains: 3, 5, 10, 15, 20, 30, … 100 (the last step)
//   lakes:     3, 5, 10, 15, 20 (and 20+ from there on)
//   heritage:  10, 50, 100, 150, … 500
//   curious:   places of at least five different kinds

export type BadgeKind = "mountains" | "lakes" | "heritage" | "curious";
export type Badge = { kind: BadgeKind; step: number; label: string; count: number };
export type PassportCounts = { mountains: number; lakes: number; heritage: number; kinds: number };

const range = (from: number, to: number, by: number) => Array.from({ length: Math.floor((to - from) / by) + 1 }, (_, i) => from + i * by);

export const BADGE_STEPS: Record<Exclude<BadgeKind, "curious">, number[]> = {
  mountains: [3, 5, 10, 15, ...range(20, 100, 10)],
  lakes: [3, 5, 10, 15, 20],
  heritage: [10, ...range(50, 500, 50)],
};
export const CURIOUS_KINDS = 5;

function stepBadge(kind: Exclude<BadgeKind, "curious">, count: number): Badge | null {
  const steps = BADGE_STEPS[kind].filter((s) => count >= s);
  if (!steps.length) return null;
  const step = steps[steps.length - 1];
  return { kind, step, label: count > step ? `${step}+` : String(step), count };
}

export function badgesFor(c: PassportCounts): Badge[] {
  const out: Badge[] = [];
  for (const kind of ["mountains", "lakes", "heritage"] as const) {
    const b = stepBadge(kind, c[kind]);
    if (b) out.push(b);
  }
  if (c.kinds >= CURIOUS_KINDS) out.push({ kind: "curious", step: CURIOUS_KINDS, label: "", count: c.kinds });
  return out;
}
