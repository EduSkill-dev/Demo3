"use client";

import { createClient } from "@/lib/supabase/client";

export const BUCKET = "club-assets";
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Storage policies only let people write under <folder>/<their user id>/…
export type UploadFolder = "clubs" | "guides" | "tours" | "avatars";

// crypto.randomUUID() exists only on https:// and localhost; opened over a
// plain-http network address (e.g. a phone on the same Wi-Fi) it is missing,
// so fall back to getRandomValues, which works everywhere.
function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function uploadImage(folder: UploadFolder, file: File): Promise<{ url: string } | { error: string }> {
  try {
    // The bucket enforces the same two rules; this answers before the upload.
    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) return { error: "JPG / PNG / WebP · max 5 MB" };
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { error: "not signed in" };
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${folder}/${auth.user.id}/${randomId()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
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
