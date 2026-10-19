"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { formatAmd } from "@/lib/catalog";
import { MIN_PASSWORD } from "@/lib/authErrors";
import { serverErrorMessage } from "@/lib/serverErrors";
import GoogleButton from "@/components/auth/GoogleButton";
import PasswordInput from "@/components/ui/PasswordInput";

const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-terracotta-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500/30";
const label = "mb-1 block text-xs font-semibold text-muted";

// "Book" for someone who is not signed in: at the top, Google or signing in
// (an account keeps the bookings and history); below, the few details we and
// the club need — no password unless "create an account" is ticked. A paid
// hike also takes the card here.
export default function GuestBookingForm({ tourId, price, source }: { tourId: string; price: number; source: () => string | null }) {
  const t = useT();
  const router = useRouter();
  const [f, setF] = useState({ firstName: "", lastName: "", phone: "", email: "", birthDate: "", gender: "" });
  const [account, setAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [card, setCard] = useState({ number: "", exp: "", cvc: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; login?: boolean } | null>(null);
  const [done, setDone] = useState<{ email: string; account: boolean } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const loginHref = `/login?next=${encodeURIComponent(`/tours/${tourId}`)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/bookings/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "book", tour_id: tourId, ...f, createAccount: account, password: account ? password : undefined, source: source(), card: price > 0 ? card : undefined }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { error?: string; code?: string; message?: string; account?: string | null }) : null;
    setBusy(false);
    if (!res || !data) return setError({ text: t("errors.network") });
    if (res.status === 402) return setError({ text: data.message ? serverErrorMessage(t, data.message) : t("payment.declined") });
    if (!res.ok) return setError({ text: data.error ? serverErrorMessage(t, data.error) : t("errors.network"), login: data.code === "account_exists" });
    setDone({ email: f.email.trim(), account: data.account === "created" });
    router.refresh(); // the seats count
  }

  if (done) {
    return (
      <div className="space-y-2 rounded-xl bg-green-50 p-4 text-sm text-green-900 dark:bg-green-950/40 dark:text-green-200">
        <p className="font-bold">✅ {t("guest.booked")}</p>
        <p>{t("guest.bookedText", { email: done.email })}</p>
        {done.account && <p>{t("guest.confirmAccount")}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted">{t("guest.haveAccount")}</p>
        <GoogleButton next={`/tours/${tourId}`} />
        <Link href={loginHref} className="block text-center text-xs font-semibold text-terracotta-700 hover:text-terracotta-500 dark:text-terracotta-300">
          {t("guest.loginEmail")}
        </Link>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        {t("guest.orQuick")}
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="g-first" className={label}>{t("auth.firstName")}</label>
            <input id="g-first" required maxLength={60} autoComplete="given-name" value={f.firstName} onChange={set("firstName")} className={input} />
          </div>
          <div>
            <label htmlFor="g-last" className={label}>{t("auth.lastName")}</label>
            <input id="g-last" required maxLength={60} autoComplete="family-name" value={f.lastName} onChange={set("lastName")} className={input} />
          </div>
        </div>
        <div>
          <label htmlFor="g-phone" className={label}>{t("auth.phone")}</label>
          <input id="g-phone" type="tel" required pattern="[+0-9 \(\)\-]{8,20}" placeholder="+374 XX XXXXXX" autoComplete="tel" value={f.phone} onChange={set("phone")} className={input} />
        </div>
        <div>
          <label htmlFor="g-email" className={label}>{t("auth.email")}</label>
          <input id="g-email" type="email" required autoComplete="email" value={f.email} onChange={set("email")} className={input} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="g-birth" className={label}>{t("auth.birthDate")}</label>
            <input id="g-birth" type="date" required min="1900-01-01" max={new Date().toISOString().slice(0, 10)} autoComplete="bday" value={f.birthDate} onChange={set("birthDate")} className={input} />
          </div>
          <div>
            <label htmlFor="g-gender" className={label}>{t("auth.gender")}</label>
            <select id="g-gender" required value={f.gender} onChange={set("gender")} className={input}>
              <option value="" disabled>—</option>
              <option value="female">{t("auth.female")}</option>
              <option value="male">{t("auth.male")}</option>
            </select>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line bg-sand/40 p-3 text-sm text-ink">
          <input type="checkbox" checked={account} onChange={(e) => setAccount(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-spruce-500" />
          <span>
            <span className="font-semibold">{t("guest.createAccount")}</span>
            <span className="block text-xs text-muted">{t("guest.createAccountHint")}</span>
          </span>
        </label>
        {account && (
          <div>
            <label htmlFor="g-password" className={label}>{t("auth.password")}</label>
            <PasswordInput id="g-password" required minLength={MIN_PASSWORD} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
            <p className="mt-1 text-xs text-muted">{t("auth.passwordHint")}</p>
          </div>
        )}

        {price > 0 && (
          <div className="space-y-2 rounded-lg border border-line p-3">
            <div className="flex items-center justify-between text-sm">
              <b className="text-heading">{t("payment.title")}</b>
              <span className="font-semibold text-terracotta-700">{formatAmd(price)}</span>
            </div>
            <input
              required
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder={t("payment.cardNumber")}
              value={card.number}
              onChange={(e) => setCard((c) => ({ ...c, number: e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim() }))}
              className={input}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder={t("payment.expiry")}
                value={card.exp}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                  setCard((c) => ({ ...c, exp: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }));
                }}
                className={input}
              />
              <input required inputMode="numeric" autoComplete="cc-csc" placeholder="CVC" value={card.cvc} onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) }))} className={input} />
            </div>
            <p className="rounded-lg bg-sand/60 p-2 text-[11px] leading-4 text-muted">
              {t("payment.testCards", { ok: "4242 4242 4242 4242", declined: "4000 0000 0000 0002", funds: "4000 0000 0000 9995" })}
            </p>
          </div>
        )}

        <p className="text-[11px] leading-4 text-muted">
          {t("guest.consentStart")}{" "}
          <Link href="/terms" className="underline">{t("guest.terms")}</Link> {t("guest.and")}{" "}
          <Link href="/privacy" className="underline">{t("guest.privacy")}</Link>
          {t("guest.consentEnd")}
        </p>
        {error && (
          <p className="text-sm text-red-600">
            {error.text}{" "}
            {error.login && <Link href={loginHref} className="font-semibold underline">{t("header.login")}</Link>}
          </p>
        )}
        <button type="submit" disabled={busy} className="w-full rounded-full bg-spruce-500 py-3 font-semibold text-white hover:bg-spruce-900 disabled:cursor-not-allowed disabled:bg-spruce-500/50">
          {busy ? t("signup.booking") : price > 0 ? t("signup.bookAndPay", { price: formatAmd(price) }) : t("signup.book")}
        </button>
      </form>
    </div>
  );
}
