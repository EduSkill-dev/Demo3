import { getT } from "@/i18n/server";
import { NewsletterForm, SuggestionForm } from "./FooterForms";
import FooterLinks from "./FooterLinks";

export default async function SiteFooter() {
  const t = await getT();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-pine-dark text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2">
          <NewsletterForm />
          <SuggestionForm />
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <FooterLinks />
        </div>

        <div className="mt-8 space-y-1 text-center text-sm text-white/70">
          <p>
            Made with{" "}
            <span aria-label="love" className="inline-block animate-heartbeat text-red-500 motion-reduce:animate-none">
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
