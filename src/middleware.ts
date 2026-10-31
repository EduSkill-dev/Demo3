import { COMPLETE_PATH, isExternalAccount, missingProfileFields, type ProfileFields } from "@/lib/profileComplete";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const IDLE_COOKIE = "idle_seen";
// Without activity a session ends after 15 minutes for admins and after
// 2 hours for individuals and clubs (Gor, 2026-10-20).
const IDLE_ADMIN_MS = 15 * 60_000;
const IDLE_MS = 2 * 60 * 60_000;

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

  // Scanners probe for files the site does not have (/phpinfo.php, /.env,
  // /gcp-key.json…) and send other methods to pages. Each such request used
  // to build the whole "not found" page and ran into the CPU limit of the
  // free Workers plan; it is answered here, before anything is built.
  const refused = refuseProbe(request);
  if (refused) return refused;

  // Crawlers follow the calendar's month and day links without end (years
  // back and ahead, every filter). A date more than a year from today is
  // refused here, before any page is built ("gone", so crawlers drop it).
  if (outsideDateWindow(request)) {
    return new NextResponse("Gone", { status: 410, headers: { "x-robots-tag": "noindex" } });
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

  // A session without activity ends (IDLE_ADMIN_MS / IDLE_MS): idle_seen
  // holds the time of the last request (refreshed at most once a minute; an
  // open page pings while it is being used, see IdleLogout). A tab closed and
  // opened again later is signed out here. The role is looked up only after
  // a gap longer than the admins' limit.
  if (user) {
    const seen = Number(request.cookies.get(IDLE_COOKIE)?.value ?? 0);
    const now = Date.now();
    // A sign-in after that time is a new session, not an idle one.
    const signedInAfter = !!user.last_sign_in_at && new Date(user.last_sign_in_at).getTime() > seen;
    const gap = now - seen;
    let idle = false;
    if (seen && !signedInAfter && gap > IDLE_ADMIN_MS) {
      if (gap > IDLE_MS) idle = true;
      else {
        const { data: who } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        idle = (who as { role?: string } | null)?.role === "admin";
      }
    }
    if (idle) {
      await supabase.auth.signOut({ scope: "local" });
      const out = path.startsWith("/api/")
        ? response
        : (() => {
            const url = request.nextUrl.clone();
            url.pathname = "/login";
            url.search = `?idle=1&next=${encodeURIComponent(path)}`;
            const res = NextResponse.redirect(url);
            response.cookies.getAll().forEach((c) => res.cookies.set(c));
            return res;
          })();
      out.cookies.delete(IDLE_COOKIE);
      return out;
    }
    if (!seen || now - seen > 60_000) {
      response.cookies.set(IDLE_COOKIE, String(now), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
    }
  }
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
  // Old calendar links (level=, night=) are no longer made by the site; only
  // crawlers still hold them.
  if (pathname === "/calendar" && (searchParams.has("level") || searchParams.has("night"))) return true;
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

// The first part of every address the site serves (pages, routes, files).
const KNOWN_ROOTS = new Set([
  "", "about", "account", "admin", "api", "auth", "bookings", "calendar", "calendar.ics", "clubs", "contact", "dashboard", "faq",
  "help", "hikers", "login", "newsletter", "places", "pricing", "privacy", "receipts", "register", "requests", "terms", "tours",
  "robots.txt", "sitemap.xml", "icon.svg", ".well-known", "_next", "brand", "images", "favicon.ico",
]);
// File kinds the site never serves, anywhere.
const PROBE_FILE = /\.(php\d?|phtml|asp|aspx|jsp|cgi|pl|env|ini|sql|sqlite|db|bak|old|orig|swp|log|ya?ml|toml|config|conf|git|svn|htaccess|htpasswd|ds_store|pem|key)$/i;

const NOT_FOUND_HTML = '<!doctype html><html lang="hy"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Էջը չի գտնվել · Culmen</title><body style="font-family:system-ui,sans-serif;background:#faf6ee;color:#12332d;display:grid;place-items:center;min-height:90vh;margin:0;text-align:center"><div><h1 style="font-size:1.5rem">Էջը չի գտնվել</h1><p><a href="/" style="color:#c9491f">Culmen-ի գլխավոր էջ</a></p></div></body></html>';

function refuseProbe(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === "development") return null; // the dev server has its own /__nextjs… routes
  const path = request.nextUrl.pathname;
  const root = path.split("/")[1] ?? "";
  const isApi = root === "api" || root === "auth" || root === "calendar.ics";
  // Pages are only read; forms and buttons talk to /api.
  if (!isApi && request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  const segments = path.split("/").filter(Boolean);
  const hidden = segments.some((s) => s.startsWith(".") && s !== ".well-known");
  if (!KNOWN_ROOTS.has(root) || hidden || PROBE_FILE.test(path)) {
    return new NextResponse(NOT_FOUND_HTML, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", "cache-control": "public, max-age=3600" } });
  }
  return null;
}
