"use client";

import { ReactNode, RefObject, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Crown, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { NbaMvpEntry, useNbaMvpRace } from "@/lib/queries/useNba";
import { Avatar, cardBackground, CountUpNumber, Cutout, StatCell, StatGrid, teamToneCss } from "./shared";

// MVP race: hooaja 10 parimat EFF järgi. Iga mängija on vaikne rida, mille all joon näitab EFF-i
// liidriga võrreldes (ilma taustarajata: joon ise on võidujooks). Klõps avab rea asemel tiimivärvi
// kaardi; korraga on lahti üks, vaikimisi liider.

const avg = (value: number) => value.toFixed(1);
const percent = (value: number | null) => (value === null ? "-" : `${value}%`);

function cells(entry: NbaMvpEntry): StatCell[] {
  return [
    { label: "M", title: "Mänge", value: String(entry.games) },
    { label: "MIN", title: "Minutid mängus", value: avg(entry.min) },
    { label: "PTS", title: "Punktid mängus", value: avg(entry.pts) },
    { label: "REB", title: "Lauapallid mängus", value: avg(entry.reb) },
    { label: "AST", title: "Resultatiivsed söödud mängus", value: avg(entry.ast) },
    { label: "STL", title: "Vaheltlõiked mängus", value: avg(entry.stl) },
    { label: "BLK", title: "Blokid mängus", value: avg(entry.blk) },
    { label: "FG%", title: "Väljakuvisete tabavus", value: percent(entry.fgPct) },
    { label: "3P%", title: "Kolmeste tabavus", value: percent(entry.tpPct) },
    { label: "FT%", title: "Vabavisete tabavus", value: percent(entry.ftPct) },
    { label: "EFF", title: "Efektiivsus mängus (järjestuse alus)", value: avg(entry.eff), active: true },
  ];
}

function record(entry: NbaMvpEntry): string | null {
  const { wins, losses } = entry.team;
  return wins === null || losses === null ? null : `${wins}-${losses}`;
}

// Telefonis 6 + 5 lahtrit, alates sm (kaart on kogu laiuses) kõik 11 ühel real.
const STRIP_COLUMNS = "grid-cols-6 sm:grid-cols-11";

/**
 * Mängija tiimivärvi kaart. countUp ainult vaate esimesel avamisel (liider): klõpsuga avatud
 * kaardil on number kohe paigas, sest kasutaja tahab seda kohe lugeda.
 */
function PlayerCard({
  entry,
  rank,
  countUp,
  closeRef,
  onClose,
}: {
  entry: NbaMvpEntry;
  rank: number;
  countUp: boolean;
  closeRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const { player, team } = entry;
  const teamRecord = record(entry);
  return (
    <article
      className="animate-rise-in relative isolate overflow-hidden rounded-2xl text-white shadow-[0_24px_48px_-24px_rgb(0_5_8/0.75)] ring-1 ring-white/10"
      style={cardBackground(team.color)}
    >
      {/* Kogu kaart on sulgemisnupp (sisu on nupu all, nupp ise on tühi: kehtiv HTML). */}
      <button
        ref={closeRef}
        type="button"
        aria-expanded
        onClick={onClose}
        className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent-bright"
      >
        <span className="sr-only">Sulge {player.name} kaart</span>
      </button>
      <ChevronUp className="absolute right-4 top-4 z-[1] h-5 w-5 text-white/70" aria-hidden />

      <div className="relative flex min-h-[14rem] flex-col justify-between p-5 sm:min-h-[17rem] sm:p-6">
        <span
          className="pointer-events-none absolute bottom-0 right-[40%] select-none font-display text-[11rem] font-bold leading-[0.78] text-transparent [-webkit-text-stroke:1.5px_rgb(255_255_255/0.28)] [font-stretch:75%] sm:text-[14rem]"
          aria-hidden
        >
          {rank}
        </span>
        {player.headshot && <Cutout key={player.headshot} src={player.headshot} size="lg" />}

        <div className="relative">
          <span className="sr-only">{rank}. koht, </span>
          <p className="font-display text-[5.5rem] font-bold leading-[0.82] tracking-[-0.02em] tabular-nums [font-stretch:75%] sm:text-[6.5rem]">
            {countUp ? <CountUpNumber value={entry.eff} decimals={1} /> : avg(entry.eff)}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold text-white/75">EFF mängu kohta</p>
        </div>

        <div className="relative mt-6 max-w-[60%] drop-shadow-[0_1px_8px_rgb(0_0_0/0.35)]">
          <h3 className="font-display text-3xl font-bold leading-[0.95] tracking-[-0.02em] [font-stretch:78%] sm:text-5xl">
            {player.name}
          </h3>
          <p className="mt-1.5 text-sm text-white/80">
            {team.name}
            {teamRecord && <span className="tabular-nums text-white/60"> {teamRecord}</span>}
            {player.position && <span className="text-white/60"> {player.position}</span>}
          </p>
        </div>
      </div>
      <div className="relative bg-[rgb(5_9_12/0.88)] p-3 sm:p-4">
        <StatGrid columns={STRIP_COLUMNS} cells={cells(entry)} />
      </div>
    </article>
  );
}

function RaceRow({
  entry,
  rank,
  leaderEff,
  open,
  countUp,
  onToggle,
}: {
  entry: NbaMvpEntry;
  rank: number;
  leaderEff: number;
  open: boolean;
  countUp: boolean;
  onToggle: () => void;
}) {
  const { player, team } = entry;
  const teamRecord = record(entry);
  // Negatiivne või null EFF on hooaja alguses võimalik: joon jääb siis olemata.
  const share = leaderEff > 0 ? Math.max(0, Math.min(1, entry.eff / leaderEff)) : 0;

  // Rida ja kaart vahetavad teineteist, seega fookus tuleb ise üle viia: avades kaardile (focus kerib
  // selle ka vaatesse, kui eelmise kaardi sulgumine nimekirja nihutas), sulgedes tagasi reale.
  // Kui rida sulgub, sest avati teine mängija, fookust ei liigutata.
  const rowButton = useRef<HTMLButtonElement>(null);
  const cardButton = useRef<HTMLButtonElement>(null);
  const focusAfter = useRef<"card" | "row" | null>(null);
  useEffect(() => {
    if (focusAfter.current === "card" && open) cardButton.current?.focus();
    if (focusAfter.current === "row" && !open) rowButton.current?.focus();
    focusAfter.current = null;
  }, [open]);

  if (open) {
    return (
      <li className="py-2">
        <PlayerCard
          entry={entry}
          rank={rank}
          countUp={countUp}
          closeRef={cardButton}
          onClose={() => {
            focusAfter.current = "row";
            onToggle();
          }}
        />
      </li>
    );
  }

  return (
    // Nupu ::after katab kogu rea (li on relative), nii et klõps statistikaribal avab samuti kaardi.
    <li className="relative -mx-2 flex flex-col gap-3 rounded-xl px-2 py-4 transition-colors duration-200 hover:bg-white/[0.03] lg:flex-row lg:items-center lg:gap-6">
      <button
        ref={rowButton}
        type="button"
        aria-expanded={false}
        onClick={() => {
          focusAfter.current = "card";
          onToggle();
        }}
        className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg text-left after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-accent-bright lg:w-[17rem] lg:shrink-0"
      >
        <span className="w-7 shrink-0 font-display text-2xl font-semibold tabular-nums text-muted [font-stretch:80%]">
          <span className="sr-only">Koht </span>
          {rank}
        </span>
        <Avatar key={player.headshot ?? player.id} headshot={player.headshot} color={team.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            <span className="sm:hidden">{player.shortName}</span>
            <span className="hidden sm:inline">{player.name}</span>
          </span>
          <span className="block truncate text-xs text-muted">
            {team.name}
            {teamRecord && <span className="tabular-nums text-muted/80"> {teamRecord}</span>}
            {player.position && <span className="text-muted/70"> {player.position}</span>}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <StatGrid columns={STRIP_COLUMNS} cells={cells(entry)} />
      </div>
      <span
        className="absolute bottom-0 left-2 h-0.5 rounded-full opacity-80"
        style={{ width: `calc((100% - 1rem) * ${share})`, background: teamToneCss(team.color) }}
        aria-hidden
      />
    </li>
  );
}

function MvpSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-[20rem] w-full rounded-2xl" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto hidden h-12 flex-1 rounded-xl lg:block" />
        </div>
      ))}
    </div>
  );
}

