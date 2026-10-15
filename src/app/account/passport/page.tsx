import { createClient } from "@/lib/supabase/server";
import { getPassport } from "@/lib/hikers";
import { getT } from "@/i18n/server";
import PassportView from "@/components/hikers/PassportView";
import PassportToggle from "@/components/account/PassportToggle";

// The individual's own hiker passport, and the switch that shows it on the
// public Hikers page.
export default async function AccountPassportPage() {
  const t = await getT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, passport, { count: hikes }] = await Promise.all([
    supabase.from("profiles").select("show_passport").eq("id", user.id).single(),
    getPassport(user.id, true),
    supabase
      .from("bookings")
      .select("id, tours!inner(date)", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .not("attended", "is", false)
      .lte("tours.date", new Date().toISOString().slice(0, 10)),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">{t("passport.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("passport.intro")}</p>
      </div>
      <PassportToggle userId={user.id} shown={!!(profile as { show_passport?: boolean } | null)?.show_passport} />
      <PassportView passport={passport} hikes={hikes ?? 0} t={t} />
    </div>
  );
}
