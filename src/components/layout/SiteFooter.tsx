import { getT } from "@/i18n/server";
import { getViewer } from "@/lib/viewer";
import { NewsletterForm, SuggestionForm, type FooterViewer } from "./FooterForms";
import FooterLinks from "./FooterLinks";
import CulmenLogo from "@/components/CulmenLogo";

export default async function SiteFooter() {
  const t = await getT();
  const year = new Date().getFullYear();

  // A signed-in person (individual or club) gets the forms pre-filled with
  // their own, already verified contact details. Admins run the site; the
  // visitor forms are not for them.
  const who = await getViewer();
  const isAdmin = who?.role === "admin";
  const viewer: FooterViewer | null = who?.email && who.emailConfirmed ? { email: who.email, phone: who.phone } : null;

  return (
    <footer className="mt-auto bg-spruce-900 text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {!isAdmin && (
          <div className="mb-12 grid gap-10 border-b border-white/10 pb-12 md:grid-cols-2">
            <NewsletterForm key={`n-${viewer?.email ?? ""}`} viewer={viewer} />
            <SuggestionForm key={`s-${viewer?.email ?? ""}`} viewer={viewer} />
          </div>
        )}

        <div className="mb-8 flex justify-center">
          <CulmenLogo variant="dark" size={44} />
        </div>
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
