// Server-only: who is looking at the page. React's cache() makes this one
// session check and one profile read per request, however many components
// (layout, header, footer, pages) ask.
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  email: string;
  emailConfirmed: boolean;
  role: "individual" | "club" | "admin";
  frozen: boolean; // signed in, but may only look
  platformNews: boolean; // receives platform news (digest, updates)
  firstName: string | null;
  phone: string | null; // the club's phone for a club, else the person's
  club: { id: string; name: string } | null;
};

// A blocked account counts as signed out everywhere.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: club }] = await Promise.all([
    supabase.from("profiles").select("role, status, first_name, phone, platform_news").eq("id", user.id).maybeSingle(),
    supabase.from("clubs").select("id, name, phone").eq("owner_id", user.id).maybeSingle(),
  ]);
  const p = profile as { role: Viewer["role"]; status: string; first_name: string | null; phone: string | null; platform_news: boolean } | null;
  if (!p || p.status === "blocked") return null;
  const c = club as { id: string; name: string; phone: string | null } | null;

  return {
    id: user.id,
    email: user.email ?? "",
    emailConfirmed: !!user.email_confirmed_at,
    role: p.role,
    frozen: p.status !== "active",
    platformNews: p.platform_news,
    firstName: p.first_name,
    phone: c?.phone || p.phone || null,
    club: c ? { id: c.id, name: c.name } : null,
  };
});
