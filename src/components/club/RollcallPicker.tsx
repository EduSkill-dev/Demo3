"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import TelegramConnect from "./TelegramConnect";

export type TgPerson = { id: string; name: string; username: string | null; created_at: string };

// "Who marks attendance": the club's people connected to the bot, to tick for
// this hike, and a way to connect someone new. While it is open the list is
// re-read every few seconds, so a person who has just pressed Start appears
// (already ticked).
export default function RollcallPicker({ clubId, value, onChange }: { clubId: string; value: string[]; onChange: (ids: string[]) => void }) {
  const t = useT();
  const [people, setPeople] = useState<TgPerson[] | null>(null);
  const [adding, setAdding] = useState(false);
  const known = useRef<Set<string> | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const load = useCallback(async () => {
    const { data } = await createClient().from("club_tg_people").select("id, name, username, created_at").eq("club_id", clubId).order("created_at");
    const list = (data ?? []) as TgPerson[];
    setPeople(list);
    // Someone new connected while the form was open: tick them.
    if (known.current) {
      const fresh = list.filter((p) => !known.current!.has(p.id)).map((p) => p.id);
      if (fresh.length) {
        onChange([...valueRef.current, ...fresh]);
        setAdding(false);
      }
    } else if (list.length === 1 && valueRef.current.length === 0) {
      // The club's only person: nothing to choose.
      onChange([list[0].id]);
    }
    known.current = new Set(list.map((p) => p.id));
  }, [clubId, onChange]);

  useEffect(() => {
    load();
  }, [load]);
  // Watch for newcomers while connecting (or while nobody is connected yet).
  useEffect(() => {
    if (!adding && people?.length !== 0) return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [adding, people?.length, load]);

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="space-y-3">
      {people === null ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : people.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {people.map((p) => {
            const on = value.includes(p.id);
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full border-2 px-3.5 py-2 text-sm font-semibold transition ${
                  on ? "border-terracotta-500 bg-terracotta-500/10 text-ink" : "border-line bg-surface text-ink hover:border-spruce-500"
                }`}
              >
                <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="h-4 w-4 accent-terracotta-500" />
                <span>{p.name}</span>
                {p.username && <span className="text-xs font-normal text-muted">@{p.username}</span>}
              </label>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted">{t("rollcall.nobodyYet")}</p>
      )}

      {people !== null && (people.length === 0 || adding) ? (
        <div className="rounded-xl border border-dashed border-line bg-sand/40 p-4">
          <TelegramConnect />
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="text-sm font-semibold text-terracotta-700 hover:text-terracotta-500 dark:text-terracotta-300">
          + {t("rollcall.addPerson")}
        </button>
      )}
    </div>
  );
}
