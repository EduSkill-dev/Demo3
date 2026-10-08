// Netlify's counterpart of the cron entry in vercel.json: once a day it calls
// /api/cron/daily (package reminders + newsletter digest) with the secret.
export default async () => {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "").replace(/\/$/, "");
  const res = await fetch(`${base}/api/cron/daily`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  console.log("daily job:", res.status);
  return new Response("ok");
};

export const config = { schedule: "0 6 * * *" };
