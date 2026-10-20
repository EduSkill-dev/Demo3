import type { Place } from "@/lib/places";
import type { TFunction as T } from "@/i18n/translate";
import { metres } from "@/components/places/PlaceCard";
import MapLink from "@/components/places/MapLink";

const icon = "h-4 w-4 shrink-0 text-spruce-500 dark:text-spruce-300";
const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

// "~1 h 40 min" from minutes.
function drive(t: T, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h && m ? t("placesPage.driveHM", { h, m }) : h ? t("placesPage.driveH", { h }) : t("placesPage.driveM", { m });
}

// The practical facts on a place's page, each shown only when an admin
// filled it: relative height, the road from Yerevan, mobile signal, the map
// (coordinates, opened in the device's maps app).
export default function PlaceFacts({ place, t }: { place: Place; t: T }) {
  const signal = { yes: t("placesPage.signalYes"), partial: t("placesPage.signalPartial"), no: t("placesPage.signalNo") };
  const road = [
    place.distanceKm !== null ? t("placesPage.fromYerevan", { km: place.distanceKm }) : null,
    place.driveMinutes !== null ? drive(t, place.driveMinutes) : null,
  ].filter(Boolean);
  if (place.relativeHeight === null && road.length === 0 && !place.signal && !place.coords) return null;

  return (
    <ul className="mt-3 space-y-1.5 text-sm text-ink">
      {place.relativeHeight !== null && (
        <li className="flex items-center gap-2">
          <svg {...svg} className={icon}><path d="M3 20h18L14 7l-3 5-2-3-6 11z" /></svg>
          {t("placesPage.relativeHeight", { n: metres(place.relativeHeight) })}
        </li>
      )}
      {road.length > 0 && (
        <li className="flex items-center gap-2">
          <svg {...svg} className={icon}><path d="M5 17h14v-5l-2-5H7l-2 5v5zM5 12h14M7.5 17v2M16.5 17v2" /><circle cx="8" cy="14.5" r=".5" /><circle cx="16" cy="14.5" r=".5" /></svg>
          {road.join(" · ")}
        </li>
      )}
      {place.signal && (
        <li className="flex items-center gap-2">
          <svg {...svg} className={icon}><path d="M4 20v-3M9 20v-6M14 20v-9M19 20V5" /></svg>
          {t("placesPage.signal", { v: signal[place.signal] })}
        </li>
      )}
      {place.coords && (
        <li className="flex items-center gap-2">
          <svg {...svg} className={icon}><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></svg>
          <MapLink lat={place.coords.lat} lng={place.coords.lng} name={place.name} label={t("placesPage.openMap")} />
        </li>
      )}
    </ul>
  );
}
