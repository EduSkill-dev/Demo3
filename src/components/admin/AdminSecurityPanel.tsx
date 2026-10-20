"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import PasswordInput from "@/components/ui/PasswordInput";
import { MIN_PASSWORD } from "@/lib/authErrors";
import { adminAction, adminButton, adminDanger, adminGhost, adminInput } from "./adminApi";

const SECURITY = "/api/admin/security";
const call = <T = Record<string, unknown>,>(body: { action: string } & Record<string, unknown>) => adminAction<T>(body, SECURITY);

type Row = { id: string; label: string | null; created: string; used: string | null };
export type SecurityProps = {
  keys: Row[];
  devices: (Row & { current: boolean })[];
  codesLeft: number;
  other: string | null; // the address whose password needs the stricter rule
};

const box = "rounded-xl border border-line bg-surface p-4 sm:p-5";
const h3 = "font-serif text-lg font-semibold text-heading";

const MAX_KEYS = 2;

// An admin's protection: security keys (at most two), recovery codes,
// trusted devices, and — for the super admin — the other address's password
// (key + that address's email, within 10 minutes; SMS later). Keys show as
// connected; removing one is behind "Manage" and needs a touch of a key.
export default function AdminSecurityPanel({ keys, devices, codesLeft, other }: SecurityProps) {
  const router = useRouter();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState(keys.length ? "YubiKey 2" : "YubiKey");
  const [managing, setManaging] = useState(false);

  async function removeKey(k: Row) {
    if (!window.confirm(`Ջնջե՞լ «${k.label ?? "Բանալի"}» բանալին։`)) return;
    setBusy(true);
    setError(null);
    const start = await call<{ options: Parameters<typeof startAuthentication>[0]["optionsJSON"] | null }>({ action: "remove.options" });
    if (start.error !== null) return setBusy(false), setError(start.error);
    let response = null;
    if (start.data.options) {
      try {
        response = await startAuthentication({ optionsJSON: start.data.options });
      } catch {
        setBusy(false);
        return setError("Բանալին չհաստատվեց։ Ջնջելու համար հպեք Ձեր բանալիներից մեկին։");
      }
    }
    const res = await call({ action: "key.remove", id: k.id, response });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setManaging(false);
    router.refresh();
  }

  async function addKey() {
    setBusy(true);
    setError(null);
    const start = await call<{ options: Parameters<typeof startRegistration>[0]["optionsJSON"] }>({ action: "register.options" });
    if (start.error !== null) return setBusy(false), setError(start.error);
    let response;
    try {
      response = await startRegistration({ optionsJSON: start.data.options });
    } catch {
      setBusy(false);
      return setError("Բանալին չգրանցվեց (չեղարկվեց, ժամանակը սպառվեց, կամ այս բանալին արդեն գրանցված է)։");
    }
    const done = await call<{ codes: string[] | null }>({ action: "register.verify", response, label });
    setBusy(false);
    if (done.error !== null) return setError(done.error);
    if (done.data.codes) setCodes(done.data.codes);
    setLabel("YubiKey 2");
    router.refresh();
  }

  async function act(body: { action: string } & Record<string, unknown>, question?: string) {
    if (question && !window.confirm(question)) return;
    setBusy(true);
    setError(null);
    const res = await call<{ codes?: string[] }>(body);
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    if (res.data.codes) setCodes(res.data.codes);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      {codes && <CodesShown codes={codes} onClose={() => setCodes(null)} />}

      <section className={box}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={h3}>Անվտանգության բանալիներ</h3>
          {keys.length > 0 && (
            <span className="flex items-center gap-3">
              <span className="rounded-full bg-spruce-500/10 px-2.5 py-0.5 text-xs font-semibold text-spruce-700 dark:text-spruce-300">
                ✓ Միացված է {keys.length} / {MAX_KEYS}
              </span>
              <button type="button" onClick={() => setManaging((v) => !v)} className="text-xs font-semibold text-muted hover:text-ink">
                {managing ? "Պատրաստ է" : "Կառավարել"}
              </button>
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">Նոր սարքից մուտք գործելիս վահանակը բացվում է միայն բանալիով հաստատելուց հետո։ Կարելի է գրանցել մինչև {MAX_KEYS} բանալի (երկրորդը՝ պահեստային)։</p>
        {keys.length > 0 ? (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-ink">🔑 {k.label ?? "Բանալի"}</span>
                  <span className="block text-xs text-muted">Ավելացվել է {k.created}{k.used ? ` · վերջին անգամ՝ ${k.used}` : ""}</span>
                </span>
                {managing ? (
                  <button type="button" disabled={busy} onClick={() => removeKey(k)} className={adminDanger}>
                    Ջնջել
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-spruce-700 dark:text-spruce-300">✓ Միացված</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-lg bg-sand/50 p-3 text-sm text-ink">Բանալի դեռ գրանցված չէ։ Գրանցելուց հետո կստանաք 10 մեկանգամյա կոդ։ Պահեք դրանք թղթի վրա, ոչ էլ. փոստում։</p>
        )}
        {managing && (
          <p className="mt-2 text-xs text-muted">Ջնջելու համար կպահանջվի հպում Ձեր բանալիներից մեկին (եթե երկուսն էլ կորել են՝ մտեք մեկանգամյա կոդով և ջնջեք 30 րոպեի ընթացքում)։</p>
        )}
        {keys.length < MAX_KEYS && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-[10rem] flex-1 text-sm">
            <span className="mb-1 block text-muted">Անուն (որ տարբերեք)</span>
            <input value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} className={adminInput} />
          </label>
          <button type="button" disabled={busy} onClick={addKey} className={adminButton}>
            {busy ? "…" : keys.length ? "Ավելացնել երկրորդ բանալին" : "Գրանցել բանալին"}
          </button>
        </div>
        )}
        {keys.length === 1 && <p className="mt-2 text-xs text-muted">Խորհուրդ՝ գրանցեք նաև պահեստային երկրորդ բանալի։</p>}
      </section>

      {keys.length > 0 && (
        <section className={box}>
          <h3 className={h3}>Մեկանգամյա կոդեր</h3>
          <p className="mt-1 text-sm text-muted">
            Մնացել է <b className="text-ink">{codesLeft}</b> / 10։ Կոդով կարելի է մտնել ցանկացած հասցեով միշտ՝ նույնիսկ եթե գաղտնաբառերը փոխված են, հասցեն փակված է, կամ բանալին կորել է։ Մուտքի էջը՝{" "}
            <a href="/auth/admin-recovery" className="font-semibold text-terracotta-600 hover:underline">/auth/admin-recovery</a>
          </p>
          <button type="button" disabled={busy} onClick={() => act({ action: "codes.new" }, "Ստեղծե՞լ նոր 10 կոդ։ Հները այլևս չեն գործի։")} className={`${adminGhost} mt-3`}>
            Ստեղծել նոր կոդեր
          </button>
        </section>
      )}

      {other && keys.length > 0 && <OtherPassword address={other} />}

      {devices.length > 0 && (
        <section className={box}>
          <h3 className={h3}>Վստահելի սարքեր</h3>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-ink">{d.label ?? "Սարք"}</span>
                  {d.current && <span className="ml-2 rounded-full bg-spruce-500/10 px-2 py-0.5 text-xs font-semibold text-spruce-700 dark:text-spruce-300">այս սարքը</span>}
                  <span className="block text-xs text-muted">Հաստատվել է {d.created}{d.used ? ` · վերջին անգամ՝ ${d.used}` : ""}</span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act({ action: "device.revoke", id: d.id }, d.current ? "Հանե՞լ այս սարքը։ Հաջորդ անգամ նորից բանալի կպահանջվի։" : "Հանե՞լ այս սարքը վստահելիներից։")}
                  className={adminGhost}
                >
                  Հանել
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// The fresh codes, once: copy or save them, then they are gone from the page.
function CodesShown({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Culmen — գլխավոր ադմինի մեկանգամյա կոդեր (${new Date().toISOString().slice(0, 10)})\n\n${codes.join("\n")}\n`;
  return (
    <section className="rounded-xl border-2 border-terracotta-500 bg-surface p-4 sm:p-5">
      <h3 className={h3}>Ձեր 10 մեկանգամյա կոդերը</h3>
      <p className="mt-1 text-sm text-ink">Դրանք ցույց ենք տալիս միայն հիմա։ Գրեք թղթի վրա կամ պահեք գաղտնաբառերի պահոցում, ոչ էլ. փոստում։ Յուրաքանչյուրը գործում է մեկ անգամ։</p>
      <ol className="mt-3 grid grid-cols-1 gap-1.5 font-mono text-sm text-ink min-[400px]:grid-cols-2">
        {codes.map((c, i) => (
          <li key={c} className="rounded-md bg-sand/60 px-3 py-1.5">
            <span className="mr-2 text-muted">{i + 1}.</span>
            {c}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={adminGhost}
          onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => undefined)}
        >
          {copied ? "✓ Պատճենված է" : "Պատճենել"}
        </button>
        <a className={adminGhost} download="culmen-recovery-codes.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}>
          Ներբեռնել .txt
        </a>
        <button type="button" className={adminButton} onClick={() => window.confirm("Պահե՞լ եք կոդերը։ Այլևս չեն երևա։") && onClose()}>
          Պահել եմ
        </button>
      </div>
    </section>
  );
}

// The other address's password: phone (later) + key + that address's email
// link, all within 10 minutes, then the new password.
function OtherPassword({ address }: { address: string }) {
  const [op, setOp] = useState<{ id: string; expiresAt: number } | null>(null);
  const [step, setStep] = useState<"key" | "email" | "password" | "done">("key");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");

  const left = op ? Math.max(0, op.expiresAt - now) : 0;
  const expired = !!op && left === 0 && step !== "done";

  // The clock, and asking whether the email link was pressed.
  useEffect(() => {
    if (!op || step === "done") return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll =
      step === "email"
        ? setInterval(async () => {
            const res = await call<{ open: boolean; emailOk?: boolean }>({ action: "other.status", op: op.id });
            if (res.error === null && res.data.emailOk) setStep("password");
          }, 3000)
        : null;
    return () => {
      clearInterval(tick);
      if (poll) clearInterval(poll);
    };
  }, [op, step]);

  async function begin() {
    setBusy(true);
    setError(null);
    const start = await call<{ op: string; expiresAt: string; options: Parameters<typeof startAuthentication>[0]["optionsJSON"] }>({ action: "other.start" });
    if (start.error !== null) return setBusy(false), setError(start.error);
    setOp({ id: start.data.op, expiresAt: new Date(start.data.expiresAt).getTime() });
    setNow(Date.now());
    setStep("key");
    let response;
    try {
      response = await startAuthentication({ optionsJSON: start.data.options });
    } catch {
      setBusy(false);
      return setError("Բանալին չհաստատվեց։ Սկսեք նորից։");
    }
    const key = await call<{ sentTo: string | null }>({ action: "other.key", op: start.data.op, response });
    setBusy(false);
    if (key.error !== null) return setError(key.error);
    setSentTo(key.data.sentTo);
    setStep("email");
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    if (!op) return;
    setError(null);
    if (password !== repeat) return setError("Գաղտնաբառերը չեն համընկնում։");
    setBusy(true);
    const res = await call({ action: "other.finish", op: op.id, password });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setStep("done");
    setPassword("");
    setRepeat("");
  }

  const mm = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
  const stepRow = (n: number, text: string, state: "done" | "now" | "wait" | "off") => (
    <li className={`flex items-start gap-2 text-sm ${state === "off" ? "text-muted" : "text-ink"}`}>
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          state === "done" ? "bg-spruce-500 text-white" : state === "now" ? "bg-terracotta-500 text-white" : "bg-sand text-muted"
        }`}
      >
        {state === "done" ? "✓" : n}
      </span>
      <span>{text}</span>
    </li>
  );
  const order = ["key", "email", "password", "done"];
  const at = (s: string) => (!op ? "wait" : order.indexOf(step) > order.indexOf(s) ? "done" : step === s ? "now" : "wait");

  return (
    <section className={box}>
      <h3 className={h3}>Մյուս հասցեի գաղտնաբառը</h3>
      <p className="mt-1 text-sm text-muted">
        <span className="font-medium text-ink">{address}</span> հասցեի գաղտնաբառն այստեղից փոխվում է միայն բոլոր քայլերով՝ 10 րոպեի ընթացքում։
      </p>
      <ol className="mt-3 space-y-2">
        {stepRow(1, "Հեռախոսի SMS կոդ (շուտով)", "off")}
        {stepRow(2, "Հպում անվտանգության բանալուն", at("key"))}
        {stepRow(3, `Հաստատում ${sentTo ?? address} հասցեին ուղարկված նամակից`, at("email"))}
        {stepRow(4, "Նոր գաղտնաբառ", at("password"))}
      </ol>
      {op && step !== "done" && !expired && <p className="mt-3 text-sm text-muted">Մնացել է <b className="font-mono text-ink">{mm}</b></p>}
      {expired && <p className="mt-3 text-sm text-red-600">10 րոպեն անցավ։ Սկսեք նորից։</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {step === "done" ? (
        <p className="mt-3 text-sm text-green-700 dark:text-green-400">✓ {address} հասցեի գաղտնաբառը փոխված է։</p>
      ) : step === "password" && !expired ? (
        <form onSubmit={finish} className="mt-3 max-w-sm space-y-3">
          <PasswordInput required minLength={MIN_PASSWORD} autoComplete="new-password" placeholder="Նոր գաղտնաբառ" value={password} onChange={(e) => setPassword(e.target.value)} className={adminInput} />
          <PasswordInput required minLength={MIN_PASSWORD} autoComplete="new-password" placeholder="Կրկնեք" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={adminInput} />
          <button type="submit" disabled={busy} className={adminButton}>{busy ? "…" : "Պահպանել"}</button>
        </form>
      ) : step === "email" && !expired ? (
        <p className="mt-3 text-sm text-ink">Բացեք նամակը և սեղմեք «Հաստատել»։ Այս էջը ինքը կշարունակի։</p>
      ) : (
        <button type="button" disabled={busy} onClick={begin} className={`${adminButton} mt-3`}>
          {busy ? "Սպասում ենք բանալուն…" : op ? "Սկսել նորից" : "Սկսել"}
        </button>
      )}
    </section>
  );
}
