import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY. Never import this from a "use client" file or expose
// SUPABASE_SERVICE_ROLE_KEY with a NEXT_PUBLIC_ prefix — it bypasses RLS.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
