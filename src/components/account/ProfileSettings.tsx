"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadImage, removeStored } from "@/lib/storage";
import { MIN_PASSWORD, authErrorMessage, confirmUrl } from "@/lib/authErrors";
import { useT } from "@/i18n/client";
import type { Profile } from "@/types/database";

const input =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-muted focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/30";
const label = "mb-1 block text-sm font-medium text-ink";
const card = "rounded-xl border border-line bg-surface p-5";
const h2 = "font-serif text-lg font-semibold text-heading";

type Note = { ok: boolean; text: string } | null;
const NoteLine = ({ note }: { note: Note }) =>
  note ? <p className={`text-sm ${note.ok ? "text-green-700" : "text-red-600"}`}>{note.text}</p> : null;

export default function ProfileSettings({
  profile,
  authEmail,
  pendingEmail,
}: {
  profile: Profile;
  authEmail: string;
  pendingEmail: string | null;
}) {
  const t = useT();
  const router = useRouter();

  const [photo, setPhoto] = useState(profile.photo_url);
  const [first, setFirst] = useState(profile.first_name ?? "");
  const [last, setLast] = useState(profile.last_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [askDelete, setAskDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const note = (key: string, n: Note) => setNotes((cur) => ({ ...cur, [key]: n }));

  async function changePhoto(file: File | null) {
    setBusy("photo");
    note("photo", null);
    let url: string | null = null;
    if (file) {
      const up = await uploadImage("avatars", file);
      if ("error" in up) {
        setBusy(null);
        return note("photo", { ok: false, text: t("clubData.uploadFailed", { message: up.error }) });
      }
      url = up.url;
    }
    const { error } = await createClient().from("profiles").update({ photo_url: url }).eq("id", profile.id);
    setBusy(null);
    if (error) return note("photo", { ok: false, text: error.message });
    removeStored(photo);
    setPhoto(url);
    router.refresh();
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy("profile");
    const { error } = await createClient()
      .from("profiles")
      .update({ first_name: first.trim(), last_name: last.trim(), phone: phone.trim() || null })
      .eq("id", profile.id);
    setBusy(null);
    note("profile", error ? { ok: false, text: error.message } : { ok: true, text: t("account.saved") });
    if (!error) router.refresh();
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    // Supabase emails both addresses; nothing changes until they are confirmed.
    const { error } = await createClient().auth.updateUser(
      { email: newEmail.trim() },
      { emailRedirectTo: confirmUrl("email_change") }
    );
    setBusy(null);
    if (error) return note("email", { ok: false, text: authErrorMessage(t, error) });
    note("email", { ok: true, text: t("account.emailSent", { email: newEmail.trim() }) });
    setNewEmail("");
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return note("password", { ok: false, text: t("auth.weakPassword") });
    if (password !== repeat) return note("password", { ok: false, text: t("auth.passwordsDiffer") });
    setBusy("password");
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(null);
    if (error) return note("password", { ok: false, text: authErrorMessage(t, error) });
    note("password", { ok: true, text: t("account.passwordChanged") });
    setPassword("");
    setRepeat("");
  }

  async function deleteAccount() {
    setBusy("delete");
    const res = await fetch("/api/delete-account", { method: "POST" });
    if (!res.ok) {
      setBusy(null);
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return note("delete", { ok: false, text: data.error ?? t("common.error") });
    }
    await createClient().auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section className={card}>
        <div className="flex flex-wrap items-center gap-5">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-sand">
            {photo ? (
              <img src={photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted">
                {(first || authEmail).slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-spruce-500">
              {busy === "photo" ? "..." : t("account.changePhoto")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={busy === "photo"}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) changePhoto(f);
                }}
              />
            </label>
            {photo && (
              <button type="button" onClick={() => changePhoto(null)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
                {t("account.removePhoto")}
              </button>
            )}
          </div>
        </div>
        <div className="mt-2"><NoteLine note={notes.photo ?? null} /></div>
      </section>

      <form onSubmit={saveProfile} className={`${card} space-y-4`}>
        <h2 className={h2}>{t("account.personal")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="first" className={label}>{t("auth.firstName")}</label>
            <input id="first" required maxLength={60} value={first} onChange={(e) => setFirst(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="last" className={label}>{t("auth.lastName")}</label>
            <input id="last" required maxLength={60} value={last} onChange={(e) => setLast(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="phone" className={label}>{t("auth.phone")}</label>
            <input id="phone" type="tel" placeholder="+374 XX XXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
          </div>
          {profile.birth_date && (
            <div>
              <span className={label}>{t("auth.birthDate")}</span>
              <p className="px-1 py-2.5 text-ink">{profile.birth_date}</p>
            </div>
          )}
        </div>
        <NoteLine note={notes.profile ?? null} />
        <button type="submit" disabled={busy === "profile"} className="rounded-full bg-spruce-500 px-5 py-2.5 font-semibold text-white hover:bg-spruce-900 disabled:opacity-50">
          {busy === "profile" ? "..." : t("account.saveProfile")}
        </button>
      </form>

      <form onSubmit={changeEmail} className={`${card} space-y-4`}>
        <h2 className={h2}>{t("account.emailSection")}</h2>
        <p className="text-sm text-muted">{t("account.currentEmail", { email: authEmail })}</p>
        {pendingEmail && <p className="text-sm text-terracotta-700">{t("auth.emailPendingText")} ({pendingEmail})</p>}
        <div>
          <label htmlFor="newEmail" className={label}>{t("account.newEmail")}</label>
          <input id="newEmail" type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={input} />
        </div>
        <NoteLine note={notes.email ?? null} />
        <button type="submit" disabled={busy === "email"} className="rounded-lg border border-line px-5 py-2.5 font-semibold text-ink hover:border-spruce-500 disabled:opacity-50">
          {busy === "email" ? "..." : t("account.changeEmail")}
        </button>
      </form>

      <form onSubmit={changePassword} className={`${card} space-y-4`}>
        <h2 className={h2}>{t("account.passwordSection")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pw" className={label}>{t("auth.newPassword")}</label>
            <input id="pw" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="pw2" className={label}>{t("auth.passwordRepeat")}</label>
            <input id="pw2" type="password" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={input} />
          </div>
        </div>
        <NoteLine note={notes.password ?? null} />
        <button type="submit" disabled={busy === "password"} className="rounded-lg border border-line px-5 py-2.5 font-semibold text-ink hover:border-spruce-500 disabled:opacity-50">
          {busy === "password" ? "..." : t("account.changePassword")}
        </button>
      </form>

      <section className="rounded-xl border border-red-300 bg-red-50/60 p-5 dark:border-red-900 dark:bg-red-950/20">
        <h2 className="font-serif text-lg font-semibold text-red-700 dark:text-red-300">{t("account.dangerSection")}</h2>
        <p className="mt-2 text-sm text-ink">{t("account.deleteText")}</p>
        {askDelete ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-red-700 dark:text-red-300">{t("account.deleteConfirm")}</span>
            <button type="button" onClick={deleteAccount} disabled={busy === "delete"} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {busy === "delete" ? "..." : t("account.deleteYes")}
            </button>
            <button type="button" onClick={() => setAskDelete(false)} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink">
              {t("common.cancel")}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setAskDelete(true)} className="mt-4 rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-950/40">
            {t("account.deleteButton")}
          </button>
        )}
        <div className="mt-2"><NoteLine note={notes.delete ?? null} /></div>
      </section>
    </div>
  );
}
