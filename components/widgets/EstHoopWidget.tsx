"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { Basketball } from "@/components/ui/icons/Basketball";
import { EstHoopEvent, useEstHoopGames, useEstHoopTopScorer } from "@/lib/queries/useEstHoopGames";
import { countryFlag } from "@/lib/countryFlags";

// Player photos are served as static assets from the EstHoop frontend deploy,
// keyed by slug — see frontend/src/components/PlayerAvatar.jsx in that repo.
const ESTHOOP_FRONTEND_URL = "https://est-hoop.vercel.app";
const PHOTO_EXTENSIONS = ["webp", "jpg", "png"];
const ESTONIA_FLAG = "🇪🇪";

type Tab = "next" | "last";

function opponentName(event: EstHoopEvent): string {
  return event.homeTeam.name === "Estonia" ? event.awayTeam.name : event.homeTeam.name;
}

function isHome(event: EstHoopEvent): boolean {
  return event.homeTeam.name === "Estonia";
}

function estoniaScores(event: EstHoopEvent): { est: number | null; opp: number | null } {
  const home = isHome(event);
  return {
    est: (home ? event.homeScore?.current : event.awayScore?.current) ?? null,
    opp: (home ? event.awayScore?.current : event.homeScore?.current) ?? null,
  };
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("et-EE", {
    day: "numeric",
    month: "long",
  });
}

function formatShortDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("et-EE", {
    day: "2-digit",
    month: "2-digit",
  });
}

interface Countdown {
  d: number;
  h: number;
  m: number;
  s: number;
}

