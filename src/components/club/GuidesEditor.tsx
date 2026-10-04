"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadImage, removeStored } from "@/lib/storage";
import { useT } from "@/i18n/client";
import type { ClubGuide } from "@/types/database";

const input =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-apricot focus:outline-none focus:ring-2 focus:ring-apricot/20";

type Draft = { id: string | null; name: string; role: string; bio: string; photo: string | null; file: File | null };
const empty: Draft = { id: null, name: "", role: "", bio: "", photo: null, file: null };
const ROLE_KEYS = ["clubData.roleGuide", "clubData.roleInstructor", "clubData.roleMountainGuide", "clubData.roleCoordinator"] as const;

// Guides: photo, name, position and a short bio each — add, edit, remove.
export default function GuidesEditor({ clubId, initial }: { clubId: string; initial: ClubGuide[] }) {
  const t = useT();
  const router = useRouter();
  const [guides, setGuides] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullName = (g: ClubGuide) => [g.first_name, g.last_name].filter(Boolean).join(" ");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !draft.name.trim()) return;
    setBusy(true);
    setError(null);

    let photo = draft.photo;
    if (draft.file) {
      const up = await uploadImage("guides", draft.file);
      if ("error" in up) {
        setBusy(false);
        return setError(t("clubData.uploadFailed", { message: up.error }));
      }
      photo = up.url;
    }
    const row = {
      club_id: clubId,
      first_name: draft.name.trim(),
      last_name: "",
      role: draft.role.trim() || null,
      bio: draft.bio.trim() || null,
      photo_url: photo,
    };
    const supabase = createClient();
    const res = draft.id
      ? await supabase.from("club_guides").update(row).eq("id", draft.id).select().single()
      : await supabase.from("club_guides").insert(row).select().single();
    setBusy(false);
    if (res.error) return setError(res.error.message);

    const saved = res.data as ClubGuide;
    const previous = guides.find((g) => g.id === saved.id);
    if (previous && previous.photo_url !== saved.photo_url) removeStored(previous.photo_url);
    setGuides((cur) => (previous ? cur.map((g) => (g.id === saved.id ? saved : g)) : [...cur, saved]));
    setDraft(null);
    router.refresh();
  }

  async function remove(g: ClubGuide) {
    if (!confirm(t("clubData.confirmRemoveGuide", { name: fullName(g) }))) return;
    const { error: err } = await createClient().from("club_guides").delete().eq("id", g.id);
    if (err) return setError(err.message);
    removeStored(g.photo_url);
    setGuides((cur) => cur.filter((x) => x.id !== g.id));
    router.refresh();
  }

  const preview = draft?.file ? URL.createObjectURL(draft.file) : draft?.photo;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold text-heading">{t("clubData.guides")}</h2>
        {!draft && (
          <button type="button" onClick={() => setDraft({ ...empty })} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-apricot">
            {t("clubData.addGuide")}
          </button>
        )}
      </div>

      {draft && (
        <form onSubmit={save} className="mt-4 grid max-w-2xl gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[6rem_1fr]">
          <label className="group relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-line bg-sand text-xs text-muted">
            {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : t("clubData.guidePhoto")}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => setDraft({ ...draft, file: e.target.files?.[0] ?? null })} />
          </label>
          <div className="space-y-3">
            <input required aria-label={t("clubData.guideName")} placeholder={t("clubData.guideName")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={input} />
            {/* Free text with suggestions: clubs name positions their own way. */}
            <input list="guide-roles" aria-label={t("clubData.guideRole")} placeholder={`${t("clubData.guideRole")} — ${t("clubData.guideRoleHint")}`} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} className={input} />
            <datalist id="guide-roles">
              {ROLE_KEYS.map((k) => (
                <option key={k} value={t(k)} />
              ))}
            </datalist>
            <textarea rows={3} aria-label={t("clubData.guideBio")} placeholder={t("clubData.guideBioHint")} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} className={input} />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="rounded-lg bg-apricot px-4 py-2 text-sm font-semibold text-white hover:bg-apricot-dark disabled:opacity-50">
                {busy ? "..." : t("clubData.saveGuide")}
              </button>
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink">
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {guides.length === 0 && !draft ? (
        <p className="mt-3 text-sm text-muted">{t("clubData.noGuides")}</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {guides.map((g) => (
            <li key={g.id} className="flex gap-3 rounded-xl border border-line bg-surface p-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-sand">
                {g.photo_url ? <img src={g.photo_url} alt={fullName(g)} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xl">🧭</div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{fullName(g)}</p>
                {g.role && <p className="text-xs font-semibold uppercase tracking-wide text-apricot">{g.role}</p>}
                {g.bio && <p className="mt-1 line-clamp-3 text-sm text-muted">{g.bio}</p>}
                <div className="mt-2 flex gap-3 text-sm font-semibold">
                  <button type="button" onClick={() => setDraft({ id: g.id, name: fullName(g), role: g.role ?? "", bio: g.bio ?? "", photo: g.photo_url, file: null })} className="text-apricot hover:text-apricot-dark">
                    {t("common.edit")}
                  </button>
                  <button type="button" onClick={() => remove(g)} className="text-red-600 hover:text-red-700">
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
