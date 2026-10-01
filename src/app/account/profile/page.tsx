"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setLoading(false);
      const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).single();
      setProfile(data as Profile);
      setLoading(false);
    })();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    setSavedMsg(null);
    const supabase = createClient();

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
        photo_url: profile.photo_url,
      })
      .eq("id", profile.id);
    if (profileError) return setError(profileError.message);

    // Keep auth and the profile row in sync: the profile copy is what the
    // club sees in its applicant list.
    if (profile.email) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user?.email !== profile.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: profile.email });
        if (emailError) return setError(emailError.message);
      }
      const { error: emailSync } = await supabase
        .from("profiles")
        .update({ email: profile.email })
        .eq("id", profile.id);
      if (emailSync) return setError(emailSync.message);
    }

    setSavedMsg("Պահպանվեց։ Եթե փոխել ես email-ը, հաստատման նամակ կստանաս նոր հասցեին։");
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordMsg(error ? error.message : "Գաղտնաբառը փոխվեց։");
    if (!error) setNewPassword("");
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch("/api/delete-account", { method: "POST" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setDeleting(false);
      alert("Չստացվեց հաշիվը ջնջել, փորձիր նորից։");
    }
  }

  if (loading) return <p className="text-neutral-500">Բեռնվում է...</p>;
  if (!profile) return <p className="text-neutral-500">Հաշիվը չի գտնվել։</p>;

  const input = "w-full rounded-lg border border-neutral-300 p-3";

  return (
    <div className="max-w-md space-y-10">
      <form onSubmit={handleSave} className="space-y-4">
        <h2 className="font-serif text-lg font-semibold text-pine">Անձնական տվյալներ</h2>

        <div className="flex items-center gap-4">
          {profile.photo_url ? (
            <img src={profile.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sand text-2xl">🙂</div>
          )}
          <input
            placeholder="Նկարի URL (վերբեռնումը կավելացվի ավելի ուշ)"
            value={profile.photo_url ?? ""}
            onChange={(e) => setProfile({ ...profile, photo_url: e.target.value })}
            className={input}
          />
        </div>

        <input
          placeholder="Անուն"
          value={profile.first_name ?? ""}
          onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
          className={input}
        />
        <input
          placeholder="Ազգանուն"
          value={profile.last_name ?? ""}
          onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
          className={input}
        />
        <input
          type="email"
          placeholder="Էլ. հասցե"
          value={profile.email ?? ""}
          onChange={(e) => setProfile({ ...profile, email: e.target.value })}
          className={input}
        />
        <input
          placeholder="Հեռախոս"
          value={profile.phone ?? ""}
          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          className={input}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {savedMsg && <p className="text-sm text-green-700">{savedMsg}</p>}
        <button type="submit" className="rounded-lg bg-apricot px-5 py-3 font-semibold text-white">
          Պահպանել
        </button>
      </form>

      <form onSubmit={handlePasswordChange} className="space-y-3 border-t border-sand pt-8">
        <h2 className="font-serif text-lg font-semibold text-pine">Փոխել գաղտնաբառը</h2>
        <input
          required
          type="password"
          minLength={6}
          placeholder="Նոր գաղտնաբառ"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={input}
        />
        {passwordMsg && <p className="text-sm text-neutral-600">{passwordMsg}</p>}
        <button type="submit" className="rounded-lg border border-neutral-300 px-5 py-3 font-semibold">
          Փոխել
        </button>
      </form>

      <div className="space-y-3 border-t border-sand pt-8">
        <h2 className="font-serif text-lg font-semibold text-red-700">Ջնջել հաշիվը</h2>
        <p className="text-sm text-neutral-500">Այս գործողությունը անդառնալի է։</p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg border border-red-300 px-5 py-3 font-semibold text-red-700"
          >
            Ջնջել հաշիվը
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {deleting ? "Ջնջվում է..." : "Այո, վերջնականապես ջնջել"}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-neutral-300 px-5 py-3">
              Չեղարկել
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
