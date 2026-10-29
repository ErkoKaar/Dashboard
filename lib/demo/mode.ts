import type { Session } from "@supabase/supabase-js";

// Avalik demo (NEXT_PUBLIC_DEMO_MODE=1 nagu TaskZenis, eraldi Verceli projekt): sisselogimist pole ja isiklikud
// andmed tulevad väljamõeldud fikstuuridest (lib/demo/*). Supabase'i, Google Calendari, Spotify, GitHubi ega
// Anthropicu poole demo ei pöördu; avalikud spordiandmed (NBA, EuroLeague, Est-Lat, Europe Cup, Delfi) ja ilm on elusad.
// Lipp on build-time: tavalises buildis on see false ja demo moodulid laaditakse ainult dünaamiliselt.
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

export const DEMO_USER_ID = "demo-user";

/** Route'id, mis on demos sisselogimiseta lahti: avalikud spordiandmed, mitte ühtegi salajast võtit. */
export const DEMO_PUBLIC_API = /^\/api\/(nba|euroleague|estlat|europecup|esthoop-club-schedule|esthoop-club-results)(\/|$)/;

export const DEMO_SESSION: Session = {
  access_token: "demo",
  refresh_token: "demo",
  token_type: "bearer",
  expires_in: 3600,
  user: {
    id: DEMO_USER_ID,
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
  },
};
