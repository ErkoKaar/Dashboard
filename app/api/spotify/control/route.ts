import { NextResponse } from "next/server";
import { getSpotifyAccessToken, hasSpotifyEnv } from "@/lib/spotify/token";

const ACTIONS: Record<string, { method: string; path: string }> = {
  play: { method: "PUT", path: "play" },
  pause: { method: "PUT", path: "pause" },
  next: { method: "POST", path: "next" },
  previous: { method: "POST", path: "previous" },
};

export async function POST(request: Request) {
  if (!hasSpotifyEnv()) {
    return NextResponse.json({ error: "Spotify env muutujad puuduvad" }, { status: 500 });
  }

  const { action } = await request.json();
  const endpoint = ACTIONS[action];
  if (!endpoint) {
    return NextResponse.json({ error: "Tundmatu action" }, { status: 400 });
  }

  try {
    const accessToken = await getSpotifyAccessToken();
    const res = await fetch(`https://api.spotify.com/v1/me/player/${endpoint.path}`, {
      method: endpoint.method,
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (res.ok) {
      return NextResponse.json({ ok: true });
    }
    if (res.status === 404) {
      return NextResponse.json({ error: "Spotify seade pole aktiivne" }, { status: 404 });
    }
    if (res.status === 403) {
      return NextResponse.json({ error: "Toiming nõuab Spotify Premiumit" }, { status: 403 });
    }

    const json = await res.json().catch(() => ({}));
    return NextResponse.json({ error: json?.error?.message ?? "Spotify API viga" }, { status: 502 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Spotify viga" },
      { status: 500 },
    );
  }
}
