import type { TFunction } from "@/i18n/translate";

// A legal page made of numbered sections kept in the dictionary
// (legal.<prefix>1Title / legal.<prefix>1Text, …), so each one can be edited
// in the admin text editor. In a text, a blank line starts a new paragraph
// and lines beginning with "- " form a list.
export default function LegalSections({ t, prefix, count }: { t: TFunction; prefix: "terms" | "privacy"; count: number }) {
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">{t("legal.updated")}</p>
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <section key={n}>
          <h2 className="font-serif text-xl font-semibold text-heading">
            {n}. {t(`legal.${prefix}${n}Title`)}
          </h2>
          <div className="mt-3 space-y-3 leading-relaxed text-ink">
            {t(`legal.${prefix}${n}Text`)
              .split(/\n\s*\n/)
              .map((block, b) => {
                const rows = block.split("\n").map((r) => r.trim()).filter(Boolean);
                return rows.length > 0 && rows.every((r) => r.startsWith("- ")) ? (
                  <ul key={b} className="list-disc space-y-1.5 pl-6">
                    {rows.map((r, k) => (
                      <li key={k}>{r.slice(2)}</li>
                    ))}
                  </ul>
                ) : (
                  <p key={b}>{rows.join(" ")}</p>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
