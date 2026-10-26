/** @type {import('next').NextConfig} */
const nextConfig = {
  // EuroLeague'i mängijapildid (~450 KB) ja vapid käivad läbi Next'i pildioptimeerija
  // (components/widgets/nba/media.tsx resizedImage).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media-cdn.cortextech.io" },
      { protocol: "https", hostname: "media-cdn.incrowdsports.com" },
    ],
  },
  // CSP tuleb middleware.ts-ist (vajab iga päringu jaoks uut nonce'i); siin on staatilised päised.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Vanematele brauseritele; uuemad kasutavad CSP frame-ancestors'i.
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
