import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface SpotifyNowPlaying {
  isPlaying: boolean;
  track: {
    name: string;
    artists: string;
    albumArt: string | null;
    progressMs: number;
    durationMs: number;
  } | null;
}

export interface SpotifyTopTrack {
  id: string;
  name: string;
  artists: string;
  albumArt: string | null;
}

export interface SpotifyTopArtist {
  id: string;
  name: string;
  image: string | null;
}

export interface SpotifyTop {
  tracks: SpotifyTopTrack[];
  artists: SpotifyTopArtist[];
}

const NOW_PLAYING_KEY = ["spotify-now-playing"];

export function useSpotifyNowPlaying() {
  return useQuery({
    queryKey: NOW_PLAYING_KEY,
    queryFn: async (): Promise<SpotifyNowPlaying> => {
      const res = await fetch("/api/spotify/now-playing");
      if (!res.ok) throw new Error("Spotify andmete laadimine ebaõnnestus");
      return res.json();
    },
    refetchInterval: 15000,
  });
}

export function useSpotifyTop() {
  return useQuery({
    queryKey: ["spotify-top"],
    queryFn: async (): Promise<SpotifyTop> => {
      const res = await fetch("/api/spotify/top");
      if (!res.ok) throw new Error("Spotify andmete laadimine ebaõnnestus");
      return res.json();
    },
  });
}

export type SpotifyControlAction = "play" | "pause" | "next" | "previous";

export function useSpotifyControl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (action: SpotifyControlAction) => {
      const res = await fetch("/api/spotify/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Toiming ebaõnnestus");
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOW_PLAYING_KEY }),
  });
}
