// Server-only helpers of the admin area. Never import from a "use client" file.
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_PERMS, type AdminPerm } from "@/lib/adminLabels";

export type AdminSession = {
  userId: string;
  email: string;
  isSuper: boolean;
  perms: AdminPerm[]; // what a regular admin was allowed; a super admin may do everything
  mustChangePassword: boolean;
};

// The signed-in admin, or null. Every admin page and /api/admin starts here.
export async function getAdmin(): Promise<AdminSession | null> {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: row }, { data: profile }] = await Promise.all([
    admin.from("admins").select("is_super, perms, must_change_password").eq("user_id", user.id).maybeSingle(),
    admin.from("profiles").select("role, status").eq("id", user.id).maybeSingle(),
  ]);
  const a = row as { is_super: boolean; perms: string[]; must_change_password: boolean } | null;
  const p = profile as { role: string; status: string } | null;
  if (!a || p?.role !== "admin" || p.status !== "active") return null;

  return {
    userId: user.id,
    email: user.email ?? "",
    isSuper: a.is_super,
    perms: ADMIN_PERMS.filter((k) => a.perms.includes(k)),
    mustChangePassword: a.must_change_password,
  };
}

export const can = (admin: AdminSession, perm: AdminPerm) => admin.isSuper || admin.perms.includes(perm);

// The caller's address as the proxy reports it (Vercel sets x-forwarded-for).
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || null;
}

// One activity_log entry. Failures are swallowed: a log line never breaks
// the action it describes.
export async function logActivity(entry: {
  actor: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await createAdminClient().rpc("log_activity", {
      p_actor: entry.actor,
      p_action: entry.action,
      p_target_type: entry.targetType ?? null,
      p_target_id: entry.targetId ?? null,
      p_target_label: entry.targetLabel ?? null,
      p_meta: entry.meta ?? {},
      p_ip: entry.ip ?? null,
    });
  } catch {
    // ignore
  }
}

// One-time passwords handed to new admins: 14 characters, no look-alikes.
export function oneTimePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(14), (b) => alphabet[b % alphabet.length]).join("");
}

// Frozen and blocked accounts may not act. Returns the message to answer
// with, or null when the account is fine. The database guards direct writes
// with the same sentence (see serverErrors.ts).
export async function inactiveAccountError(userId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("profiles").select("status").eq("id", userId).maybeSingle();
  return (data as { status?: string } | null)?.status === "active"
    ? null
    : "Ձեր հաշիվը սառեցված է․ գործողությունները ժամանակավորապես անհասանելի են։";
}

// Sign-ups an admin switched off (for the person, the club or the listing).
// The database refuses them too; asking first keeps a paid sign-up from
// being charged and then refused.
export async function bookingRefusedByAdmin(userId: string, tourId: string): Promise<string | null> {
  const db = createAdminClient();
  const [{ data: profile }, { data: tour }] = await Promise.all([
    db.from("profiles").select("booking_blocked").eq("id", userId).maybeSingle(),
    db.from("tours").select("admin_hidden, clubs(applications_blocked)").eq("id", tourId).maybeSingle(),
  ]);
  if ((profile as { booking_blocked?: boolean } | null)?.booking_blocked) {
    return "Արշավներին գրանցվելու հնարավորությունն անջատված է ադմինիստրատորի կողմից։";
  }
  const t = tour as unknown as { admin_hidden: boolean; clubs: { applications_blocked: boolean } | null } | null;
  if (t?.admin_hidden) return "Այս արշավին գրանցումը փակ է։";
  if (t?.clubs?.applications_blocked) return "Այս ակումբի արշավներին գրանցումը ժամանակավորապես փակ է։";
  return null;
}
