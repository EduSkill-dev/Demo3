/** @type {import('next').NextConfig} */
const nextConfig = {
  // Verification builds can use their own folder (NEXT_DIST_DIR=.next-check)
  // so they never clash with a running `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Sent with every page: no framing by other sites (clickjacking), no MIME
  // sniffing, no full address leaked to other sites, no device features.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
