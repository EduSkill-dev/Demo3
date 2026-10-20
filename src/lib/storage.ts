"use client";

import { createClient } from "@/lib/supabase/client";

export const BUCKET = "club-assets";
// What may be picked. Whatever comes in is redrawn in the browser to the
// site's own size and format before it is stored (see prepareImage), so the
// bucket only ever receives WebP or JPEG.
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
export const MAX_SOURCE_BYTES = 30 * 1024 * 1024; // a phone photo, before it is made smaller
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // the bucket's own limit, after

// Storage policies only let people write under <folder>/<their user id>/…
export type UploadFolder = "clubs" | "guides" | "tours" | "avatars" | "places" | "certificates";

// The longest side each kind of picture is stored at. Larger pictures are
// scaled down, smaller ones are left as they are (never enlarged).
//   tours   the gallery and cards, shown up to ~1200 px wide on big screens
//   places  a place's page and card (admins), the same
//   clubs   a logo or cover, shown small
//   guides, avatars   round portraits
//   certificates   a club's document, shown whole: large enough to read
const MAX_SIDE: Record<UploadFolder, number> = { tours: 1600, places: 1600, clubs: 800, guides: 600, avatars: 400, certificates: 2400 };
const QUALITY = 0.82;

// crypto.randomUUID() exists only on https:// and localhost; opened over a
// plain-http network address (e.g. a phone on the same Wi-Fi) it is missing,
// so fall back to getRandomValues, which works everywhere.
function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

const toBlob = (canvas: HTMLCanvasElement, type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));

// Decodes the picture (turned the way the camera held it), scales it to the
// folder's size and re-encodes it as WebP — JPEG where the browser cannot
// write WebP. Returns null when this browser cannot read the file at all
// (a HEIC photo opened outside Safari).
async function prepareImage(file: File, maxSide: number): Promise<{ blob: Blob; ext: "webp" | "jpg" } | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const webp = await toBlob(canvas, "image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpeg = await toBlob(canvas, "image/jpeg");
  return jpeg ? { blob: jpeg, ext: "jpg" } : null;
}

const isHeic = (file: File) => /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);

export async function uploadImage(folder: UploadFolder, file: File): Promise<{ url: string } | { error: string }> {
  try {
    if (file.size > MAX_SOURCE_BYTES) return { error: "max 30 MB" };
    const ready = await prepareImage(file, MAX_SIDE[folder]);
    if (!ready) {
      return { error: isHeic(file) ? "HEIC: այս բրաուզերը չի կարողանում բացել այս նկարը։ Ընտրեք JPG կամ PNG, կամ բեռնեք iPhone-ից / Safari-ով։" : "JPG / PNG / WebP / HEIC" };
    }
    if (ready.blob.size > MAX_IMAGE_BYTES) return { error: "max 5 MB" };

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { error: "not signed in" };
    const path = `${folder}/${auth.user.id}/${randomId()}.${ready.ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, ready.blob, { contentType: ready.blob.type, cacheControl: "31536000" });
    if (error) return { error: error.message };
    return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Best-effort removal of a file we stored earlier (by its public URL).
export function removeStored(url: string | null | undefined) {
  if (!url) return;
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  createClient().storage.from(BUCKET).remove([url.slice(idx + marker.length)]);
}
