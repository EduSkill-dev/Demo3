// Shared shell for the text pages (terms, privacy, help).
export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold text-heading">{title}</h1>
      <div className="mt-6 space-y-4 leading-7 text-ink">{children}</div>
    </main>
  );
}
