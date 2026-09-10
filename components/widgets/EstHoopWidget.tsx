"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { Basketball } from "@/components/ui/icons/Basketball";
import { EstHoopEvent, useEstHoopGames, useEstHoopTopScorer } from "@/lib/queries/useEstHoopGames";
import {
  ClubResult,
  ClubScheduleGame,
  useEstHoopClubResults,
  useEstHoopClubSchedule,
} from "@/lib/queries/useEstHoopClub";
import { countryFlag } from "@/lib/countryFlags";

// Player photos are served as static assets from the EstHoop frontend deploy,
// keyed by slug — see frontend/src/components/PlayerAvatar.jsx in that repo.
const ESTHOOP_FRONTEND_URL = "https://est-hoop.vercel.app";
const PHOTO_EXTENSIONS = ["webp", "jpg", "png"];
const ESTONIA_FLAG = "🇪🇪";

type Tab = "next" | "last" | "schedule" | "results";

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

// Klubiridade kuupäev tuleb serverist juba õiges vööndis ISO stringina, nii et
// siin pole ajavööndi arvutust vaja: "2026-09-19" -> "19.09".
function formatIsoDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}.${month}`;
}

function formatClubTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString("et-EE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Tallinn",
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

// Väiksem variant kannab rõngast, mis teeb kaks tööd korraga: annab üksikule
// näole selge serva ja eraldab kõrvuti laotud näod klubis, kus mängijaid on mitu.
const PHOTO_SIZES = {
  sm: { box: "h-10 w-10", initials: "text-[10px]", ring: "ring-2 ring-background" },
  lg: { box: "h-16 w-16", initials: "text-sm", ring: "" },
} as const;

function PlayerPhoto({
  slug,
  name,
  size = "lg",
}: {
  slug: string | null;
  name: string;
  size?: keyof typeof PHOTO_SIZES;
}) {
  const [extIndex, setExtIndex] = useState(0);
  const { box, initials: initialsSize, ring } = PHOTO_SIZES[size];

  if (!slug || extIndex >= PHOTO_EXTENSIONS.length) {
    const initials = name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return (
      <div
        className={`flex ${box} ${ring} shrink-0 items-center justify-center rounded-full bg-accent ${initialsSize} font-semibold text-background`}
      >
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${ESTHOOP_FRONTEND_URL}/players/${slug}.${PHOTO_EXTENSIONS[extIndex]}`}
      alt={name}
      className={`${box} ${ring} shrink-0 rounded-full bg-surface object-cover object-top`}
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

const CLUB_ROW = "flex items-start gap-3 py-2.5 text-sm";

function ClubScheduleRow({ game }: { game: ClubScheduleGame }) {
  return (
    <div className={CLUB_ROW}>
      {/* Klubi, kus meie mängijaid on mitu, saab näod kõrvuti laotult. */}
      <div className="flex shrink-0 -space-x-3">
        {game.players.map((player) => (
          <PlayerPhoto key={player.slug} slug={player.slug} name={player.name} size="sm" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">
          {game.players.map((player) => player.name).join(", ")}
        </p>
        <p className="truncate text-xs text-muted">
          {game.club} {game.home ? "vs" : "@"} {game.opponent}
          {game.competition && ` · ${game.competition}`}
        </p>
      </div>
      <div className="shrink-0 text-right font-mono tabular-nums">
        <p className="text-sm font-semibold text-foreground">{formatIsoDay(game.date)}</p>
        <p className="text-xs text-muted">
          {game.startTimestamp == null ? "aeg selgub" : formatClubTime(game.startTimestamp)}
        </p>
      </div>
    </div>
  );
}

/** Protokolli number koos sildiga, sama käsitlus mis koondise tippmängijal. */
function StatPair({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;

  return (
    <p>
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{value}</span>{" "}
      <span className="text-[10px] text-muted">{label}</span>
    </p>
  );
}

function ClubResultRow({ result }: { result: ClubResult }) {
  // Värvi kannab ainult skoor; sõna "võit"/"kaotus" ütleb sama ka siis, kui
  // värvi ei eristata.
  const outcome =
    result.won == null ? "text-foreground" : result.won ? "text-positive" : "text-destructive";

  const row = (
    <>
      <PlayerPhoto slug={result.slug} name={result.player} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{result.player}</p>
        <p className="truncate text-xs text-muted">
          {result.club ?? "Klubi teadmata"} {result.home ? "vs" : "@"} {result.opponent}
          {result.league && ` · ${result.league}`}
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
          <StatPair value={result.pts} label="PTS" />
          <StatPair value={result.reb} label="REB" />
          <StatPair value={result.ast} label="AST" />
          <StatPair value={result.min} label="MIN" />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-[10px] tabular-nums text-muted">{formatIsoDay(result.date)}</p>
        <p className={`font-mono text-base font-semibold tabular-nums ${outcome}`}>
          {result.own}–{result.against}
        </p>
        {result.won != null && (
          <p className={`text-[10px] ${outcome}`}>{result.won ? "võit" : "kaotus"}</p>
        )}
      </div>
    </>
  );

  // Protokolli link annab hover-olekule sisu; vanematel ridadel URL puudub.
  if (!result.gameUrl) return <div className={CLUB_ROW}>{row}</div>;

  return (
    <a
      href={result.gameUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${CLUB_ROW} rounded-lg transition-colors duration-200 hover:bg-surface-hover/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
    >
      {row}
    </a>
  );
}

function ClubScheduleTab() {
  const { data, isLoading, error } = useEstHoopClubSchedule();

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (error || !data)
    return <p className="text-sm text-destructive">Klubigraafiku laadimine ebaõnnestus.</p>;
  if (data.length === 0)
    return <p className="text-sm text-muted">Ühtki tulevast klubimängu graafikus pole.</p>;

  return (
    <div className="divide-y divide-border/30">
      {data.map((game) => (
        <ClubScheduleRow key={game.id} game={game} />
      ))}
    </div>
  );
}

function ClubResultsTab() {
  const { data, isLoading, error } = useEstHoopClubResults();

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (error || !data)
    return <p className="text-sm text-destructive">Klubitulemuste laadimine ebaõnnestus.</p>;
  if (data.length === 0)
    return <p className="text-sm text-muted">Klubimängude tulemusi veel pole.</p>;

  return (
    <div className="divide-y divide-border/30">
      {data.map((result) => (
        <ClubResultRow key={result.id} result={result} />
      ))}
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
      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-y-2">
        <WidgetTitle icon={Basketball} href="https://est-hoop.vercel.app/koondis">
          EstHoop
        </WidgetTitle>
        {/* Hiusjoon eraldab koondise tabid klubikorvpalli omadest. */}
        <div className="flex items-center gap-1">
          <TabButton active={tab === "next"} onClick={() => setTab("next")}>
            Mäng
          </TabButton>
          <TabButton active={tab === "last"} onClick={() => setTab("last")}>
            Viimane mäng
          </TabButton>
          <span className="mx-1 h-3 w-px shrink-0 bg-border/60" aria-hidden />
          <TabButton active={tab === "schedule"} onClick={() => setTab("schedule")}>
            Ajakava
          </TabButton>
          <TabButton active={tab === "results"} onClick={() => setTab("results")}>
            Tulemused
          </TabButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tab === "next" && <NextGameTab />}
        {tab === "last" && <LastGameTab />}
        {tab === "schedule" && <ClubScheduleTab />}
        {tab === "results" && <ClubResultsTab />}
      </div>
    </Card>
  );
}
