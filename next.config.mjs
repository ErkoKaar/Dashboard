/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lehe metadata (manifest, apple-mobile-web-app-*) peab olema <head>-is: Next 15 striimib dünaamilise
  // lehe metadata muidu <body>-sse ja Chrome ei leia sealt manifesti (PWA pole installitav). /.*/ = kõigile.
  htmlLimitedBots: /.*/,
  // Korvpallivaadete mängijapildid ja logod käivad läbi Next'i pildioptimeerija, mis teeb neist WebP-i
  // (components/widgets/nba/media.tsx resizedImage): ESPN-i PNG ~220 KB -> ~30 KB, EuroLeague ~450 KB -> ~50 KB.
  // Est-Lat liiga fotod samuti: brauser eemaldab nende valge tausta lõuendil ja see töötab ainult oma
  // päritoluga pildiga (nba/whiteBackground.ts).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "a.espncdn.com", pathname: "/combiner/**" },
      { protocol: "https", hostname: "media-cdn.cortextech.io" },
      { protocol: "https", hostname: "media-cdn.incrowdsports.com" },
      { protocol: "https", hostname: "www.estlatbl.com", pathname: "/cache/**" },
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
