import { NextResponse } from "next/server";
import { getSpotifyAccessToken, hasSpotifyEnv } from "@/lib/spotify/token";

interface SpotifyTrackItem {
  type: "track";
  name: string;
  artists: { name: string }[];
  album?: { images?: { url: string }[] };
  duration_ms: number;
}

interface SpotifyEpisodeItem {
  type: "episode";
  name: string;
  show?: { name: string };
  images?: { url: string }[];
  duration_ms: number;
}

export async function GET() {
  if (!hasSpotifyEnv()) {
    return NextResponse.json({ error: "Spotify env muutujad puuduvad" }, { status: 500 });
  }

  try {
    const accessToken = await getSpotifyAccessToken();
    const res = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing?additional_types=episode",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );

    if (res.status === 204) {
      return NextResponse.json({ isPlaying: false, track: null });
    }

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return NextResponse.json({ error: json.error?.message ?? "Spotify API viga" }, { status: 502 });
    }

    const json = await res.json();
    const item: SpotifyTrackItem | SpotifyEpisodeItem | undefined = json.item;

    if (!item) {
      return NextResponse.json({ isPlaying: !!json.is_playing, track: null });
    }

    const track =
      item.type === "track"
        ? {
            name: item.name,
            artists: item.artists.map((a) => a.name).join(", "),
            albumArt: item.album?.images?.[0]?.url ?? null,
            progressMs: json.progress_ms ?? 0,
            durationMs: item.duration_ms,
          }
        : {
            name: item.name,
            artists: item.show?.name ?? "Podcast",
            albumArt: item.images?.[0]?.url ?? null,
            progressMs: json.progress_ms ?? 0,
            durationMs: item.duration_ms,
          };

    return NextResponse.json({ isPlaying: !!json.is_playing, track });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Spotify viga" },
      { status: 500 },
    );
  }
}
