"use client";

import { useState } from "react";

// A large photo in a frame of fixed height, with no empty bars:
//   * landscape — fills the whole frame (cropped a little if its shape differs);
//   * portrait  — shown whole at the frame's height, and the rounded edge
//     follows the photo itself instead of the frame.
export default function FramedPhoto({ src, alt, height = "h-64 sm:h-96" }: { src: string; alt: string; height?: string }) {
  // Remembered per photo, so switching back does not flicker.
  const [shapes, setShapes] = useState<Record<string, "landscape" | "portrait">>({});
  const shape = shapes[src];

  return (
    <div className={`flex justify-center ${height}`}>
      <img
        key={src}
        src={src}
        alt={alt}
        ref={(el) => {
          // Already loaded from the cache: onLoad will not fire again.
          if (el?.complete && el.naturalWidth && !shapes[src]) {
            setShapes((s) => ({ ...s, [src]: el.naturalWidth > el.naturalHeight ? "landscape" : "portrait" }));
          }
        }}
        onLoad={(e) => {
          const el = e.currentTarget;
          setShapes((s) => ({ ...s, [src]: el.naturalWidth > el.naturalHeight ? "landscape" : "portrait" }));
        }}
        className={`h-full rounded-xl ${
          shape === "landscape" ? "w-full object-cover" : "w-auto max-w-full object-contain"
        } ${shape ? "" : "opacity-0"}`}
      />
    </div>
  );
}
