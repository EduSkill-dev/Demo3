"use client";

import { useEffect, useRef, useState } from "react";

// A small "i" beside a label: hovering shows the hint, a tap opens or closes it.
// Near a screen edge the hint opens towards the middle.
export default function InfoTip({ text, label = "i" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [side, setSide] = useState<"center" | "left" | "right">("center");
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const place = () => {
    const r = root.current?.getBoundingClientRect();
    if (!r) return;
    setSide(r.left < 140 ? "left" : window.innerWidth - r.right < 140 ? "right" : "center");
  };

  const shown = open || hover;
  const pos = side === "left" ? "left-0" : side === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span
      ref={root}
      className="relative inline-flex align-middle"
      onMouseEnter={() => {
        place();
        setHover(true);
      }}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          // Inside a label (a file picker) the tap must not open the picker.
          e.preventDefault();
          e.stopPropagation();
          place();
          setOpen((o) => !o);
        }}
        aria-expanded={shown}
        aria-label={text}
        className="ml-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-muted/60 font-serif text-[11px] font-bold italic leading-none text-muted transition hover:border-spruce-500 hover:text-spruce-500"
      >
        {label}
      </button>
      {shown && (
        <span role="tooltip" className={`absolute ${pos} top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] whitespace-normal rounded-xl border border-line bg-surface p-3 text-left text-xs font-normal leading-5 text-ink shadow-xl`}>
          {text}
        </span>
      )}
    </span>
  );
}
