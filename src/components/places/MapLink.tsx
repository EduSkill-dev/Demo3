"use client";

import { useEffect, useState } from "react";

// A place's position, opened in the device's own maps: Apple Maps on
// iPhone, iPad and Mac; on Android a geo: link, which opens the phone's
// default maps app (or asks which one); elsewhere Google Maps in the browser.
// The server renders the Google link; the browser swaps it after loading.
export default function MapLink({ lat, lng, name, label }: { lat: number; lng: number; name: string; label: string }) {
  const at = `${lat},${lng}`;
  const google = `https://www.google.com/maps/search/?api=1&query=${at}`;
  const [href, setHref] = useState(google);
  const [app, setApp] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) {
      setHref(`geo:${at}?q=${at}(${encodeURIComponent(name)})`);
      setApp(true);
    } else if (/iPhone|iPad|iPod|Macintosh/i.test(ua)) {
      setHref(`https://maps.apple.com/?ll=${at}&q=${encodeURIComponent(name)}`);
    }
  }, [at, name]);

  return (
    <a
      href={href}
      {...(app ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      className="font-semibold text-terracotta-600 hover:underline dark:text-terracotta-300"
    >
      {label} ↗
      <span className="ml-2 font-normal text-muted">{lat.toFixed(4)}, {lng.toFixed(4)}</span>
    </a>
  );
}
