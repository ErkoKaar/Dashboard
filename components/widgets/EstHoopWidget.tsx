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
const PHOTO_EXTENSIONS = ["jpg", "png"];
const ESTONIA_FLAG = "🇪🇪";

type Tab = "next" | "last";

function opponentName(event: EstHoopEvent): string {
  return event.homeTeam.name === "Estonia" ? event.awayTeam.name : event.homeTeam.name;
}

function isHome(event: EstHoopEvent): boolean {
  return event.homeTeam.name === "Estonia";
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("et-EE", {
    day: "numeric",
    month: "long",
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

function NextGameSection({ event }: { event: EstHoopEvent }) {
  const countdown = useCountdown(event.startTimestamp);
  const opponent = opponentName(event);

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <p className="mb-1.5 text-xs text-muted">Järgmine mäng</p>
      <p className="mb-4 text-lg font-semibold text-foreground">
        {ESTONIA_FLAG} Eesti <span className="font-normal text-muted">vs</span>{" "}
        {countryFlag(opponent)} {opponent}
        <span className="block text-sm font-normal text-muted">
          {formatDate(event.startTimestamp)}
          {!isHome(event) && " · võõrsil"}
        </span>
      </p>
      {countdown && (
        <div className="flex justify-center gap-2">
          {[
            { v: countdown.d, l: "päeva" },
            { v: event.timeTBD ? null : countdown.h, l: "tundi" },
            { v: event.timeTBD ? null : countdown.m, l: "min" },
            { v: event.timeTBD ? null : countdown.s, l: "sek" },
          ].map(({ v, l }) => (
            <div
              key={l}
              className="rounded-lg border border-accent/30 bg-background px-3 py-2 text-center shadow-[0_0_16px_-4px_var(--accent)]"
            >
              <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                {v == null ? "--" : String(v).padStart(2, "0")}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-muted">{l}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LastResultSection({ event }: { event: EstHoopEvent }) {
  const opponent = opponentName(event);
  const home = isHome(event);
  const estScore = home ? event.homeScore?.current : event.awayScore?.current;
  const oppScore = home ? event.awayScore?.current : event.homeScore?.current;
  const won = estScore != null && oppScore != null && estScore > oppScore;

  return (
    <div>
      <p className="mb-2 text-xs text-muted">Viimane tulemus</p>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm">
            {ESTONIA_FLAG} Eesti <span className="text-muted">vs</span> {countryFlag(opponent)}{" "}
            {opponent}
          </p>
          <p className="text-xs text-muted">{formatDate(event.startTimestamp)}</p>
        </div>
        <p
          className={`font-mono text-lg font-semibold ${won ? "text-positive" : "text-destructive"}`}
        >
          {estScore}–{oppScore}
        </p>
      </div>
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
            <span className="font-mono font-semibold text-foreground">{data.pts}</span>{" "}
            <span className="text-muted">PTS</span>
          </p>
          <p>
            <span className="font-mono font-semibold text-foreground">{data.ast}</span>{" "}
            <span className="text-muted">AST</span>
          </p>
          <p>
            <span className="font-mono font-semibold text-foreground">{data.reb}</span>{" "}
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
    <div className="space-y-4">
      {lastGame ? (
        <LastResultSection event={lastGame} />
      ) : (
        <p className="text-sm text-muted">Viimast tulemust pole veel.</p>
      )}
      <div>
        <p className="mb-2 text-xs text-muted">Tippmängija</p>
        <TopScorerSection />
      </div>
    </div>
  );
}

function NextGameTab() {
  const { data, isLoading, error } = useEstHoopGames();

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (error || !data) return <p className="text-sm text-destructive">EstHoop andmete laadimine ebaõnnestus.</p>;

  return data.upcoming[0] ? (
    <NextGameSection event={data.upcoming[0]} />
  ) : (
    <p className="text-sm text-muted">Hetkel ühtegi planeeritud mängu.</p>
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
          <TabButton active={tab === "next"} onClick={() => setTab("next")}>
            Mäng
          </TabButton>
          <TabButton active={tab === "last"} onClick={() => setTab("last")}>
            Viimane mäng
          </TabButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "next" ? <NextGameTab /> : <LastGameTab />}
      </div>
    </Card>
  );
}
