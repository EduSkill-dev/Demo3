import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getAdmin } from "@/lib/admin";
import MessagesBoard, { type SuggestionItem, type SupportThread } from "@/components/admin/MessagesBoard";

// Everything people write to the platform, in one place: help chats on one
// side, suggestions on the other. Answers can be written here or in the
// Telegram groups; both show here (the page refreshes itself).
export default async function AdminMessagesPage({ searchParams }: { searchParams: { s?: string; u?: string } }) {
  const me = await getAdmin();
  if (!me) redirect("/login?next=/admin/messages");
  if (!can(me, "messages")) redirect("/admin");

  const db = createAdminClient();
  const [{ data: chat }, { data: notes }] = await Promise.all([
    db.from("support_messages").select("id, user_id, from_admin, admin_name, body, via, created_at").order("id", { ascending: true }).limit(3000),
    db
      .from("contact_messages")
      .select("id, message, email, phone, created_at, contact_replies(id, author, admin_name, body, via, sender, created_at)")
      .not("confirmed_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  // Help chats, one per person, the newest conversation first.
  const rows = (chat ?? []) as { id: number; user_id: string; from_admin: boolean; admin_name: string | null; body: string; via: string; created_at: string }[];
  const byUser = new Map<string, typeof rows>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  const ids = [...byUser.keys()];
  const [{ data: people }, { data: clubs }] = ids.length
    ? await Promise.all([
        db.from("profiles").select("id, role, first_name, last_name, email").in("id", ids),
        db.from("clubs").select("owner_id, name").in("owner_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const person = new Map(((people ?? []) as { id: string; role: string; first_name: string | null; last_name: string | null; email: string }[]).map((p) => [p.id, p]));
  const clubOf = new Map(((clubs ?? []) as { owner_id: string; name: string }[]).map((c) => [c.owner_id, c.name]));
  const threads: SupportThread[] = ids
    .map((userId) => {
      const list = byUser.get(userId)!;
      const p = person.get(userId);
      const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
      const club = clubOf.get(userId);
      return {
        userId,
        who: club ? `«${club}»${name ? ` · ${name}` : ""}` : name || "—",
        kind: club ? ("club" as const) : ("individual" as const),
        email: p?.email ?? "",
        messages: list.map((m) => ({ id: String(m.id), fromAdmin: m.from_admin, adminName: m.admin_name, body: m.body, at: m.created_at, via: m.via })),
        waiting: !list[list.length - 1].from_admin,
        lastAt: list[list.length - 1].created_at,
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  const suggestions: SuggestionItem[] = ((notes ?? []) as {
    id: string; message: string; email: string | null; phone: string | null; created_at: string;
    contact_replies: { id: number; author: string; admin_name: string | null; body: string; via: string; sender: string | null; created_at: string }[];
  }[]).map((n) => ({
    id: n.id,
    message: n.message,
    email: n.email,
    phone: n.phone,
    at: n.created_at,
    replies: [...n.contact_replies].sort((a, b) => a.id - b.id).map((r) => ({ id: String(r.id), fromAdmin: r.author === "admin", adminName: r.author === "admin" ? r.admin_name : r.sender, body: r.body, at: r.created_at, via: r.via })),
  }));

  return (
    <div>
      <h2 className="font-serif text-xl font-semibold text-heading">Հաղորդագրություններ</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Օգնության չաթը և առաջարկները։ Պատասխանել կարելի է այստեղից կամ Telegram-ի խմբերից (Reply)․ երկու տեղում էլ երևում է, թե ով և երբ է պատասխանել։
        Չաթի պատասխանը հայտնվում է մարդու չաթում, առաջարկինը՝ գնում է նամակով։
      </p>
      <MessagesBoard threads={threads} suggestions={suggestions} openThread={searchParams.u ?? null} openSuggestion={searchParams.s ?? null} />
    </div>
  );
}
