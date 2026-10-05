import { getT } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { NewsletterForm, SuggestionForm, type FooterViewer } from "./FooterForms";
import FooterLinks from "./FooterLinks";

export default async function SiteFooter() {
  const t = await getT();
  const year = new Date().getFullYear();

  // A signed-in person (individual or club) gets the forms pre-filled with
  // their own, already verified contact details.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let viewer: FooterViewer | null = null;
  let isAdmin = false; // admins run the site; the visitor forms are not for them
  if (user?.email && user.email_confirmed_at) {
    const [{ data: profile }, { data: club }] = await Promise.all([
      supabase.from("profiles").select("phone, role").eq("id", user.id).maybeSingle(),
      supabase.from("clubs").select("phone").eq("owner_id", user.id).maybeSingle(),
    ]);
    const phone = (club as { phone?: string | null } | null)?.phone || (profile as { phone?: string | null } | null)?.phone;
    viewer = { email: user.email, phone: phone || null };
    isAdmin = (profile as { role?: string } | null)?.role === "admin";
  }

  return (
    <footer className="mt-auto bg-pine-dark text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {!isAdmin && (
          <div className="mb-12 grid gap-10 border-b border-white/10 pb-12 md:grid-cols-2">
            <NewsletterForm key={`n-${viewer?.email ?? ""}`} viewer={viewer} />
            <SuggestionForm key={`s-${viewer?.email ?? ""}`} viewer={viewer} />
          </div>
        )}

        <FooterLinks />

        <div className="mt-8 space-y-1 text-center text-sm text-white/70">
          <p>
            Made with{" "}
            <span aria-label="love" className="inline-block animate-heartbeat align-middle text-[17px] leading-none text-red-500 motion-reduce:animate-none">
              ❤
            </span>{" "}
            by Gor Gasparyan
          </p>
          <p>{t("footer.rights", { year })}</p>
        </div>
      </div>
    </footer>
  );
}
