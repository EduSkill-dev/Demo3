// Server-only: an account that came in through Google must finish its
// profile before it books, pays or leaves a request.
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { INCOMPLETE_ERROR, isExternalAccount, missingProfileFields, type ProfileFields } from "@/lib/profileComplete";

// The message to refuse with, or null when the account may go on.
export async function unfinishedProfileError(user: User): Promise<string | null> {
  if (!isExternalAccount(user)) return null;
  const { data } = await createAdminClient().from("profiles").select("role, first_name, last_name, birth_date, age, gender, phone").eq("id", user.id).maybeSingle();
  return missingProfileFields(data as ProfileFields | null).length > 0 ? INCOMPLETE_ERROR : null;
}
