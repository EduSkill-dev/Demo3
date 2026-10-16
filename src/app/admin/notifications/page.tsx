import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import { adminEvents } from "@/lib/adminEvents";
import AdminEventsList from "@/components/admin/AdminEventsList";

// Everything the bell counted, newest first. Opening the page clears the bell.
export default async function AdminNotificationsPage() {
  const me = await getAdmin();
  if (!me) redirect("/login?next=/admin/notifications");
  const { events, seenAt } = await adminEvents(me.userId);
  return <AdminEventsList events={events} seenAt={seenAt} />;
}
