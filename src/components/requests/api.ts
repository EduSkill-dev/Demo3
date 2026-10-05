// One call to /api/requests; the answer is either the result or an error text.
export async function requestAction<T = Record<string, unknown>>(
  body: { action: string } & Record<string, unknown>
): Promise<{ data: T; error: null } | { data: null; error: string }> {
  const res = await fetch("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const json = res ? ((await res.json().catch(() => ({}))) as T & { error?: string }) : null;
  if (!res?.ok || !json) return { data: null, error: json?.error || "" };
  return { data: json, error: null };
}

export const fieldClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-apricot focus:outline-none focus:ring-2 focus:ring-apricot/20";
export const labelClass = "mb-1 block text-sm font-medium text-ink";
export const primaryButton =
  "rounded-lg bg-apricot px-4 py-2.5 text-sm font-semibold text-white hover:bg-apricot-dark disabled:cursor-not-allowed disabled:opacity-50";
export const ghostButton =
  "rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:border-apricot disabled:cursor-not-allowed disabled:opacity-50";
