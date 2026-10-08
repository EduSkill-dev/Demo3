"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_PERMS, PERM_LABELS, type AdminPerm } from "@/lib/adminLabels";
import { adminAction, adminButton, adminDanger, adminGhost, adminInput } from "./adminApi";

export type AdminRow = {
  userId: string;
  email: string;
  perms: AdminPerm[];
  mustChangePassword: boolean;
  createdAt: string;
};

function PermBoxes({ value, onChange, idPrefix }: { value: AdminPerm[]; onChange: (v: AdminPerm[]) => void; idPrefix: string }) {
  return (
    <div className="space-y-1.5">
      {ADMIN_PERMS.map((k) => (
        <label key={k} htmlFor={`${idPrefix}-${k}`} className="flex items-center gap-2 text-sm text-ink">
          <input
            id={`${idPrefix}-${k}`}
            type="checkbox"
            className="accent-spruce-500"
            checked={value.includes(k)}
            onChange={() => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k])}
          />
          {PERM_LABELS[k]}
        </label>
      ))}
    </div>
  );
}

// Shown once, right after a password was generated.
function OneTimePassword({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  return (
    <div className="rounded-xl border border-terracotta-500/50 bg-terracotta-500/10 p-4 text-sm text-ink">
      <p className="font-semibold">Մեկանգամյա գաղտնաբառ՝ {email}</p>
      <p className="mt-2 select-all break-all rounded-lg bg-surface px-3 py-2 font-mono text-base">{password}</p>
      <p className="mt-2 text-xs text-muted">
        Փոխանցեք այն ադմինին։ Այն այլևս չի ցուցադրվի։ Առաջին մուտքից հետո ադմինը պարտավոր է սահմանել իր գաղտնաբառը։
      </p>
      <button type="button" className={`${adminGhost} mt-3`} onClick={onClose}>
        Հասկանալի է
      </button>
    </div>
  );
}

function AdminItem({ row, onPassword }: { row: AdminRow; onPassword: (email: string, password: string) => void }) {
  const router = useRouter();
  const [perms, setPerms] = useState<AdminPerm[]>(row.perms);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = [...perms].sort().join() !== [...row.perms].sort().join();

  async function run(body: { action: string } & Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await adminAction<{ password?: string }>({ ...body, userId: row.userId });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    if (res.data.password) onPassword(row.email, res.data.password);
    router.refresh();
  }

  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-semibold text-ink">{row.email}</p>
          {row.mustChangePassword && (
            <p className="mt-1 text-xs font-semibold text-terracotta-700 dark:text-terracotta-300">Դեռ չի փոխել մեկանգամյա գաղտնաբառը</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={busy}
            className={adminGhost}
            onClick={() => confirm(`Տա՞լ նոր մեկանգամյա գաղտնաբառ ${row.email} ադմինին։ Հինը կդադարի գործել։`) && run({ action: "admin.resetPassword" })}
          >
            Նոր մեկանգամյա գաղտնաբառ
          </button>
          <button
            type="button"
            disabled={busy}
            className={adminDanger}
            onClick={() => confirm(`Հեռացնե՞լ ${row.email} ադմինին։`) && run({ action: "admin.delete" })}
          >
            Հեռացնել
          </button>
        </div>
      </div>
      <div className="mt-3 border-t border-line pt-3">
        <PermBoxes value={perms} onChange={setPerms} idPrefix={row.userId} />
        {dirty && (
          <button type="button" disabled={busy} className={`${adminButton} mt-3`} onClick={() => run({ action: "admin.update", perms })}>
            Պահպանել թույլտվությունները
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </li>
  );
}

export default function AdminsManager({ rows }: { rows: AdminRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [perms, setPerms] = useState<AdminPerm[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<{ email: string; password: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await adminAction<{ password: string }>({ action: "admin.create", email, perms });
    setBusy(false);
    if (res.error !== null) return setError(res.error);
    setShown({ email: email.trim(), password: res.data.password });
    setEmail("");
    setPerms([]);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {shown && <OneTimePassword email={shown.email} password={shown.password} onClose={() => setShown(null)} />}

      <form onSubmit={create} className="max-w-xl space-y-4 rounded-xl border border-line bg-surface p-5">
        <h3 className="font-serif text-lg font-semibold text-heading">Նոր ադմին</h3>
        <div>
          <label htmlFor="admin-email" className="mb-1 block text-sm font-medium text-ink">Հարթակի էլ. հասցե</label>
          <input id="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={adminInput} />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Թույլտվություններ</legend>
          <PermBoxes value={perms} onChange={setPerms} idPrefix="new" />
        </fieldset>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className={adminButton}>
          {busy ? "..." : "Ստեղծել և ստանալ մեկանգամյա գաղտնաբառ"}
        </button>
      </form>

      <section>
        <h3 className="font-serif text-lg font-semibold text-heading">Ադմիններ ({rows.length})</h3>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Դեռ ադմին չկա։</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {rows.map((r) => (
              <AdminItem key={r.userId} row={r} onPassword={(e, p) => setShown({ email: e, password: p })} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
