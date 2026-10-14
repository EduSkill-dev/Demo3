import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, logActivity } from "@/lib/admin";
import { COMPLETE_PATH, missingProfileFields, type ProfileFields } from "@/lib/profileComplete";

// Where Google (through Supabase) sends a person back after they agreed to
// sign in. The one-time code becomes a session; then:
//   * a blocked account is signed out again;
//   * an individual with missing details goes to finish the profile first;
//   * everyone else goes where they were heading, or to their own area.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const wanted = url.searchParams.get("next");
  const next = wanted && wanted.startsWith("/") && !wanted.startsWith("//") ? wanted : null;
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  if (!code) return to("/login?error=oauth");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return to("/login?error=oauth");

  const { data: row } = await createAdminClient()
    .from("profiles")
    .select("role, status, first_name, last_name, birth_date, age, gender, phone")
    .eq("id", data.user.id)
    .maybeSingle();
  const profile = row as (ProfileFields & { status?: string }) | null;

  if (profile?.status === "blocked") {
    await supabase.auth.signOut({ scope: "local" });
    return to("/login?error=blocked");
  }
  await logActivity({ actor: data.user.id, action: "auth.login", meta: { via: "google" }, ip: clientIp(request) });

  // Registering a club with Google: the fresh account goes on to the club form.
  if (next?.startsWith("/register/club/") && profile?.role === "individual" && missingProfileFields(profile).length > 0) return to(next);
  if (profile?.role === "club" && next?.startsWith("/register/club/")) return to("/dashboard");

  if (missingProfileFields(profile).length > 0) {
    return to(`${COMPLETE_PATH}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  const home = profile?.role === "club" ? "/dashboard" : profile?.role === "admin" ? "/admin" : "/account";
  return to(profile?.role === "admin" ? home : next ?? home);
}
