import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdmin } from "@/lib/admin";
import { ADMIN_PERMS } from "@/lib/adminLabels";
import AdminsManager, { type AdminRow } from "@/components/admin/AdminsManager";

// Super admin only: create admins and decide what each may manage.
export default async function AdminAdminsPage() {
  const me = await getAdmin();
  if (!me?.isSuper) redirect("/admin");

  const { data } = await createAdminClient()
    .from("admins")
    .select("user_id, perms, alt_email, must_change_password, created_at, profiles(email)")
    .eq("is_super", false)
    .order("created_at", { ascending: true });

  const rows: AdminRow[] = ((data ?? []) as unknown as {
    user_id: string;
    perms: string[];
    alt_email: string | null;
    must_change_password: boolean;
    created_at: string;
    profiles: { email: string } | null;
  }[]).map((a) => ({
    userId: a.user_id,
    email: a.profiles?.email ?? "",
    altEmail: a.alt_email,
    perms: ADMIN_PERMS.filter((k) => a.perms.includes(k)),
    mustChangePassword: a.must_change_password,
    createdAt: a.created_at,
  }));

  return <AdminsManager rows={rows} />;
}
