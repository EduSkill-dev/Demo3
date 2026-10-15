import { COMPLETE_PATH, isExternalAccount, missingProfileFields, type ProfileFields } from "@/lib/profileComplete";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie on every request (server components
// cannot write cookies themselves) and keeps each dashboard to its own role:
// /account is for individuals, /dashboard is for clubs, /admin is for admins.
export async function middleware(request: NextRequest) {
  // One address for the site: www.… goes to the bare domain (a sign-in
  // cookie belongs to one host, so two addresses would mean two sessions).
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    const url = request.nextUrl.clone();
    url.host = host.slice(4);
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  // Crawlers follow the calendar's month and day links without end (years
  // back and ahead, every filter). A date more than a year from today is
  // refused here, before any page is built.
  if (outsideDateWindow(request)) {
    return new NextResponse("Not found", { status: 404, headers: { "x-robots-tag": "noindex" } });
  }

  // An auth email whose redirect target was not allowed falls back to the
  // site root; send its token on to the route that verifies it.
  const { pathname: requestedPath, searchParams } = request.nextUrl;
  if (searchParams.has("token_hash") && searchParams.has("type") && !requestedPath.startsWith("/auth/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/confirm";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const wantsAccount = path === "/account" || path.startsWith("/account/");
  const wantsDashboard = path === "/dashboard" || path.startsWith("/dashboard/");
  const wantsAdmin = path === "/admin" || path.startsWith("/admin/");
  if (!wantsAccount && !wantsDashboard && !wantsAdmin) return response;

  const redirect = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = to === "/login" ? `?next=${encodeURIComponent(path)}` : "";
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user) return redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, first_name, last_name, birth_date, age, gender, phone")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role;

  // Blocked while signed in: the session ends here, not at the next refresh.
  if ((profile as { status?: string } | null)?.status === "blocked") {
    await supabase.auth.signOut({ scope: "local" });
    return redirect("/login");
  }

  // Came in through Google and has not added the rest yet: one page only.
  if (wantsAccount && path !== COMPLETE_PATH && isExternalAccount(user) && missingProfileFields(profile as ProfileFields | null).length > 0) {
    return redirect(COMPLETE_PATH);
  }

  const home = role === "individual" ? "/account" : role === "club" ? "/dashboard" : role === "admin" ? "/admin" : "/";
  const allowed = wantsAccount ? "individual" : wantsDashboard ? "club" : "admin";
  if (role !== allowed) return redirect(home);

  return response;
}

export const config = {
  // Skip static assets and image optimisation; everything else gets a fresh session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

// The Tours page and the calendar take dates in the address (month, day,
// from, to); only a year back to a year ahead is served.
const DATED_PAGES = new Set(["/calendar", "/tours"]);
function outsideDateWindow(request: NextRequest): boolean {
  const { pathname, searchParams } = request.nextUrl;
  if (!DATED_PAGES.has(pathname)) return false;
  const now = new Date();
  const monthIndex = (y: number, m: number) => y * 12 + m;
  const current = monthIndex(now.getUTCFullYear(), now.getUTCMonth() + 1);
  for (const key of ["month", "day", "from", "to"]) {
    const value = searchParams.get(key);
    const m = value?.match(/^(\d{4})-(\d{2})/);
    if (m && Math.abs(monthIndex(+m[1], +m[2]) - current) > 12) return true;
  }
  return false;
}
