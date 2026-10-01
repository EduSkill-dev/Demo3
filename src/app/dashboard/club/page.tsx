"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FOCUS_TAGS,
  parseFocusAreas,
  type ClubGuide,
} from "@/types/database";

const BUCKET = "club-assets";

export default function ClubDataPage() {
  const [clubId, setClubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // About / orientation
  const [description, setDescription] = useState("");
  const [focus, setFocus] = useState<string[]>([]);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Logo / cover photo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);
  const [logoMsg, setLogoMsg] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Guides
  const [guides, setGuides] = useState<ClubGuide[]>([]);
  const [addingGuide, setAddingGuide] = useState(false);
  const [gFirst, setGFirst] = useState("");
  const [gLast, setGLast] = useState("");
  const [gFile, setGFile] = useState<File | null>(null);
  const [savingGuide, setSavingGuide] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setLoading(false);

      const { data: club } = await supabase
        .from("clubs")
        .select("id, description, focus_areas, photo_url")
        .eq("owner_id", auth.user.id)
        .single();
      if (!club) return setLoading(false);

      setClubId(club.id);
      setDescription((club as any).description ?? "");
      setFocus(parseFocusAreas((club as any).focus_areas));
      setLogoUrl((club as any).photo_url ?? null);

      const { data: rows } = await supabase
        .from("club_guides")
        .select("*")
        .eq("club_id", club.id)
        .order("created_at", { ascending: true });
      setGuides((rows ?? []) as ClubGuide[]);
      setLoading(false);
    })();
  }, []);

  function toggleFocus(tag: string) {
    setFocus((cur) =>
      cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]
    );
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!clubId) return;
    setSavingInfo(true);
    setInfoMsg(null);
    setInfoError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("clubs")
      .update({
        description: description.trim() || null,
        focus_areas: focus.join(", ") || null,
      })
      .eq("id", clubId);
    setSavingInfo(false);
    if (error) setInfoError(error.message);
    else setInfoMsg("Պահպանվեց։");
  }

  function removeStored(url: string) {
    const marker = `/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const supabase = createClient();
    supabase.storage.from(BUCKET).remove([url.slice(idx + marker.length)]);
  }

  async function saveLogo(e: React.FormEvent) {
    e.preventDefault();
    if (!clubId || !logoFile) return;
    setLogoError(null);
    setLogoMsg(null);
    setSavingLogo(true);

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSavingLogo(false);
      return setLogoError("Նորից մուտք գործիր։");
    }

    const ext = (logoFile.name.split(".").pop() || "jpg").toLowerCase();
    const path = `clubs/${auth.user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, logoFile, { contentType: logoFile.type || "image/jpeg" });
    if (uploadError) {
      setSavingLogo(false);
      return setLogoError(`Նկարը բեռնվել չկարողացավ՝ ${uploadError.message}`);
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const url = pub?.publicUrl ?? null;

    const { error } = await supabase.from("clubs").update({ photo_url: url }).eq("id", clubId);
    setSavingLogo(false);
    if (error) return setLogoError(error.message);

    if (logoUrl) removeStored(logoUrl);
    setLogoUrl(url);
    setLogoFile(null);
    setLogoMsg("Ակումբի նկարը թարմացվեց։");
  }

  async function removeLogo() {
    if (!clubId || !logoUrl) return;
    if (!confirm("Հեռացնե՞լ ակումբի նկարը։")) return;
    const supabase = createClient();
    const { error } = await supabase.from("clubs").update({ photo_url: null }).eq("id", clubId);
    if (error) return setLogoError(error.message);
    removeStored(logoUrl);
    setLogoUrl(null);
    setLogoMsg("Նկարը հեռացվեց։");
  }

  async function addGuide(e: React.FormEvent) {
    e.preventDefault();
    if (!clubId) return;
    setGuideError(null);

    const first = gFirst.trim();
    const last = gLast.trim();
    if (!first || !last) return setGuideError("Լրացիր անունն ու ազգանունը։");

    setSavingGuide(true);
    const supabase = createClient();
    let photoUrl: string | null = null;

    if (gFile) {
      // RLS only lets owners write under guides/<their user id>/...
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setSavingGuide(false);
        return setGuideError("Մուտք գործիր նորից։");
      }
      const ext = (gFile.name.split(".").pop() || "jpg").toLowerCase();
      const path = `guides/${auth.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, gFile, { contentType: gFile.type || "image/jpeg" });
      if (uploadError) {
        setSavingGuide(false);
        return setGuideError(`Նկարը բեռնվել չկարողացավ՝ ${uploadError.message}`);
      }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      photoUrl = pub?.publicUrl ?? null;
    }

    const { data, error } = await supabase
      .from("club_guides")
      .insert({ club_id: clubId, first_name: first, last_name: last, photo_url: photoUrl })
      .select()
      .single();

    setSavingGuide(false);
    if (error) return setGuideError(error.message);

    setGuides((cur) => [...cur, data as ClubGuide]);
    setGFirst("");
    setGLast("");
    setGFile(null);
    setAddingGuide(false);
  }

  async function removeGuide(g: ClubGuide) {
    if (!confirm(`Հեռացնե՞լ ուղեկցողին՝ ${g.first_name} ${g.last_name}։`)) return;
    setBusyId(g.id);
    const supabase = createClient();
    const { error } = await supabase.from("club_guides").delete().eq("id", g.id);
    if (!error) {
      setGuides((cur) => cur.filter((x) => x.id !== g.id));
      if (g.photo_url) removeStored(g.photo_url);
    }
    setBusyId(null);
  }

  if (loading) return <p className="text-neutral-500">Բեռնվում է...</p>;
  if (!clubId)
    return <p className="text-neutral-500">Ակումբը չի գտնվել։ Մուտք գործիր նորից։</p>;

  const input = "w-full rounded-lg border border-neutral-300 p-3";

  return (
    <div className="max-w-2xl space-y-8">
      {/* Logo / cover photo */}
      <section className="rounded-2xl border border-sand bg-white p-5">
        <h2 className="font-serif text-lg font-semibold text-pine">Ակումբի նկար</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Երևում է «Ակումբներ» ցանկի քարտի վրա և ակումբի էջի գլխին։
        </p>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          {logoFile ? (
            <img src={URL.createObjectURL(logoFile)} alt="" className="h-24 w-24 rounded-xl object-cover" />
          ) : logoUrl ? (
            <img src={logoUrl} alt="" className="h-24 w-24 rounded-xl object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-sand text-3xl">
              🏔️
            </div>
          )}

          <form onSubmit={saveLogo} className="min-w-[220px] flex-1 space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setLogoFile(e.target.files?.[0] ?? null);
                setLogoMsg(null);
                setLogoError(null);
              }}
              className="w-full text-sm"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={savingLogo || !logoFile}
                className="rounded-lg bg-apricot px-4 py-2 text-sm font-semibold text-white hover:bg-apricot-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingLogo ? "Բեռնվում է..." : "Պահպանել նկարը"}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600 hover:border-red-300 hover:text-red-600"
                >
                  Հեռացնել
                </button>
              )}
            </div>
          </form>
        </div>

        {logoMsg && <p className="mt-3 text-sm text-green-700">{logoMsg}</p>}
        {logoError && <p className="mt-3 text-sm text-red-600">{logoError}</p>}
      </section>

      {/* About + orientation */}
      <form onSubmit={saveInfo} className="space-y-5 rounded-2xl border border-sand bg-white p-5">
        <div>
          <h2 className="font-serif text-lg font-semibold text-pine">Ակումբի մասին</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Ինչպես է ստեղծվել ակումբը, նրա պատմությունը՝ մեկ պարզ նկարագրությամբ։
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Օր.՝ Ակումբը հիմնադրվել է 2019 թվականին... "
            className={`mt-3 ${input}`}
          />
        </div>

        <div>
          <h3 className="font-semibold text-pine">Ի՞նչ ուղղվածություն ունեք</h3>
          <p className="mt-1 text-sm text-neutral-500">
            Նշիր, թե ինչ տեսակի արշավներ եք կազմակերպում։
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {FOCUS_TAGS.map((tag) => (
              <label
                key={tag}
                className="flex items-center gap-2 rounded-lg border border-neutral-200 p-2 text-sm hover:bg-stone"
              >
                <input
                  type="checkbox"
                  checked={focus.includes(tag)}
                  onChange={() => toggleFocus(tag)}
                />
                {tag}
              </label>
            ))}
          </div>
        </div>

        {infoError && <p className="text-sm text-red-600">{infoError}</p>}
        {infoMsg && <p className="text-sm text-green-700">{infoMsg}</p>}

        <button
          type="submit"
          disabled={savingInfo}
          className="rounded-lg bg-apricot px-5 py-3 font-semibold text-white hover:bg-apricot-dark disabled:opacity-50"
        >
          {savingInfo ? "Պահպանվում է..." : "Պահպանել"}
        </button>
      </form>

      {/* Guides */}
      <section className="rounded-2xl border border-sand bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-semibold text-pine">Ուղեկցողներ</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Այս ցանկը երևում է ակումբի էջում։ Հավաքված՝ {guides.length} ուղեկցող։
            </p>
          </div>
          {!addingGuide && (
            <button
              onClick={() => {
                setGuideError(null);
                setAddingGuide(true);
              }}
              className="rounded-lg bg-apricot px-4 py-2 text-sm font-semibold text-white hover:bg-apricot-dark"
            >
              + Ավելացնել ուղեկցող
            </button>
          )}
        </div>

        {addingGuide && (
          <form onSubmit={addGuide} className="mt-4 space-y-3 rounded-xl border border-apricot/40 bg-apricot/5 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Անուն</label>
                <input
                  required
                  value={gFirst}
                  onChange={(e) => setGFirst(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Ազգանուն</label>
                <input
                  required
                  value={gLast}
                  onChange={(e) => setGLast(e.target.value)}
                  className={input}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Նկար</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setGFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />
              {gFile && (
                <img
                  src={URL.createObjectURL(gFile)}
                  alt="Նախադիտում"
                  className="mt-2 h-20 w-20 rounded-lg object-cover"
                />
              )}
            </div>

            {guideError && <p className="text-sm text-red-600">{guideError}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={savingGuide}
                className="rounded-lg bg-apricot px-4 py-2 text-sm font-semibold text-white hover:bg-apricot-dark disabled:opacity-50"
              >
                {savingGuide ? "Բեռնվում է..." : "Պահպանել ուղեկցողին"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingGuide(false);
                  setGFirst("");
                  setGLast("");
                  setGFile(null);
                  setGuideError(null);
                }}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600"
              >
                Չեղարկել
              </button>
            </div>
          </form>
        )}

        {guides.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">
            Դեռ ուղեկցող չկա։ Ավելացրու նվազագույնը մեկին, որպեսզի մարդիկ տեսնեն՝ ով է ուղեկցում։
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-sand">
            {guides.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  {g.photo_url ? (
                    <img
                      src={g.photo_url}
                      alt={`${g.first_name} ${g.last_name}`}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sand text-xl">
                      🙂
                    </div>
                  )}
                  <p className="font-medium text-neutral-800">
                    {g.first_name} {g.last_name}
                  </p>
                </div>
                <button
                  onClick={() => removeGuide(g)}
                  disabled={busyId === g.id}
                  title="Հեռացնել ուղեկցողին"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-lg text-neutral-500 hover:border-red-400 hover:text-red-600 disabled:opacity-50"
                >
                  −
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
