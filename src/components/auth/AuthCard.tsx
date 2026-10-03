// The narrow centred card every auth page sits in.
export default function AuthCard({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main className={`mx-auto px-4 py-12 sm:py-16 ${wide ? "max-w-xl" : "max-w-md"}`}>
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <h1 className="font-serif text-2xl font-semibold text-heading">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

export const authInput =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-apricot focus:outline-none focus:ring-2 focus:ring-apricot/20";
export const authLabel = "mb-1 block text-sm font-medium text-ink";
export const authButton =
  "w-full rounded-lg bg-apricot py-3 font-semibold text-white transition hover:bg-apricot-dark disabled:cursor-not-allowed disabled:opacity-60";
