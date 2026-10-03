import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import ProfileSettings from "@/components/account/ProfileSettings";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  // The auth email is the real one; profiles.email follows once a change is confirmed.
  return <ProfileSettings profile={data as Profile} authEmail={user.email ?? ""} pendingEmail={user.new_email ?? null} />;
}
