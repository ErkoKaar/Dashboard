/** @type {import('next').NextConfig} */
const nextConfig = {
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
