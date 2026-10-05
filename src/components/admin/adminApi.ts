// Shared by the admin screens (no "use client": server pages use the class
// names too).

// One call to /api/admin; the answer is either the result or an error text.
export async function adminAction<T = Record<string, unknown>>(
  body: { action: string } & Record<string, unknown>
): Promise<{ data: T; error: null } | { data: null; error: string }> {
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const json = res ? ((await res.json().catch(() => ({}))) as T & { error?: string }) : null;
  if (!res?.ok || !json) return { data: null, error: json?.error || "Սերվերին կապվել չստացվեց։ Փորձեք նորից։" };
  return { data: json, error: null };
}

// A field in a row of filters: the caller gives it a width.
export const adminInlineInput =
  "rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-apricot focus:outline-none focus:ring-2 focus:ring-apricot/20";
export const adminInput = `w-full ${adminInlineInput}`;
export const adminButton =
  "rounded-lg bg-apricot px-4 py-2 text-sm font-semibold text-white hover:bg-apricot-dark disabled:cursor-not-allowed disabled:opacity-50";
export const adminGhost =
  "rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-apricot disabled:cursor-not-allowed disabled:opacity-50";
export const adminDanger =
  "rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40";
