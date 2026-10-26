"use client";

import { ReactNode, useState } from "react";
import { Play, RotateCw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { NbaLeaderMetric, NbaPerformance, NbaPeriod, NbaStatLine, useNbaLeaders } from "@/lib/queries/useNba";
import { useRecapPlayer } from "./RecapPlayer";
import { LeagueConfig, useLeague } from "./league";
import { Avatar, cardBackground, CountUpNumber, Cutout, StatGrid } from "./shared";

// esthoop.ee "Parimad sooritused" eeskujul: nr 1 on kangelaskaart, 2-3 tiimivärvi kaardid,
// 4-10 read. Igal real täis statistikariba; kõik numbrid on ühe mängu täisarvud.

const METRICS: NbaLeaderMetric[] = ["eff", "pts", "reb", "ast"];

// Efektiivsuse nimi sõltub liigast (NBA: EFF, EuroLeague: PIR).
function metricLabel(metric: NbaLeaderMetric, league: LeagueConfig): string {
  return metric === "eff" ? league.effLabel : metric.toUpperCase();
}

function signed(value: number | null): string {
  if (value === null) return "-";
  return value > 0 ? `+${value}` : String(value);
}

const STRIP: { label: string; title: string; metric?: NbaLeaderMetric; value: (s: NbaStatLine) => string }[] = [
  { label: "MIN", title: "Minutid", value: (s) => String(s.min) },
  { label: "PTS", title: "Punktid", metric: "pts", value: (s) => String(s.pts) },
  { label: "FG", title: "Väljakuvisked tabatud-visatud", value: (s) => `${s.fgm}-${s.fga}` },
  { label: "3P", title: "Kolmesed tabatud-visatud", value: (s) => `${s.tpm}-${s.tpa}` },
  { label: "FT", title: "Vabavisked tabatud-visatud", value: (s) => `${s.ftm}-${s.fta}` },
  { label: "REB", title: "Lauapallid", metric: "reb", value: (s) => String(s.reb) },
  { label: "AST", title: "Resultatiivsed söödud", metric: "ast", value: (s) => String(s.ast) },
  { label: "STL", title: "Vaheltlõiked", value: (s) => String(s.stl) },
  { label: "BLK", title: "Blokid", value: (s) => String(s.blk) },
  { label: "TO", title: "Pallikaotused", value: (s) => String(s.tov) },
  { label: "PF", title: "Isiklikud vead", value: (s) => String(s.pf) },
  { label: "EFF", title: "Efektiivsus", metric: "eff", value: (s) => String(s.eff) },
  { label: "+/-", title: "Plussid-miinused", value: (s) => signed(s.plusMinus) },
];

function formatDay(gameDay: string): string {
  return new Date(`${gameDay}T12:00:00Z`).toLocaleDateString("et-EE", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * "Võit 132:123 @ UTAH, 25. okt". Motion Stationi video olemasolul avab videoakna,
 * muidu viib ESPN-i mänguülevaatele, kui see on olemas.
 */
function GameResult({ performance, className = "" }: { performance: NbaPerformance; className?: string }) {
  const openRecap = useRecapPlayer();
  const { won, teamScore, opponentScore, clip } = performance;
  const content = (
    <>
      {won !== null && <span className={won ? "text-positive" : "text-destructive"}>{won ? "Võit" : "Kaotus"}</span>}
      {teamScore !== null && opponentScore !== null && (
        <span className="font-semibold tabular-nums text-foreground">
          {teamScore}:{opponentScore}
        </span>
      )}
      <span className="text-muted">
        {performance.home ? "vs" : "@"} {performance.opponent}, {formatDay(performance.gameDay)}
      </span>
    </>
  );
  const base = `inline-flex flex-wrap items-baseline gap-x-1.5 text-xs leading-snug ${className}`;
  const interactive = `${base} rounded decoration-white/40 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright`;

  if (clip) {
    return (
      <button type="button" onClick={() => openRecap(clip)} className={`${interactive} cursor-pointer`}>
        <span className="sr-only">Vaata mängu ülevaadet: </span>
        {content}
        <Play className="h-2.5 w-2.5 self-center fill-current text-muted" aria-hidden />
      </button>
    );
  }
  if (!performance.recapUrl) return <p className={base}>{content}</p>;
  return (
    <a href={performance.recapUrl} target="_blank" rel="noopener noreferrer" className={interactive}>
      <span className="sr-only">Mängu ülevaade: </span>
      {content}
    </a>
  );
}

// Telefonis 7 + 6 lahtrit kahel real (horisontaalset kerimist pole); 13 ühel real ainult siis,
// kui kaart on lai: md (kogu laius) ja 2xl (veerg on üle 560 px).
function StatStrip({ stats, metric }: { stats: NbaStatLine; metric: NbaLeaderMetric }) {
  const league = useLeague();
  return (
    <StatGrid
      columns="grid-cols-7 md:grid-cols-[repeat(13,minmax(0,1fr))] lg:grid-cols-7 2xl:grid-cols-[repeat(13,minmax(0,1fr))]"
      cells={STRIP.map((cell) => ({
        label: cell.metric === "eff" ? league.effLabel : cell.label,
        title: cell.metric === "eff" ? league.effTitle : cell.title,
        value: cell.value(stats),
        active: cell.metric === metric,
      }))}
    />
  );
}

function PodiumCard({
  performance,
  rank,
  metric,
  featured,
  delay,
}: {
  performance: NbaPerformance;
  rank: number;
  metric: NbaLeaderMetric;
  featured: boolean;
  delay: number;
}) {
  const league = useLeague();
  const { player, team, stats } = performance;

  return (
    <article
      className="animate-rise-in relative isolate overflow-hidden rounded-2xl text-white shadow-[0_24px_48px_-24px_rgb(0_5_8/0.75)] ring-1 ring-white/10"
      style={{ ...cardBackground(team.color), animationDelay: `${delay}ms` }}
    >
      <div className={`relative flex flex-col justify-between ${featured ? "min-h-[14rem] p-5 sm:min-h-[16rem]" : "min-h-[8.5rem] p-4"}`}>
        {/* Kontuuriga koht ja mängija väljalõige on dekoratiivsed: koht on ka loetavana olemas (sr-only). */}
        <span
          className={`pointer-events-none absolute bottom-0 select-none font-display font-bold leading-[0.78] text-transparent [-webkit-text-stroke:1.5px_rgb(255_255_255/0.28)] [font-stretch:75%] ${
            featured ? "right-[44%] text-[11rem]" : "right-[34%] text-[7rem]"
          }`}
          aria-hidden
        >
          {rank}
        </span>
        {player.headshot && <Cutout key={player.headshot} src={player.headshot} size={featured ? "lg" : "sm"} />}

        <div className="relative">
          <span className="sr-only">{rank}. koht, </span>
          <p
            className={`font-display font-bold leading-[0.82] tracking-[-0.02em] tabular-nums [font-stretch:75%] ${
              featured ? "text-[5.5rem]" : "text-5xl"
            }`}
          >
            {featured ? <CountUpNumber value={stats[metric]} /> : stats[metric]}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold text-white/75">{metricLabel(metric, league)}</p>
        </div>

        <div className={`relative drop-shadow-[0_1px_8px_rgb(0_0_0/0.35)] ${featured ? "mt-6 max-w-[62%]" : "mt-3 max-w-[60%]"}`}>
          <h3
            className={`font-display font-bold leading-[0.95] tracking-[-0.02em] [font-stretch:78%] ${
              featured ? "text-3xl sm:text-4xl" : "text-xl"
            }`}
          >
            {player.name}
          </h3>
          <p className="mt-1 text-xs text-white/80">
            {team.name}
            {player.position && <span className="text-white/60"> {player.position}</span>}
          </p>
        </div>
      </div>

      <div className="relative flex flex-col gap-3 bg-[rgb(5_9_12/0.88)] p-3 sm:p-4">
        <GameResult performance={performance} />
        <StatStrip stats={stats} metric={metric} />
      </div>
    </article>
  );
}

function PerformanceRow({ performance, rank, metric }: { performance: NbaPerformance; rank: number; metric: NbaLeaderMetric }) {
  const { player, team } = performance;
  return (
    <li className="flex flex-col gap-3 py-4">
      {/* Telefonis läheb tulemus nime alla omaette reale (pl = koht 24 + vahe 12 + avatar 44 + vahe 12 px),
          muidu jääks nimele paar tähte. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-6 shrink-0 font-display text-xl font-semibold tabular-nums text-muted [font-stretch:80%]">
          <span className="sr-only">Koht </span>
          {rank}
        </span>
        <Avatar key={player.headshot ?? player.id} headshot={player.headshot} color={team.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            <span className="sm:hidden">{player.shortName}</span>
            <span className="hidden sm:inline">{player.name}</span>
          </p>
          <p className="truncate text-xs text-muted">
            {team.name}
            {player.position && <span className="text-muted/70"> {player.position}</span>}
          </p>
        </div>
        <GameResult
          performance={performance}
          className="w-full pl-[5.75rem] sm:ml-auto sm:w-auto sm:max-w-[45%] sm:justify-end sm:pl-0 sm:text-right"
        />
      </div>
      <StatStrip stats={performance.stats} metric={metric} />
    </li>
  );
}

function TopSkeleton({ slow }: { slow: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton className="h-[22rem] w-full rounded-2xl" />
        <Skeleton className="h-[15rem] w-full rounded-2xl" />
        <Skeleton className="h-[15rem] w-full rounded-2xl" />
      </div>
      {slow && (
        <p className="text-xs text-muted">
          Pika vahemiku esmakordne kokkuarvutus võtab kuni minuti, edaspidi tuleb see vahemälust.
        </p>
      )}
    </div>
  );
}

export function NbaLeadersCard({ period }: { period: NbaPeriod }) {
  const league = useLeague();
  const { data, isPending, isFetching, isPlaceholderData, refetch } = useNbaLeaders(period, league.id);
  const [metric, setMetric] = useState<NbaLeaderMetric>("eff");
  const top = data?.top[metric] ?? [];

  let body: ReactNode;
  if (data && top.length > 0) {
    const [first, ...rest] = top;
    const podium = rest.slice(0, 2);
    const others = rest.slice(2);
    body = (
      <div className={`transition-opacity duration-200 ${isPlaceholderData ? "opacity-50" : ""}`}>
        {/* Kaardid tõusevad sisse ainult skeletoni asemele tulles. Võti on koht, mitte mängija:
            sorteerimisel (kümneid kordi) vahetub sisu paigal, kaardid ei hakka uuesti liikuma. */}
        <div className="flex flex-col gap-3">
          <PodiumCard performance={first} rank={1} metric={metric} featured delay={0} />
          {podium.map((performance, i) => (
            <PodiumCard
              key={i + 2}
              performance={performance}
              rank={i + 2}
              metric={metric}
              featured={false}
              delay={(i + 1) * 70}
            />
          ))}
        </div>
        {others.length > 0 && (
          <ol className="mt-2 divide-y divide-white/[0.06]">
            {others.map((performance, i) => (
              <PerformanceRow
                key={`${performance.player.id}-${performance.gameId}`}
                performance={performance}
                rank={i + 4}
                metric={metric}
              />
            ))}
          </ol>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-muted/70">
          Igalt mängijalt tema parim mäng selles vahemikus. Arvestatud {data.gamesCounted}/{data.gamesTotal} lõppenud
          mängu{league.leadersNote ? `, ${league.leadersNote}` : "."}
        </p>
      </div>
    );
  } else if (data) {
    body = <p className="text-sm text-muted">Selles vahemikus pole veel ühtki mängu lõppenud.</p>;
  } else if (isPending) {
    body = <TopSkeleton slow={period === "30d" || period === "season"} />;
  } else {
    body = (
      <div className="flex flex-col items-start gap-4">
        <div>
          <p className="text-sm text-foreground">Statistikat ei saanud laadida.</p>
          <p className="mt-1 text-xs text-muted">Andmeallika liides võis muutuda või on ajutiselt maas.</p>
        </div>
        <Button variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RotateCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
          Proovi uuesti
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <WidgetTitle icon={Trophy}>Parimad sooritused</WidgetTitle>
        <div role="group" aria-label="Järjesta" className="-mr-2 flex">
          {METRICS.map((key) => (
            <TabButton key={key} active={metric === key} onClick={() => setMetric(key)}>
              {metricLabel(key, league)}
            </TabButton>
          ))}
        </div>
      </div>
      {body}
    </Card>
  );
}
