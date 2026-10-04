import { NextRequest, NextResponse } from "next/server";

// Content-Security-Policy nonce'iga. Iga lehe laadimine saab uue nonce'i; Next loeb selle päringu
// CSP päisest ja lisab oma skriptidele ise. Seepärast renderdatakse lehed dünaamiliselt (app/layout.tsx).
// Eesmärk: kui XSS-ist peaks midagi läbi tulema, ei käivitu võõras skript ega saa ühendust suvalise serveriga.

function origin(url: string | undefined) {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === "development";

  // Brauserist otse kutsutavad teenused; kõik muu käib läbi /api route'ide.
  const connectSrc = [
    "'self'",
    origin(process.env.NEXT_PUBLIC_TASKS_SUPABASE_URL),
    origin(process.env.NEXT_PUBLIC_FINANCE_SUPABASE_URL),
    origin(process.env.NEXT_PUBLIC_ESTHOOP_API_URL),
    "https://api.chess.com",
    "https://api.open-meteo.com",
    isDev ? "ws:" : null, // Next dev HMR
  ].filter(Boolean);

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Stiiliatribuudid (React style, next/font) ei toeta nonce'i.
    "style-src 'self' 'unsafe-inline'",
    // Pildid tulevad mitmest kohast (Spotify, EstHoopi mängijad); pildid ei käivita koodi.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(" ")}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Ainult lehed: mitte API, staatilised failid ega prefetch-päringud.
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
