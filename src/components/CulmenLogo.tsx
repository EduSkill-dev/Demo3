// The Culmen mark (sun, two-facet peak, hill) with an optional wordmark.
// Rules: never stretch, recolour, rotate or add shadows; minimum mark 24px,
// lockup 96px wide; keep clear space of about 38% of the mark's height.
type Variant = "light" | "dark" | "mono";

const COLORS: Record<Exclude<Variant, "mono">, { sun: string; left: string; right: string; hill: string }> = {
  light: { sun: "#F2B134", left: "#1E5B4F", right: "#C9491F", hill: "#4FA08D" }, // on Sand / white
  dark: { sun: "#F2B134", left: "#4FA08D", right: "#EE7F58", hill: "#F3EADA" }, // on Spruce
};

export default function CulmenLogo({
  variant,
  size = 40,
  showWordmark = true,
  wordmarkSize,
  gap,
}: {
  variant: Variant;
  size?: number; // height of the mark in px
  showWordmark?: boolean;
  wordmarkSize?: number; // default 0.64 × the mark's height
  gap?: number; // default 0.125 × the mark's height
}) {
  const c = variant === "mono" ? null : COLORS[variant];
  const filled = (color: string) => ({ fill: color, stroke: color, strokeWidth: 4, strokeLinejoin: "round" as const });

  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      {...(showWordmark ? { "aria-hidden": true } : { role: "img", "aria-label": "Culmen" })}
    >
      {c ? (
        <>
          <circle cx="66" cy="34" r="18" fill={c.sun} />
          <path d="M36 10 L6 84 L36 84 Z" {...filled(c.left)} />
          <path d="M36 10 L66 84 L36 84 Z" {...filled(c.right)} />
          <path d="M44 84 Q64 58 92 84 Z" {...filled(c.hill)} />
        </>
      ) : (
        <>
          <circle cx="66" cy="34" r="18" fill="currentColor" />
          <path d="M36 10 L6 84 L66 84 Z" fill="currentColor" stroke="#FFFDF8" strokeWidth="3" strokeLinejoin="round" />
          <path d="M36 10 L36 84" stroke="#FFFDF8" strokeWidth="2.5" />
          <path d="M44 84 Q64 58 92 84 Z" fill="currentColor" stroke="#FFFDF8" strokeWidth="3" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
  if (!showWordmark) return mark;

  return (
    <span className="inline-flex items-center" style={{ gap: gap ?? size * 0.125 }}>
      {mark}
      <span
        className="font-bold"
        style={{
          fontFamily: "var(--font-outfit), system-ui, sans-serif",
          fontSize: wordmarkSize ?? size * 0.64,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          color: variant === "dark" ? "#FFFDF8" : "#12332D",
        }}
      >
        Culmen
      </span>
    </span>
  );
}
