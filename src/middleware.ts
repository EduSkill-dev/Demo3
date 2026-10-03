import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie on every request (server components
// cannot write cookies themselves) and keeps each dashboard to its own role:
// /account is for individuals, /dashboard is for clubs.
export async function middleware(request: NextRequest) {
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
  if (!wantsAccount && !wantsDashboard) return response;

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
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role;

  if (wantsAccount && role !== "individual") return redirect(role === "club" ? "/dashboard" : "/");
  if (wantsDashboard && role !== "club") return redirect(role === "individual" ? "/account" : "/");

  return response;
}

export const config = {
  // Skip static assets and image optimisation; everything else gets a fresh session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
