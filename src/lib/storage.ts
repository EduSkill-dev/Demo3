"use client";

import { createClient } from "@/lib/supabase/client";

export const BUCKET = "club-assets";

// Storage policies only let people write under <folder>/<their user id>/…
export type UploadFolder = "clubs" | "guides" | "tours" | "avatars";

export async function uploadImage(folder: UploadFolder, file: File): Promise<{ url: string } | { error: string }> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "not signed in" };
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${folder}/${auth.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || "image/jpeg" });
  if (error) return { error: error.message };
  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

// Best-effort removal of a file we stored earlier (by its public URL).
export function removeStored(url: string | null | undefined) {
  if (!url) return;
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  createClient().storage.from(BUCKET).remove([url.slice(idx + marker.length)]);
}
