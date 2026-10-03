import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type Flow = "signup" | "recovery" | "email_change";

// Shared by /auth/confirm (sign-up), /auth/recover and /auth/email-change —
// every auth email lands on one of them. Two link styles arrive here:
//   * ?token_hash=…&type=… — our own templates (any browser, any device)
//   * ?code=…              — Supabase's default templates: the address is
//     already confirmed, and the code signs in only the browser that asked
// The route the link points at says which flow it is, because default
// links carry no type.
export async function handleAuthRedirect(request: NextRequest, flow: Flow) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") as EmailOtpType | null) ?? null;
  const code = url.searchParams.get("code");
  const go = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  const supabase = await createClient();
  if (tokenHash && type) {
    if ((await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error) {
      return go("/auth/confirmed?status=invalid");
    }
  } else if (code) {
    if ((await supabase.auth.exchangeCodeForSession(code)).error) {
      return go(flow === "signup" ? "/auth/confirmed?status=other_browser" : "/auth/confirmed?status=invalid");
    }
  } else {
    return go("/auth/confirmed?status=invalid");
  }

  const effective: Flow = type === "recovery" ? "recovery" : type === "email_change" ? "email_change" : flow;
  if (effective === "recovery") return go("/auth/reset-password");

  if (effective === "email_change") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // With secure email change both the old and the new address confirm;
    // profiles.email follows only once the change is complete.
    if (user?.new_email) return go("/auth/confirmed?status=email_pending");
    if (user?.email) await supabase.from("profiles").update({ email: user.email }).eq("id", user.id);
    return go("/auth/confirmed?status=email");
  }

  return go("/auth/confirmed");
}
