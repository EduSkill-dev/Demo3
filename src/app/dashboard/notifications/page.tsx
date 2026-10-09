// The club notifications: platform notices and answers to its offers.
// (Applications to its hikes live in their own section.)
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewsToggle from "@/components/NewsToggle";
import NotificationsTable, { type NotificationRow } from "@/components/account/NotificationsTable";

export default async function ClubNotificationsPage() {
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

  const { data: profile } = await supabase.from("profiles").select("platform_news").eq("id", user.id).single();
  return (
    <div className="space-y-4">
      <NewsToggle userId={user.id} newsOn={(profile as { platform_news?: boolean } | null)?.platform_news !== false} />
      <NotificationsTable rows={(data ?? []) as unknown as NotificationRow[]} />
    </div>
  );
}