export function NbaMvpRace() {
  const { data, isPending, isFetching, refetch } = useNbaMvpRace();
  // undefined = kasutaja pole veel klõpsanud: lahti on liider ja tema EFF loeb end üles.
  // null = kõik kaardid kinni.
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);

  let body: ReactNode;
  if (data && data.players.length > 0) {
    const leader = data.players[0];
    const activeId = openId === undefined ? leader.player.id : openId;
    body = (
      <>
        <ol>
          {data.players.map((entry, i) => (
            <RaceRow
              key={entry.player.id}
              entry={entry}
              rank={i + 1}
              leaderEff={leader.eff}
              open={entry.player.id === activeId}
              countUp={openId === undefined}
              onToggle={() => setOpenId(entry.player.id === activeId ? null : entry.player.id)}
            />
          ))}
        </ol>
        <p className="mt-4 text-[11px] leading-relaxed text-muted/70">
          Järjestus hooaja EFF järgi mängu kohta, ESPN-i kvalifitseerunud mängijad. Joon näitab EFF-i liidriga
          võrreldes. Ametlik NBA MVP edetabel on toimetuse hinnang ja võib sellest erineda.
        </p>
      </>
    );
  } else if (data) {
    body = <p className="text-sm text-muted">Hooaja statistikat veel pole.</p>;
  } else if (isPending) {
    body = <MvpSkeleton />;
  } else {
    body = (
      <div className="flex flex-col items-start gap-4">
        <div>
          <p className="text-sm text-foreground">MVP race&apos;i ei saanud laadida.</p>
          <p className="mt-1 text-xs text-muted">ESPN-i liides võis muutuda või on ajutiselt maas.</p>
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
        <WidgetTitle icon={Crown}>MVP race</WidgetTitle>
        {data?.season && <p className="text-xs tabular-nums text-muted">Hooaeg {data.season}</p>}
      </div>
      {body}
    </Card>
  );
}
