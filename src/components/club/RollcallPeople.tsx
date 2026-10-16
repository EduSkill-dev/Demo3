"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import TelegramConnect from "./TelegramConnect";
import type { TgPerson } from "./RollcallPicker";

// "Club data" → the people connected to the roll-call bot: who they are,
// removing one, and the club's link (with a way to replace it).
export default function RollcallPeople({ clubId }: { clubId: string }) {
  const t = useT();
  const [people, setPeople] = useState<TgPerson[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await createClient().from("club_tg_people").select("id, name, username, created_at").eq("club_id", clubId).order("created_at");
    setPeople((data ?? []) as TgPerson[]);
  }, [clubId]);
  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  async function remove(p: TgPerson) {
    if (!window.confirm(t("rollcall.removeConfirm", { name: p.name }))) return;
    setPeople((list) => (list ?? []).filter((x) => x.id !== p.id));
    await createClient().from("club_tg_people").delete().eq("id", p.id);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-xl font-semibold text-heading">{t("rollcall.title")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t("rollcall.about")}</p>
      </div>
      {people && people.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 truncate font-semibold text-ink">
                {p.name}
                {p.username && <span className="ml-2 font-normal text-muted">@{p.username}</span>}
              </span>
              <button type="button" onClick={() => remove(p)} className="shrink-0 font-semibold text-red-600 hover:text-red-700">{t("common.delete")}</button>
            </li>
          ))}
        </ul>
      )}
      <div className="rounded-xl border border-line bg-surface p-4">
        <TelegramConnect allowNew />
      </div>
    </section>
  );
}