function useCountdown(targetTimestamp: number): Countdown | null {
  const [countdown, setCountdown] = useState<Countdown | null>(null);

  useEffect(() => {
    function tick() {
      const diff = targetTimestamp * 1000 - Date.now();
      if (diff <= 0) {
        setCountdown(null);
        return;
      }
      setCountdown({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  return countdown;
}

function TeamBlock({ flag, name }: { flag: string | null; name: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className="text-4xl leading-none" aria-hidden>
        {flag ?? "🏀"}
      </span>
      <span className="max-w-full truncate text-base font-semibold text-foreground">{name}</span>
    </div>
  );
}

function GameRow({ event }: { event: EstHoopEvent }) {
  const opponent = opponentName(event);
  const { est, opp } = estoniaScores(event);
  const played = est != null && opp != null;
  const won = played && est > opp;

  return (
    <div className="flex items-center gap-3 py-1.5 text-sm">
      <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-muted">
        {formatShortDate(event.startTimestamp)}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground">
        {countryFlag(opponent)} {opponent}
      </span>
      {played ? (
        <span
          className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
            won ? "text-positive" : "text-destructive"
          }`}
        >
          {est}–{opp}
        </span>
      ) : (
        <span className="shrink-0 text-xs text-muted">{isHome(event) ? "kodus" : "võõrsil"}</span>
      )}
    </div>
  );
}

function MiniGameList({ heading, events }: { heading: string; events: EstHoopEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="mt-auto border-t border-border/40 pt-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
        {heading}
      </p>
      <div className="divide-y divide-border/30">
        {events.map((event) => (
          <GameRow key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

function NextGameSection({ event }: { event: EstHoopEvent }) {
  const countdown = useCountdown(event.startTimestamp);
  const opponent = opponentName(event);

  return (
    <div className="flex flex-col items-center pt-2 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
        {event.tournament?.name ?? "Järgmine mäng"}
      </p>
      <div className="mt-4 flex w-full max-w-sm items-center gap-3">
        <TeamBlock flag={ESTONIA_FLAG} name="Eesti" />
        <span className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted">vs</span>
        <TeamBlock flag={countryFlag(opponent)} name={opponent} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {formatDate(event.startTimestamp)} · {isHome(event) ? "kodus" : "võõrsil"}
      </p>
      {countdown && (
        <div className="mt-5 flex justify-center gap-2">
          {[
            { v: countdown.d, l: "päeva" },
            { v: event.timeTBD ? null : countdown.h, l: "tundi" },
            { v: event.timeTBD ? null : countdown.m, l: "min" },
            { v: event.timeTBD ? null : countdown.s, l: "sek" },
          ].map(({ v, l }) => (
            <div
              key={l}
              className="w-16 rounded-lg border border-accent/30 bg-background px-2 py-2 text-center shadow-[0_0_16px_-4px_var(--accent)]"
            >
              <p className="font-mono text-3xl font-bold tracking-tight tabular-nums text-foreground">
                {v == null ? "--" : String(v).padStart(2, "0")}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">{l}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LastResultSection({ event }: { event: EstHoopEvent }) {
  const opponent = opponentName(event);
  const { est, opp } = estoniaScores(event);
  const won = est != null && opp != null && est > opp;

  return (
    <div className="flex flex-col items-center pt-2 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
        {event.tournament?.name ?? "Viimane tulemus"} · {formatDate(event.startTimestamp)}
      </p>
      <div className="mt-4 flex w-full max-w-sm items-center gap-3">
        <TeamBlock flag={ESTONIA_FLAG} name="Eesti" />
        <p
          className={`shrink-0 font-mono text-4xl font-bold tracking-tight tabular-nums ${
            won ? "text-positive" : "text-destructive"
          }`}
        >
          {est}–{opp}
        </p>
        <TeamBlock flag={countryFlag(opponent)} name={opponent} />
      </div>
      <p
        className={`mt-2 text-xs font-semibold uppercase tracking-wide ${
          won ? "text-positive" : "text-destructive"
        }`}
      >
        {won ? "Võit" : "Kaotus"}
      </p>
    </div>
  );
}

function PlayerPhoto({ slug, name }: { slug: string | null; name: string }) {
  const [extIndex, setExtIndex] = useState(0);

  if (!slug || extIndex >= PHOTO_EXTENSIONS.length) {
    const initials = name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-background">
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${ESTHOOP_FRONTEND_URL}/players/${slug}.${PHOTO_EXTENSIONS[extIndex]}`}
      alt={name}
      className="h-16 w-16 shrink-0 rounded-full object-cover object-top"
      onError={() => setExtIndex((i) => i + 1)}
    />
  );
}

function TopScorerSection() {
  const { data, isLoading, error } = useEstHoopTopScorer();

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (error) return <p className="text-sm text-destructive">Andmete laadimine ebaõnnestus.</p>;
  if (!data) return <p className="text-sm text-muted">Statistika pole veel saadaval.</p>;

  return (
    <div className="flex items-center gap-4">
      <PlayerPhoto slug={data.slug} name={data.name} />
      <div>
        <p className="text-sm font-semibold text-foreground">{data.name}</p>
        <div className="mt-1 flex gap-3 text-sm">
          <p>
            <span className="font-mono text-base font-semibold tabular-nums text-foreground">{data.pts}</span>{" "}
            <span className="text-muted">PTS</span>
          </p>
          <p>
            <span className="font-mono text-base font-semibold tabular-nums text-foreground">{data.ast}</span>{" "}
            <span className="text-muted">AST</span>
          </p>
          <p>
            <span className="font-mono text-base font-semibold tabular-nums text-foreground">{data.reb}</span>{" "}
            <span className="text-muted">REB</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function LastGameTab() {
  const { data, isLoading, error } = useEstHoopGames();

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (error || !data) return <p className="text-sm text-destructive">EstHoop andmete laadimine ebaõnnestus.</p>;

  const lastGame = data.recent[0];

  return (
    <div className="flex h-full flex-col gap-4">
      {lastGame ? (
        <LastResultSection event={lastGame} />
      ) : (
        <p className="text-sm text-muted">Viimast tulemust pole veel.</p>
      )}
      <div className="border-t border-border/40 pt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
          Tippmängija
        </p>
        <TopScorerSection />
      </div>
      <MiniGameList heading="Eelmised mängud" events={data.recent.slice(1, 4)} />
    </div>
  );
}

function NextGameTab() {
  const { data, isLoading, error } = useEstHoopGames();

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (error || !data) return <p className="text-sm text-destructive">EstHoop andmete laadimine ebaõnnestus.</p>;

  return (
    <div className="flex h-full flex-col gap-4">
      {data.upcoming[0] ? (
        <NextGameSection event={data.upcoming[0]} />
      ) : (
        <p className="text-sm text-muted">Hetkel ühtegi planeeritud mängu.</p>
      )}
      <MiniGameList heading="Tulevased mängud" events={data.upcoming.slice(1, 4)} />
    </div>
  );
}

export function EstHoopWidget() {
  const [tab, setTab] = useState<Tab>("next");

  return (
    <Card>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={Basketball} href="https://est-hoop.vercel.app/koondis">
          EstHoop
        </WidgetTitle>
        <div className="flex gap-1">
          <TabButton className="w-24" active={tab === "next"} onClick={() => setTab("next")}>
            Mäng
          </TabButton>
          <TabButton className="w-24" active={tab === "last"} onClick={() => setTab("last")}>
            Viimane mäng
          </TabButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tab === "next" ? <NextGameTab /> : <LastGameTab />}
      </div>
    </Card>
  );
}
