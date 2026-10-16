// The admins' bell (server only): rows of admin_events this admin may see,
// and how many came after their "seen up to" mark. See 0066_admin_events.sql.
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_PERMS } from "@/lib/adminLabels";

import type { AdminEvent } from "@/lib/adminEventKinds";

export type { AdminEvent };

type Db = ReturnType<typeof createAdminClient>;

// Super admins see everything; others the rows of their permissions and the
// rows meant for all (perm null).
async function scope(db: Db, userId: string) {
  const { data } = await db.from("admins").select("is_super, perms, events_seen_at").eq("user_id", userId).maybeSingle();
  const a = data as { is_super: boolean; perms: string[]; events_seen_at: string } | null;
  if (!a) return null;
  const perms = ADMIN_PERMS.filter((p) => a.perms.includes(p));
  const filter = a.is_super ? null : perms.length ? `perm.is.null,perm.in.(${perms.join(",")})` : "perm.is.null";
  return { seenAt: a.events_seen_at, filter };
}

export async function adminUnread(userId: string): Promise<number> {
  const db = createAdminClient();
  const s = await scope(db, userId);
  if (!s) return 0;
  let q = db.from("admin_events").select("id", { count: "exact", head: true }).gt("created_at", s.seenAt);
  if (s.filter) q = q.or(s.filter);
  return (await q).count ?? 0;
}

export async function adminEvents(userId: string, limit = 200): Promise<{ events: AdminEvent[]; seenAt: string | null }> {
  const db = createAdminClient();
  const s = await scope(db, userId);
  if (!s) return { events: [], seenAt: null };
  let q = db.from("admin_events").select("id, kind, title, link, created_at").order("created_at", { ascending: false }).limit(limit);
  if (s.filter) q = q.or(s.filter);
  return { events: ((await q).data ?? []) as AdminEvent[], seenAt: s.seenAt };
}

export async function markAdminEventsSeen(userId: string) {
  await createAdminClient().from("admins").update({ events_seen_at: new Date().toISOString() }).eq("user_id", userId);
}
