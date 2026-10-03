"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/client";

type Eligibility = "loading" | "anon" | "club" | "no" | "yes";

// Score + comment form, gated by the database rules: you can only rate a
// tour you signed up for, or a club whose tour you took part in.
export default function RatingBox({
  target,
  tourId,
  clubId,
  noun = "",
}: {
  target: "tour" | "club";
  tourId?: string;
  clubId?: string;
  noun?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [eligibility, setEligibility] = useState<Eligibility>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [existing, setExisting] = useState<{ id: string; score: number; comment: string | null } | null>(null);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setEligibility("anon");
      setUserId(auth.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .single();
      if (profile?.role === "club") return setEligibility("club");

      let attended = false;
      const today = new Date().toISOString().slice(0, 10);
      if (target === "tour" && tourId) {
        // Only after the hike has happened (the database checks this too).
        const { data } = await supabase
          .from("bookings")
          .select("id, tours!inner(date)")
          .eq("tour_id", tourId)
          .eq("user_id", auth.user.id)
          .eq("status", "confirmed")
          .lte("tours.date", today)
          .limit(1);
        attended = (data ?? []).length > 0;
      } else if (target === "club" && clubId) {
        const { data } = await supabase
          .from("bookings")
          .select("id, tours!inner(club_id, date)")
          .eq("user_id", auth.user.id)
          .eq("status", "confirmed")
          .eq("tours.club_id", clubId)
          .lte("tours.date", today)
          .limit(1);
        attended = (data ?? []).length > 0;
      }

      if (!attended) return setEligibility("no");

      const { data: rating } = await supabase
        .from("ratings")
        .select("id, score, comment")
        .eq("user_id", auth.user.id)
        .eq(target === "tour" ? "tour_id" : "club_id", target === "tour" ? tourId : clubId)
        .maybeSingle();

      if (rating) {
        setExisting(rating as { id: string; score: number; comment: string | null });
        setScore((rating as any).score);
        setComment((rating as any).comment ?? "");
      }
      setEligibility("yes");
    })();
  }, [target, tourId, clubId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || score < 1) return setError(t("rating.pickScore"));
    setSaving(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();

    const payload = {
      user_id: userId,
      score,
      comment: comment.trim() || null,
    };
    const column = target === "tour" ? "tour_id" : "club_id";
    const value = target === "tour" ? tourId : clubId;

    const { error: dbError } = existing
      ? await supabase.from("ratings").update(payload).eq("id", existing.id)
      : await supabase.from("ratings").insert({ ...payload, [column]: value });

    setSaving(false);
    if (dbError) {
      if (dbError.code === "23505") setError(t("rating.already"));
      else if (dbError.code === "42501") setError(t("rating.onlyAfter"));
      else setError(dbError.message);
      return;
    }
    setMessage(t("rating.saved"));
    setExisting((cur) => (cur ? { ...cur, score, comment: comment.trim() || null } : cur));
    router.refresh();
  }

  if (eligibility === "loading")
    return <p className="text-sm text-muted">{t("common.loading")}</p>;
  if (eligibility === "anon" || eligibility === "club") return null;

  if (eligibility === "no")
    return (
      <p className="text-sm text-muted">{target === "tour" ? t("rating.onlyAfter") : t("rating.onlyAfterClub")}</p>
    );

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="font-semibold text-heading">
        {existing ? t("rating.yours") : t("rating.rate", { name: noun })}
      </p>

      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setScore(n)}
            aria-label={t("rating.stars", { count: n })}
            className={`text-2xl leading-none transition ${
              n <= score ? "text-apricot" : "text-line hover:text-apricot/50"
            }`}
          >
            ★
          </button>
        ))}
        {score > 0 && <span className="ml-2 text-sm text-muted">{score}/5</span>}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={600}
        placeholder={t("rating.placeholder")}
        className="w-full rounded-lg border border-line bg-surface p-3 text-sm text-ink placeholder:text-muted"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <button
        type="submit"
        disabled={saving || score < 1}
        className="rounded-lg bg-apricot px-5 py-2.5 text-sm font-semibold text-white hover:bg-apricot-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? t("rating.saving") : existing ? t("rating.update") : t("rating.send")}
      </button>
    </form>
  );
}
