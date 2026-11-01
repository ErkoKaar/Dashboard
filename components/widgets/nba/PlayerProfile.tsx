"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { NbaPlayerProfile, NbaProfileGame, NbaSeasonAverages, useNbaPlayerProfile } from "@/lib/queries/useNba";
import { LeagueConfig, useLeague } from "./league";
import { cardBackground, Cutout, StatCell, StatGrid } from "./shared";

// Mängija profiil: avaneb mängija nimele vajutades (boxscore, parimad sooritused, parimad mängijad).
// Üks aken kogu liigavaate kohta nagu RecapPlayer. Päis tuleb kohe klõpsatud kohast (PlayerPreview), et
// aken poleks tühi, kuni profiil laeb; ülejäänu tuleb app/api/<liiga>/player route'ist.

export interface PlayerPreview {
  id: string;
  name: string;
  headshot: string | null;
  team: string | null;
  color: string | null;
}

type OpenProfile = (preview: PlayerPreview) => void;

const PlayerProfileContext = createContext<OpenProfile | null>(null);

export function usePlayerProfile(): OpenProfile {
  const open = useContext(PlayerProfileContext);
  if (!open) throw new Error("usePlayerProfile vajab PlayerProfileProvider'it");
  return open;
}

/** Mängija nimi nupuna, mis avab profiili. Välimus tuleb kutsujalt (className), nupp ise on nähtamatu. */
export function PlayerButton({
  preview,
  className = "",
  children,
}: {
  preview: PlayerPreview;
  className?: string;
  children: ReactNode;
}) {
  const open = usePlayerProfile();
  return (
    <button
      type="button"
      onClick={() => open(preview)}
      className={`cursor-pointer rounded text-left underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright ${className}`}
    >
      {children}
    </button>
  );
}

export function PlayerProfileProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // preview jääb alles ka pärast sulgemist, et väljumisanimatsiooni ajal sisu ei kaoks.
  const [preview, setPreview] = useState<PlayerPreview | null>(null);
  const [openCount, setOpenCount] = useState(0);

  const open = useCallback((next: PlayerPreview) => {
    setPreview(next);
    setOpenCount((count) => count + 1);
  }, []);

  // showModal pärast renderdust, et uus mängija oleks juba aknas. Sulgemisel taastab brauser fookuse
  // nupule, millelt aken avati.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (openCount > 0 && dialog && !dialog.open) dialog.showModal();
  }, [openCount]);

  return (
    <PlayerProfileContext.Provider value={open}>
      {children}
      <dialog
        ref={dialogRef}
        aria-label={preview ? `${preview.name}, profiil` : "Mängija profiil"}
        // Sisu täidab akna, seega dialoog ise saab klõpsu ainult taustalt.
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        className="profile-dialog border-0 bg-transparent p-0 text-foreground"
      >
        {preview && <ProfileBody key={preview.id} preview={preview} onClose={() => dialogRef.current?.close()} />}
      </dialog>
    </PlayerProfileContext.Provider>
  );
}

const avg = (value: number) => value.toFixed(1);
const percent = (value: number | null) => (value === null ? "-" : `${value}%`);

function seasonCells(season: NbaSeasonAverages, league: LeagueConfig): StatCell[] {
  return [
    { label: "M", title: "Mänge", value: String(season.games) },
    { label: "MIN", title: "Minutid mängus", value: avg(season.min) },
    { label: "PTS", title: "Punktid mängus", value: avg(season.pts) },
    { label: "REB", title: "Lauapallid mängus", value: avg(season.reb) },
    { label: "AST", title: "Resultatiivsed söödud mängus", value: avg(season.ast) },
    { label: "STL", title: "Vaheltlõiked mängus", value: avg(season.stl) },
    { label: "BLK", title: "Blokid mängus", value: avg(season.blk) },
    { label: "TO", title: "Pallikaotused mängus", value: avg(season.tov) },
    { label: "FG%", title: "Väljakuvisete tabavus", value: percent(season.fgPct) },
    { label: "3P%", title: "Kolmeste tabavus", value: percent(season.tpPct) },
    { label: "FT%", title: "Vabavisete tabavus", value: percent(season.ftPct) },
    { label: league.effLabel, title: `${league.effTitle} mängus`, value: avg(season.eff), active: true },
  ];
}

/** "2026-10-28" -> "28.10" */
function shortDate(date: string): string {
  const [, month, day] = date.split("-");
  return month && day ? `${Number(day)}.${Number(month)}` : date;
}

function GameRow({ game }: { game: NbaProfileGame }) {
  const score = game.teamScore !== null && game.opponentScore !== null ? `${game.teamScore}–${game.opponentScore}` : "";
  return (
    <tr className="border-t border-white/[0.05]">
      <td className="whitespace-nowrap py-2 pl-3 pr-2 text-muted">{shortDate(game.date)}</td>
      <td className="whitespace-nowrap px-1.5 py-2 sm:px-2 text-foreground">
        <span className="text-muted">{game.home ? "vs" : "@"}</span> {game.opponent}
      </td>
      <td className="whitespace-nowrap px-1.5 py-2 sm:px-2">
        {game.won !== null && (
          <>
            <span aria-hidden className={game.won ? "font-medium text-positive" : "font-medium text-destructive"}>
              {game.won ? "V" : "K"}
            </span>
            <span className="sr-only">{game.won ? "Võit" : "Kaotus"}</span>
          </>
        )}{" "}
        <span className="tabular-nums text-foreground/75">{score}</span>
      </td>
      <td className="hidden px-1.5 py-2 sm:px-2 text-right text-foreground/75 sm:table-cell">{game.stats.min}</td>
      <td className="px-1.5 py-2 sm:px-2 text-right font-medium text-foreground">{game.stats.pts}</td>
      <td className="px-1.5 py-2 sm:px-2 text-right text-foreground/75">{game.stats.reb}</td>
      <td className="px-1.5 py-2 sm:px-2 text-right text-foreground/75">{game.stats.ast}</td>
      <td className="py-2 pl-2 pr-3 text-right font-medium text-foreground">{game.stats.eff}</td>
    </tr>
  );
}

