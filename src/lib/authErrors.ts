import type { AuthError } from "@supabase/supabase-js";
import type { TFunction } from "@/i18n/translate";

// Supabase Auth errors come back in English; map the ones people actually
// hit to friendly, translated text.
export function authErrorMessage(t: TFunction, error: Pick<AuthError, "message"> & { code?: string; status?: number }): string {
  switch (error.code) {
    case "invalid_credentials":
      return t("auth.invalidLogin");
    case "user_banned":
      return t("auth.blocked");
    case "email_not_confirmed":
      return t("auth.notConfirmed");
    case "user_already_exists":
    case "email_exists":
      return t("auth.emailTaken");
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return t("auth.tooManyEmails");
    case "weak_password":
      return t("auth.weakPassword");
  }
  if (error.status === 429) return t("auth.tooManyEmails");
  return error.message || t("common.error");
}

export const MIN_PASSWORD = 8;

// Where auth emails send people back to (must be allowed in Supabase).
// One route per flow, because Supabase's default links carry no type.
export function confirmUrl(flow: "signup" | "recovery" | "email_change" = "signup"): string {
  const path = flow === "recovery" ? "/auth/recover" : flow === "email_change" ? "/auth/email-change" : "/auth/confirm";
  return `${window.location.origin}${path}`;
}

// Asks the server whether the phone number (and, for a club, its name) is
// already registered. Returns the message to show, or null when both are free.
export async function signupConflict(t: TFunction, input: { phone: string; clubName?: string }): Promise<string | null> {
  const res = await fetch("/api/auth/check-signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => null);
  const data = res?.ok ? ((await res.json().catch(() => ({}))) as { phoneTaken?: boolean; nameTaken?: boolean }) : {};
  if (data.nameTaken) return t("auth.clubNameTaken");
  if (data.phoneTaken) return t("auth.phoneTaken");
  return null;
}
