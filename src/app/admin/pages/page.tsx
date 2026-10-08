import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getAdmin } from "@/lib/admin";
import { TEXT_SECTIONS } from "@/lib/adminLabels";
import { DICTIONARIES } from "@/i18n/translate";
import { LOCALES, isLocale, type Locale } from "@/i18n/config";
import TextEditor, { type TextEntry } from "@/components/admin/TextEditor";

const LANGUAGE_NAMES: Record<Locale, string> = { hy: "Հայերեն", ru: "Русский", en: "English" };

// "home" → [["home.heroTitle", "…"], …], however deep the section goes.
function flatten(node: unknown, prefix: string, out: [string, string][] = []): [string, string][] {
  if (typeof node === "string") out.push([prefix, node]);
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) flatten(v, `${prefix}.${k}`, out);
  }
  return out;
}

// Every text of the site, section by section and language by language.
export default async function AdminPagesPage({ searchParams }: { searchParams: { section?: string; lang?: string } }) {
  const me = await getAdmin();
  if (!me || !can(me, "pages")) redirect("/admin");

  const hy = DICTIONARIES.hy as Record<string, unknown>;
  const named = TEXT_SECTIONS.flatMap((g) => g.sections.map(([key]) => key));
  const unnamed = Object.keys(hy).filter((k) => !named.includes(k));
  const groups = [
    ...TEXT_SECTIONS,
    ...(unnamed.length ? [{ title: "Այլ", sections: unnamed.map((k) => [k, k] as [string, string]) }] : []),
  ];

  const section = searchParams.section && searchParams.section in hy ? searchParams.section : "home";
  const lang: Locale = isLocale(searchParams.lang) ? searchParams.lang : "hy";

  // Armenian defines which texts exist; another language may miss some and
  // then shows the Armenian one, exactly as the site does.
  const own = new Map(flatten((DICTIONARIES[lang] as Record<string, unknown>)[section], section));
  const { data } = await createAdminClient().from("site_texts").select("key, value").eq("locale", lang).like("key", `${section}.%`);
  const saved = new Map(((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  const entries: TextEntry[] = flatten(hy[section], section).map(([key, fallback]) => ({
    key,
    original: own.get(key) ?? fallback,
    value: saved.get(key) ?? null,
  }));

  const href = (s: string, l: string) => `/admin/pages?section=${s}&lang=${l}`;
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium ${
      active ? "bg-spruce-500 text-white" : "border border-line bg-surface text-ink hover:border-spruce-500"
    }`;
  const title = groups.flatMap((g) => g.sections).find(([k]) => k === section)?.[1] ?? section;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{g.title}</p>
            <div className="flex flex-wrap gap-2">
              {g.sections.map(([key, label]) => (
                <Link key={key} href={href(key, lang)} className={chip(key === section)}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <h2 className="font-serif text-xl font-semibold text-heading">
          {title} <span className="text-sm font-normal text-muted">· {entries.length} տեքստ</span>
        </h2>
        <div className="flex gap-2">
          {LOCALES.map((l) => (
            <Link key={l} href={href(section, l)} className={chip(l === lang)}>
              {LANGUAGE_NAMES[l]}
            </Link>
          ))}
        </div>
      </div>

      <TextEditor key={`${section}-${lang}`} locale={lang} entries={entries} />
    </div>
  );
}