function ProfileBody({ preview, onClose }: { preview: PlayerPreview; onClose: () => void }) {
  const league = useLeague();
  const { data, isPending, isFetching, refetch } = useNbaPlayerProfile(league.id, preview.id);
  const titleId = useId();

  const name = data?.player.name ?? preview.name;
  const headshot = data?.player.headshot ?? preview.headshot;
  const color = data?.team?.color ?? preview.color;
  const teamName = data?.team?.name ?? preview.team;

  return (
    <article aria-labelledby={titleId} className="overflow-hidden rounded-t-2xl bg-[rgb(10_18_23)] sm:rounded-2xl">
      <header className="relative isolate overflow-hidden text-white" style={cardBackground(color)}>
        {headshot && <Cutout key={headshot} src={headshot} size="lg" />}
        <div className="relative flex min-h-[11rem] flex-col justify-end p-5 pr-14 sm:min-h-[13rem] sm:p-6">
          <h2
            id={titleId}
            className="max-w-[62%] font-display text-3xl font-bold leading-[0.95] tracking-[-0.02em] drop-shadow-[0_1px_8px_rgb(0_0_0/0.35)] [font-stretch:78%] sm:text-4xl"
          >
            {name}
          </h2>
          <p className="mt-1.5 max-w-[62%] text-sm text-white/80">
            {teamName}
            {data?.player.position && <span className="text-white/60"> {data.player.position}</span>}
            {data?.player.jersey && <span className="tabular-nums text-white/60"> #{data.player.jersey}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Sulge profiil"
          className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/25 text-white/85 transition-colors duration-200 hover:bg-black/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      {/* Telefonis on leht ekraani alaservas: sisu jääb kodunupu riba kohale. */}
      <div className="flex flex-col gap-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
        {data ? (
          <ProfileDetails profile={data} league={league} />
        ) : isPending ? (
          <div className="flex flex-col gap-3" aria-hidden>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted">Profiili ei saanud laadida. Allikas ei pruugi selle mängija andmeid anda.</p>
            <Button variant="ghost" onClick={() => refetch()} disabled={isFetching} className="!px-3 !py-1.5 text-xs">
              <RotateCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} aria-hidden />
              Proovi uuesti
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

function ProfileDetails({ profile, league }: { profile: NbaPlayerProfile; league: LeagueConfig }) {
  return (
    <>
      {profile.bio.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          {profile.bio.map((item) => (
            <div key={item.label}>
              <dt className="text-[11px] text-muted">{item.label}</dt>
              <dd className="text-sm text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <section aria-label="Hooaja keskmised">
        <h3 className="mb-2 text-xs font-medium text-muted">Hooaja keskmised</h3>
        {profile.season ? (
          <StatGrid columns="grid-cols-4 sm:grid-cols-6" cells={seasonCells(profile.season, league)} />
        ) : (
          <p className="text-sm text-muted">Sel hooajal pole veel mänge.</p>
        )}
      </section>

      {profile.games.length > 0 && (
        <section aria-label="Viimased mängud">
          <h3 className="mb-2 text-xs font-medium text-muted">Viimased mängud</h3>
          <div className="overflow-x-auto rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06]">
            {/* Telefonis ilma minutiteta, et efektiivsus mahuks ekraanile ilma külgsuunas kerimata. */}
            <table className="w-full text-xs tabular-nums sm:min-w-[26rem]">
              <thead>
                <tr className="text-muted">
                  <th scope="col" className="py-2 pl-3 pr-2 text-left font-medium">
                    Kuup.
                  </th>
                  <th scope="col" className="px-1.5 py-2 sm:px-2 text-left font-medium">
                    Vastane
                  </th>
                  <th scope="col" className="px-1.5 py-2 sm:px-2 text-left font-medium">
                    Tulemus
                  </th>
                  <th scope="col" className="hidden px-1.5 py-2 sm:px-2 text-right font-medium sm:table-cell">
                    MIN
                  </th>
                  <th scope="col" className="px-1.5 py-2 sm:px-2 text-right font-medium">
                    PTS
                  </th>
                  <th scope="col" className="px-1.5 py-2 sm:px-2 text-right font-medium">
                    REB
                  </th>
                  <th scope="col" className="px-1.5 py-2 sm:px-2 text-right font-medium">
                    AST
                  </th>
                  <th scope="col" className="py-2 pl-2 pr-3 text-right font-medium">
                    <abbr title={league.effTitle} className="no-underline">
                      {league.effLabel}
                    </abbr>
                  </th>
                </tr>
              </thead>
              <tbody>
                {profile.games.map((game) => (
                  <GameRow key={`${game.date}-${game.opponent}`} game={game} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
