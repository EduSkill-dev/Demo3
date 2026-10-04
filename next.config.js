/** @type {import('next').NextConfig} */
const nextConfig = {
  // Verification builds can use their own folder (NEXT_DIST_DIR=.next-check)
  // so they never clash with a running `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
module.exports = nextConfig;
