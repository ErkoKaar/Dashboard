"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { NbaGame, NbaPlayerLine, NbaTeamBox, useNbaBoxscore } from "@/lib/queries/useNba";
import { TeamLogo } from "./media";

type StatLine = Omit<NbaPlayerLine, "id" | "name" | "shortName" | "position" | "headshot" | "starter" | "didNotPlay">;

function formatPlusMinus(value: number | null): string {
  if (value === null) return "-";
  return value > 0 ? `+${value}` : String(value);
}

const COLUMNS: { label: string; title: string; value: (line: StatLine) => string; strong?: boolean }[] = [
  { label: "MIN", title: "Minutid", value: (l) => String(l.min) },
  { label: "PTS", title: "Punktid", value: (l) => String(l.pts), strong: true },
  { label: "REB", title: "Lauapallid", value: (l) => String(l.reb) },
  { label: "AST", title: "Resultatiivsed söödud", value: (l) => String(l.ast) },
  { label: "STL", title: "Vaheltlõiked", value: (l) => String(l.stl) },
  { label: "BLK", title: "Blokid", value: (l) => String(l.blk) },
  { label: "FG", title: "Väljakuvisked tabatud-visatud", value: (l) => `${l.fgm}-${l.fga}` },
  { label: "3P", title: "Kolmesed tabatud-visatud", value: (l) => `${l.tpm}-${l.tpa}` },
  { label: "FT", title: "Vabavisked tabatud-visatud", value: (l) => `${l.ftm}-${l.fta}` },
  { label: "TO", title: "Pallikaotused", value: (l) => String(l.tov) },
  { label: "+/-", title: "Plussid-miinused", value: (l) => formatPlusMinus(l.plusMinus) },
];

// Tiimi kokkuvõte mängijate summana; +/- ja minutid pole kokku liidetuna mõtestatud.
function teamTotals(players: NbaPlayerLine[]): StatLine {
  const sum = (pick: (p: NbaPlayerLine) => number) => players.reduce((total, p) => total + pick(p), 0);
  return {
    min: Number.NaN,
    pts: sum((p) => p.pts),
    reb: sum((p) => p.reb),
    ast: sum((p) => p.ast),
    stl: sum((p) => p.stl),
    blk: sum((p) => p.blk),
    tov: sum((p) => p.tov),
    pf: sum((p) => p.pf),
    fgm: sum((p) => p.fgm),
    fga: sum((p) => p.fga),
    tpm: sum((p) => p.tpm),
    tpa: sum((p) => p.tpa),
    ftm: sum((p) => p.ftm),
    fta: sum((p) => p.fta),
    plusMinus: null,
  };
}

// Kleepuv nimeveerg vajab läbipaistmatut tausta, muidu kerivad numbrid selle alt läbi.
// Sama värv on kogu tabelil (SURFACE), et veerg ei paistaks eraldi plokina.
const SURFACE = "bg-[rgb(10_18_23)]";
const STICKY_CELL = `sticky left-0 z-[1] ${SURFACE}`;

function TeamTable({ team }: { team: NbaTeamBox }) {
  const played = team.players.filter((p) => !p.didNotPlay);
  const benched = team.players.filter((p) => p.didNotPlay);
  const benchStart = played.findIndex((p) => !p.starter);
  const totals = teamTotals(played);

  return (
    <div>
      <h4 className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
        <TeamLogo src={team.logo} size={18} />
        {team.name}
      </h4>
      <div className={`overflow-x-auto rounded-xl ring-1 ring-white/[0.06] ${SURFACE}`}>
        <table className="w-full min-w-[40rem] text-xs tabular-nums">
          <thead>
            <tr className="text-muted">
              <th scope="col" className={`${STICKY_CELL} py-2 pl-3 pr-2 text-left font-medium`}>
                Mängija
              </th>
              {COLUMNS.map((column) => (
                <th key={column.label} scope="col" className="px-2 py-2 text-right font-medium">
                  <abbr title={column.title} className="no-underline">
                    {column.label}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {played.map((player, i) => (
              <tr
                key={player.id}
                // Alustajate ja vahetuste vahel tugevam joon.
                className={`border-t ${i === benchStart && i > 0 ? "border-white/20" : "border-white/[0.05]"}`}
              >
                <th scope="row" className={`${STICKY_CELL} whitespace-nowrap py-1.5 pl-3 pr-2 text-left font-normal text-foreground`}>
                  {player.shortName}
                  {player.position && <span className="ml-1.5 text-muted/70">{player.position}</span>}
                </th>
                {COLUMNS.map((column) => (
                  <td
                    key={column.label}
                    className={`whitespace-nowrap px-2 py-1.5 text-right ${column.strong ? "font-medium text-foreground" : "text-foreground/75"}`}
                  >
                    {column.value(player)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/20 text-muted">
              <th scope="row" className={`${STICKY_CELL} py-2 pl-3 pr-2 text-left font-medium`}>
                Kokku
              </th>
              {COLUMNS.map((column) => (
                <td key={column.label} className="whitespace-nowrap px-2 py-2 text-right font-medium">
                  {column.label === "MIN" || column.label === "+/-" ? "" : column.value(totals)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {benched.length > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Ei mänginud: {benched.map((p) => p.shortName).join(", ")}
        </p>
      )}
    </div>
  );
}

export function NbaBoxscore({ game }: { game: NbaGame }) {
  const { data, isPending, isFetching, refetch } = useNbaBoxscore(game.id, game.completed);

  if (data) {
    if (data.teams.length === 0) {
      return <p className="py-2 text-sm text-muted">Boxscore pole veel saadaval.</p>;
    }
    return (
      <div className="flex flex-col gap-5">
        {data.teams.map((team) => (
          <TeamTable key={team.id} team={team} />
        ))}
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-2" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <p className="text-sm text-muted">Boxscore&apos;i ei saanud laadida.</p>
      <Button variant="ghost" onClick={() => refetch()} disabled={isFetching} className="!px-3 !py-1.5 text-xs">
        <RotateCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
        Proovi uuesti
      </Button>
    </div>
  );
}
