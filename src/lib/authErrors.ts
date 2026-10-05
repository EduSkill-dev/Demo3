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
