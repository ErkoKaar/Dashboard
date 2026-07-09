import { NextResponse } from "next/server";
import { getSpotifyAccessToken, hasSpotifyEnv } from "@/lib/spotify/token";

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album?: { images?: { url: string }[] };
}

interface SpotifyArtist {
  id: string;
  name: string;
  images?: { url: string }[];
}

export async function GET() {
  if (!hasSpotifyEnv()) {
    return NextResponse.json({ error: "Spotify env muutujad puuduvad" }, { status: 500 });
  }

  try {
    const accessToken = await getSpotifyAccessToken();
    const headers = { Authorization: `Bearer ${accessToken}` };

    const [tracksRes, artistsRes] = await Promise.all([
      fetch("https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5", {
        headers,
        cache: "no-store",
      }),
      fetch("https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=5", {
        headers,
        cache: "no-store",
      }),
    ]);

    if (!tracksRes.ok || !artistsRes.ok) {
      return NextResponse.json({ error: "Spotify API viga" }, { status: 502 });
    }

    const tracksJson = await tracksRes.json();
    const artistsJson = await artistsRes.json();

    const tracks = (tracksJson.items as SpotifyTrack[]).map((t) => ({
      id: t.id,
      name: t.name,
      artists: t.artists.map((a) => a.name).join(", "),
      albumArt: t.album?.images?.[0]?.url ?? null,
    }));

    const artists = (artistsJson.items as SpotifyArtist[]).map((a) => ({
      id: a.id,
      name: a.name,
      image: a.images?.[0]?.url ?? null,
    }));

    return NextResponse.json({ tracks, artists });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Spotify viga" },
      { status: 500 },
    );
  }
}
