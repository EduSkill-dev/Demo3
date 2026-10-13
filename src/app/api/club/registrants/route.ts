import { withErrorReport } from "@/lib/errors";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";

type Row = {
  seq: number;
  status: "confirmed" | "cancelled";
  created_at: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  attended: boolean | null;
  source: string | null;
  tours: { title: string; date: string } | null;
  profiles: { first_name: string | null; last_name: string | null; birth_date: string | null; age: number | null; gender: string | null; email: string; phone: string | null } | null;
};

function age(birth: string | null, legacy: number | null): string {
  if (!birth) return legacy == null ? "" : String(legacy);
  const b = new Date(birth);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) years--;
  return String(years);
}

// A cell that starts like a formula would be run by a spreadsheet: a leading
// space keeps it plain text (phone numbers start with "+").
function cell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = " " + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// The club's own sign-ups as a CSV file — only with the plan's
// registrants_csv_export. Reads run under the club's session (RLS), so a
// club can never export somebody else's hikes.
//   ?tour=<id>  one hike; without it, all of the club's hikes.
async function handleGET(req: Request) {
  const mine = await getMyClub();
  if (!mine) return NextResponse.json({ error: "Մուտք գործեք որպես ակումբ։" }, { status: 401 });
  const { config } = mine.limits;
  if (!config.dashboard_registrants_list || !config.registrants_csv_export) {
    return NextResponse.json({ error: "CSV արտահանումը Ձեր փաթեթում ներառված չէ։" }, { status: 403 });
  }

  const supabase = await createClient();
  const tourId = new URL(req.url).searchParams.get("tour");
  let tours = supabase.from("tours").select("id").eq("club_id", mine.club.id);
  if (tourId) tours = tours.eq("id", tourId);
  const ids = (((await tours).data ?? []) as { id: string }[]).map((x) => x.id);

  const { data } = ids.length
    ? await supabase
        .from("bookings")
        .select("seq, status, created_at, emergency_contact_name, emergency_contact_phone, attended, source, tours(title, date), profiles(first_name, last_name, birth_date, age, gender, email, phone)")
        .in("tour_id", ids)
        .order("created_at", { ascending: true })
    : { data: [] };
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) => (a.tours?.date ?? "").localeCompare(b.tours?.date ?? "") || a.seq - b.seq);

  const header = ["Արշավ", "Ամսաթիվ", "Հայտի համար", "Անուն", "Ազգանուն", "Հեռախոս", "Էլ. հասցե", "Տարիք", "Սեռ", "Կարգավիճակ", "Գրանցվել է", "Արտակարգ կոնտակտ", "Արտակարգ կոնտակտի հեռախոս", "Ներկայություն", "Որտեղից է եկել"];
  const lines = rows.map((r) =>
    [
      r.tours?.title,
      r.tours?.date,
      r.seq,
      r.profiles?.first_name ?? (r.profiles ? "" : "Ջնջված օգտատեր"),
      r.profiles?.last_name,
      r.profiles?.phone,
      r.profiles?.email,
      r.profiles ? age(r.profiles.birth_date, r.profiles.age) : "",
      r.profiles?.gender === "female" ? "Իգական" : r.profiles?.gender === "male" ? "Արական" : "",
      r.status === "confirmed" ? "Հաստատված" : "Չեղարկված",
      r.created_at.slice(0, 16).replace("T", " "),
      r.emergency_contact_name,
      r.emergency_contact_phone,
      r.attended === true ? "Եկավ" : r.attended === false ? "Չեկավ" : "",
      r.source ?? "Culmen",
    ]
      .map(cell)
      .join(",")
  );
  // The BOM makes Excel read the file as UTF-8 (Armenian letters).
  const body = "﻿" + [header.map(cell).join(","), ...lines].join("\r\n") + "\r\n";
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="culmen-registrants-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

// A crash or a 5xx answer here is logged and the admins are told.
export const GET = withErrorReport("club", handleGET);
