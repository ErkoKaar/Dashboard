"use client";

import { ReactNode } from "react";
import { ChevronDown, ChevronUp, ListOrdered, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { League, NbaStandingsGroup, NbaStandingsRow, useNbaStandings } from "@/lib/queries/useNba";
import { LeagueConfig, useLeague } from "./league";
import { TeamLogo } from "./media";

// Põhiturniiri tabel. Tsoonid tulevad liigalt (NBA ja EuroLeague: 1-6 play-off, 7-10 play-in; Est-Lat:
// 1-8 play-off; Europe Cup: 1-2 edasi): täisjoon play-off'i ja katkendjoon play-in'i piiril, kohanumbri
// heledus kordab sama tsooni. NBA-l kaks konverentsi kõrvuti, Europe Cupis Eesti klubide grupid.

type Zones = LeagueConfig["standingsZones"];

function winPct({ wins, losses }: NbaStandingsRow): string {
  const games = wins + losses;
  if (games === 0) return "-";
  // Korvpalli tava: ".857", kõik võidud "1.000".
  return wins === games ? "1.000" : (wins / games).toFixed(3).slice(1);
}

function signed(value: number | null): string {
  if (value === null) return "-";
  return value > 0 ? `+${value}` : String(value);
}

/** ESPN-i "W3" / "L2" eesti keeles: V3 / K2. */
function Streak({ value }: { value: string | null }) {
  const match = value?.match(/^([WL])(\d+)$/);
  if (!match) return <>-</>;
  const won = match[1] === "W";
  return (
    <span className={won ? "text-positive" : "text-destructive"}>
      {won ? "V" : "K"}
      {match[2]}
    </span>
  );
}

/** Viimased mängud täppidena, uusim paremal: võit täidetud, kaotus rõngas (ei sõltu ainult värvist). */
function Form({ form }: { form: NbaStandingsRow["form"] }) {
  if (!form) return <>-</>;
  const spoken = form.map((result) => (result === "W" ? "V" : "K")).join(" ");
  return (
    <span role="img" aria-label={`Viimased ${form.length} mängu, uusim viimasena: ${spoken}`} className="inline-flex gap-1">
      {form.map((result, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${result === "W" ? "bg-positive" : "ring-1 ring-inset ring-destructive/80"}`}
        />
      ))}
    </span>
  );
}

interface Column {
  label: string;
  title: string;
  value: (row: NbaStandingsRow) => ReactNode;
  strong?: boolean;
}

const RECORD: Column = { label: "V-K", title: "Võidud-kaotused", value: (r) => `${r.wins}-${r.losses}`, strong: true };
const PCT: Column = { label: "%", title: "Võiduprotsent", value: winPct };
const HOME: Column = { label: "Kodus", title: "Bilanss kodus", value: (r) => r.home ?? "-" };
const AWAY: Column = { label: "Võõrsil", title: "Bilanss võõrsil", value: (r) => r.away ?? "-" };

const COLUMNS: Record<League, Column[]> = {
  nba: [
    RECORD,
    PCT,
    { label: "GB", title: "Mänge liidrist maas", value: (r) => r.gamesBehind ?? "-" },
    HOME,
    AWAY,
    { label: "L10", title: "Viimased 10 mängu", value: (r) => r.lastTen ?? "-" },
    { label: "Seeria", title: "Võidud või kaotused järjest", value: (r) => <Streak value={r.streak} /> },
  ],
  euroleague: [
    RECORD,
    PCT,
    { label: "+/-", title: "Punktide vahe", value: (r) => signed(r.pointDiff) },
    HOME,
    AWAY,
    { label: "Vorm", title: "Viimased 5 mängu, uusim paremal", value: (r) => <Form form={r.form} /> },
  ],
  estlat: [
    RECORD,
    PCT,
    { label: "+/-", title: "Punktide vahe", value: (r) => signed(r.pointDiff) },
    HOME,
    AWAY,
    { label: "Vorm", title: "Viimased 5 mängu, uusim paremal", value: (r) => <Form form={r.form} /> },
  ],
  // Kuni kolm 6 tiimiga gruppi kahes veerus: kitsas tabel, kodus/võõrsil bilanssi pole.
  europecup: [
    RECORD,
    { label: "+/-", title: "Punktide vahe", value: (r) => signed(r.pointDiff) },
    { label: "Vorm", title: "Viimased 5 mängu, uusim paremal", value: (r) => <Form form={r.form} /> },
  ],
};

function zoneTone(position: number, zones: Zones): string {
  if (position <= zones.playoff) return "text-foreground";
  if (zones.playIn !== null && position <= zones.playIn) return "text-foreground/65";
  return "text-muted/50";
}

function ChangeMark({ change }: { change: NbaStandingsRow["change"] }) {
  // Tühi pesa hoiab logod ühel joonel ka ilma noolega ridadel.
  if (!change) return <span className="w-3 shrink-0" aria-hidden />;
  const Icon = change === "up" ? ChevronUp : ChevronDown;
  return (
    <>
      <Icon className={`h-3 w-3 shrink-0 ${change === "up" ? "text-positive" : "text-destructive"}`} aria-hidden />
      <span className="sr-only">{change === "up" ? "tõusis" : "langes"}</span>
    </>
  );
}

// Kleepuv tiimiveerg vajab läbipaistmatut tausta nagu boxscore'is (sama värv kogu tabelil).
const SURFACE = "bg-[rgb(10_18_23)]";
const STICKY_CELL = `sticky left-0 z-[1] ${SURFACE}`;

function StandingsTable({ group, league, zones }: { group: NbaStandingsGroup; league: League; zones: Zones }) {
  const columns = COLUMNS[league];
  const showChange = league === "euroleague";

  return (
    // min-w-0: ruudustiku lahter ei veni tabeli laiuseks, kerimine jääb tabeli sisse.
    <section aria-label={group.name ?? "Tabel"} className="min-w-0">
      {group.name && (
        <h3 className="mb-2.5 font-display text-xl font-semibold tracking-[-0.02em] text-foreground [font-stretch:85%]">
          {group.name}
        </h3>
      )}
      <div className={`overflow-x-auto rounded-xl ring-1 ring-white/[0.06] ${SURFACE}`}>
        <table className="w-full min-w-[30rem] text-xs tabular-nums sm:text-[13px]">
          <thead>
            <tr className="text-muted">
              <th scope="col" className={`${STICKY_CELL} py-2 pl-3 pr-2 text-left font-medium`}>
                Tiim
              </th>
              {columns.map((column) => (
                <th key={column.label} scope="col" className="px-2 py-2 text-right font-medium last:pr-3">
                  <abbr title={column.title} className="no-underline">
                    {column.label}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row, i) => (
              <tr
                key={row.team.id}
                className={`border-t ${
                  i === zones.playoff
                    ? "border-white/25"
                    : i === zones.playIn
                      ? "border-dashed border-white/25"
                      : "border-white/[0.05]"
                }`}
              >
                <th scope="row" className={`${STICKY_CELL} py-2 pl-3 pr-3 text-left font-normal`}>
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-5 shrink-0 text-right font-display text-[15px] font-semibold [font-stretch:85%] ${zoneTone(row.position, zones)}`}
                    >
                      {row.position}
                    </span>
                    {showChange && <ChangeMark change={row.change} />}
                    <TeamLogo src={row.team.logo} size={20} />
                    <span className="whitespace-nowrap text-foreground" title={row.team.abbreviation}>
                      {row.team.name}
                    </span>
                  </span>
                </th>
                {columns.map((column) => (
                  <td
                    key={column.label}
                    className={`whitespace-nowrap px-2 py-2 text-right last:pr-3 ${
                      column.strong ? "font-medium text-foreground" : "text-foreground/75"
                    }`}
                  >
                    {column.value(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Mitme tabeliga liigad (laadimise vaheplokk ja kaardi laius): NBA konverentsid, Europe Cupis Eesti klubide grupid.
const TABLE_COUNT: Partial<Record<League, number>> = { nba: 2, europecup: 3 };

function StandingsSkeleton({ groups }: { groups: number }) {
  return (
    <div className={`grid gap-6 ${groups > 1 ? "lg:grid-cols-2" : ""}`} aria-hidden>
      {Array.from({ length: groups }, (_, g) => (
        <div key={g} className="flex flex-col gap-2">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StandingsCard() {
  const league = useLeague();
  const { data, isPending, isFetching, refetch } = useNbaStandings(league.id);

  let body: ReactNode;
  if (data && data.groups.length > 0) {
    body = (
      <>
        <div className={`grid items-start gap-6 ${data.groups.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {data.groups.map((group) => (
            <StandingsTable key={group.id} group={group} league={league.id} zones={league.standingsZones} />
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-muted/70">{league.standingsNote}</p>
      </>
    );
  } else if (data) {
    body = <p className="text-sm text-muted">Tabel ilmub pärast hooaja esimesi mänge.</p>;
  } else if (isPending) {
    body = <StandingsSkeleton groups={TABLE_COUNT[league.id] ?? 1} />;
  } else {
    body = (
      <div className="flex flex-col items-start gap-4">
        <div>
          <p className="text-sm text-foreground">Tabelit ei saanud laadida.</p>
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
    // Ühe tabeliga liigal jääks täislaiuses tabeli rida liiga pikaks: kaart on sisu laiune.
    <Card className={TABLE_COUNT[league.id] ? "" : "lg:max-w-[56rem]"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <WidgetTitle icon={ListOrdered}>Tabel</WidgetTitle>
        {data?.season && (
          <p className="text-xs tabular-nums text-muted">
            Hooaeg {data.season}
            {data.note && `, ${data.note}`}
          </p>
        )}
      </div>
      {body}
    </Card>
  );
}
