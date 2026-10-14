"use client";

import { useRef, useState } from "react";
import { useT } from "@/i18n/client";

// A hike card's photos. Nothing moves by itself: the viewer swipes (phones)
// or uses the arrows that show on hover (mouse); thin lines under the photo
// show how many there are and which one is in view. A tap on a photo opens
// the hike, like before.
export default function CardPhotos({
  photos,
  title,
  className,
  onOpen,
}: {
  photos: string[];
  title: string;
  className: string; // the height
  onOpen: () => void;
}) {
  const t = useT();
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  if (photos.length <= 1) {
    return (
      <button data-view type="button" onClick={onOpen} className="block w-full" aria-label={title}>
        {photos[0] ? (
          <img src={photos[0]} alt="" className={`${className} w-full object-cover`} />
        ) : (
          <div className={`${className} flex items-center justify-center bg-gradient-to-br from-spruce-500 to-spruce-300 text-4xl`}>🏔️</div>
        )}
      </button>
    );
  }

  const go = (i: number) => {
    const el = strip.current;
    if (!el) return;
    const next = Math.max(0, Math.min(photos.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = strip.current;
    if (el && el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const arrow =
    "absolute top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-lg leading-none text-white opacity-0 transition hover:bg-black/65 group-hover/photos:opacity-100 [@media(hover:hover)]:flex";

  return (
    <div className="group/photos relative">
      <div ref={strip} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
        {photos.map((src, i) => (
          <button key={src + i} data-view type="button" onClick={onOpen} className="w-full shrink-0 snap-center" aria-label={title}>
            <img src={src} alt="" loading={i === 0 ? undefined : "lazy"} draggable={false} className={`${className} w-full object-cover`} />
          </button>
        ))}
      </div>

      {index > 0 && (
        <button data-view type="button" onClick={() => go(index - 1)} aria-label={t("tour.prevPhoto")} className={`${arrow} left-2`}>
          ‹
        </button>
      )}
      {index < photos.length - 1 && (
        <button data-view type="button" onClick={() => go(index + 1)} aria-label={t("tour.nextPhoto")} className={`${arrow} right-2`}>
          ›
        </button>
      )}

      {/* Thin lines: one per photo, the one in view brighter. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-10">
        <div className="pointer-events-auto flex w-full max-w-[9rem] gap-1">
          {photos.map((_, i) => (
            <button
              key={i}
              data-view
              type="button"
              onClick={() => go(i)}
              aria-label={t("tour.photoOf", { n: i + 1, count: photos.length })}
              aria-current={i === index ? "true" : undefined}
              className="flex h-3 flex-1 items-center"
            >
              <span className={`block h-[3px] w-full rounded-full shadow-[0_0_2px_rgba(0,0,0,0.5)] transition ${i === index ? "bg-white" : "bg-white/45"}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
