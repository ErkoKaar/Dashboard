"use client";

import { useState } from "react";
import { Disc3, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { useSpotifyControl, useSpotifyNowPlaying, useSpotifyTop } from "@/lib/queries/useSpotify";

type Tab = "now" | "top";

function NowPlayingTab() {
  const { data, isLoading, error } = useSpotifyNowPlaying();
  const control = useSpotifyControl();

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (error) return <p className="text-sm text-destructive">Spotify andmete laadimine ebaõnnestus.</p>;

  if (!data?.track) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Disc3 className="h-12 w-12 text-muted/40" aria-hidden />
        <p className="text-sm text-muted">Ei kuula praegu midagi.</p>
      </div>
    );
  }

  const { track, isPlaying } = data;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {track.albumArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.albumArt} alt="" className="h-12 w-12 rounded-md" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-surface-hover">
            <Disc3 className="h-5 w-5 text-muted" aria-hidden />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{track.name}</p>
          <p className="truncate text-sm text-muted">{track.artists}</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => control.mutate("previous")}
          disabled={control.isPending}
          className="cursor-pointer p-1.5 text-muted transition-colors duration-200 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Eelmine lugu"
        >
          <SkipBack className="h-4 w-4" aria-hidden />
        </button>
        <button
          onClick={() => control.mutate(isPlaying ? "pause" : "play")}
          disabled={control.isPending}
          className="cursor-pointer rounded-full bg-accent p-2 text-background transition-colors duration-200 hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={isPlaying ? "Paus" : "Mängi"}
        >
          {isPlaying ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
        </button>
        <button
          onClick={() => control.mutate("next")}
          disabled={control.isPending}
          className="cursor-pointer p-1.5 text-muted transition-colors duration-200 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Järgmine lugu"
        >
          <SkipForward className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {control.error && (
        <p className="text-center text-sm text-destructive">{control.error.message}</p>
      )}
    </div>
  );
}

function TopTab() {
  const { data, isLoading, error } = useSpotifyTop();

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (error || !data) return <p className="text-sm text-destructive">Spotify andmete laadimine ebaõnnestus.</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs text-muted">Top lood</p>
        <ul className="space-y-1.5">
          {data.tracks.map((track, i) => (
            <li key={track.id} className="flex items-center gap-2.5">
              <span className="w-3 shrink-0 font-mono text-xs text-muted">{i + 1}</span>
              {track.albumArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={track.albumArt} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface-hover">
                  <Disc3 className="h-3.5 w-3.5 text-muted" aria-hidden />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{track.name}</p>
                <p className="truncate text-xs text-muted">{track.artists}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1.5 text-xs text-muted">Top esitajad</p>
        <ul className="space-y-1.5">
          {data.artists.map((artist, i) => (
            <li key={artist.id} className="flex items-center gap-2.5">
              <span className="w-3 shrink-0 font-mono text-xs text-muted">{i + 1}</span>
              {artist.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artist.image} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-hover">
                  <Disc3 className="h-3.5 w-3.5 text-muted" aria-hidden />
                </div>
              )}
              <p className="truncate text-sm text-foreground">{artist.name}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SpotifyWidget() {
  const [tab, setTab] = useState<Tab>("now");

  return (
    <Card>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={Disc3} href="https://open.spotify.com">
          Spotify
        </WidgetTitle>
        <div className="flex gap-1">
          <TabButton active={tab === "now"} onClick={() => setTab("now")}>
            Praegu mängib
          </TabButton>
          <TabButton active={tab === "top"} onClick={() => setTab("top")}>
            Top
          </TabButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "now" ? <NowPlayingTab /> : <TopTab />}
      </div>
    </Card>
  );
}
