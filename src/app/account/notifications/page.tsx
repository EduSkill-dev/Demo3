import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NotificationsTable, { type NotificationRow } from "@/components/account/NotificationsTable";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("notifications")
    .select("id, kind, sender_type, message, read, created_at, clubs(id, name), tours(id, title, date)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  return <NotificationsTable rows={(data ?? []) as unknown as NotificationRow[]} />;
}
