"use client";

import { ReactNode, useState } from "react";
import { CalendarDays, ChevronDown, Play, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { shiftDate } from "@/lib/date";
import { recapClip } from "@/lib/nba/clip";
import { NbaGame, NbaPeriod, NbaRecapClip, NbaTeamSide, useNbaGames } from "@/lib/queries/useNba";
import { NbaBoxscore } from "./NbaBoxscore";
import { useRecapPlayer } from "./RecapPlayer";
import { useLeague } from "./league";
import { TeamLogo } from "./media";

const TALLINN = "Europe/Tallinn";

// Mängupäev on USA kuupäev; keskpäev UTC hoiab kuupäeva igas ajavööndis samana.
function dayLabel(date: string, today: string): string {
  const day = new Date(`${date}T12:00:00Z`);
  const short = day.toLocaleDateString("et-EE", { day: "numeric", month: "short", timeZone: "UTC" });
  if (date === today) return `Täna, ${short}`;
  if (date === shiftDate(today, -1)) return `Eile, ${short}`;
  const weekday = day.toLocaleDateString("et-EE", { weekday: "long", timeZone: "UTC" });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${short}`;
}

function periodLabel(period: number): string {
  return period <= 4 ? `Q${period}` : period === 5 ? "LA" : `LA${period - 4}`;
}

function statusText(game: NbaGame): string {
  switch (game.status) {
    case "STATUS_HALFTIME":
      return "Poolaeg";
    case "STATUS_END_PERIOD":
      return `${periodLabel(game.period)} lõpp`;
    case "STATUS_POSTPONED":
      return "Edasi lükatud";
    case "STATUS_CANCELED":
      return "Ära jäetud";
    case "STATUS_SUSPENDED":
      return "Peatatud";
    case "STATUS_DELAYED":
      return "Hilineb";
    case "STATUS_RESULT_PENDING":
      return "Ootab tulemust";
  }
  // EuroLeague'i mängukava ei anna veerandit ega kella: siis ainult "Käimas".
  if (game.state === "in") return game.period ? `${periodLabel(game.period)} ${game.clock}` : "Käimas";
  if (game.state === "post") return game.period > 4 ? `Lõpp (${periodLabel(game.period)})` : "Lõpp";
  if (!game.timeKnown) return "Aeg selgub";
  return new Date(game.startTime).toLocaleTimeString("et-EE", { hour: "2-digit", minute: "2-digit", timeZone: TALLINN });
}

function GameStatus({ game }: { game: NbaGame }) {
  const live = game.state === "in";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs tabular-nums ${live ? "font-medium text-positive" : "text-muted"}`}>
      {live && (
        <>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-positive" aria-hidden />
          <span className="sr-only">Käimas:</span>
        </>
      )}
      {statusText(game)}
    </span>
  );
}

function TeamLine({ side, game }: { side: NbaTeamSide; game: NbaGame }) {
  const decided = game.completed;
  const lost = decided && !side.winner;
  const tone = lost ? "text-muted" : "text-foreground";

  return (
    <span className="flex items-center gap-3">
      <TeamLogo src={side.logo} />
      <span className={`min-w-0 flex-1 truncate text-sm ${tone} ${decided && side.winner ? "font-semibold" : ""}`}>
        {side.name}
        {/* Telefonis bilansile ruumi pole: tiimi nimi on tähtsam. */}
        {side.record && (
          <span className="ml-2 hidden text-xs font-normal text-muted/70 tabular-nums sm:inline">{side.record}</span>
        )}
      </span>
      {side.score !== null && (
        <span className={`font-display text-lg leading-none tabular-nums ${tone} ${decided && side.winner ? "font-semibold" : ""}`}>
          {side.score}
        </span>
      )}
    </span>
  );
}

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// min-h-11 + -my-2: puutepind 44 px (sõrmega vajutatav), rea nähtav kõrgus jääb samaks.
const MEDIA_LINK =
  "-my-2 inline-flex min-h-11 items-center rounded text-muted transition-colors duration-200 hover:text-accent-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright";

// Väljaspool laiendusnuppu: link nupu sees oleks kehtetu HTML ja klõps avaks ka boxscore'i.
// pl-9 joondab rea tiimide nimedega (logo 24 px + vahe 12 px).
/** Motion Stationi recap'i pisipilt: avab videoakna dashboardi sees. 80x45 px (telefonis puutepind üle 44 px). */
function RecapThumbnail({ clip }: { clip: NbaRecapClip }) {
  const openRecap = useRecapPlayer();
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => openRecap(clip)}
      className="group/thumb relative ml-auto aspect-video w-20 shrink-0 cursor-pointer overflow-hidden rounded-md bg-white/[0.06] ring-1 ring-white/10 transition-[box-shadow] duration-200 hover:ring-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright sm:w-[5.5rem]"
    >
      <span className="sr-only">Vaata mängu ülevaadet: {clip.title}</span>
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://i.ytimg.com/vi/${encodeURIComponent(clip.videoId)}/mqdefault.jpg`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-[rgb(5_9_12/0.25)]" aria-hidden>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background shadow-[0_4px_12px_rgb(0_5_8/0.5)] transition-transform duration-150 group-active/thumb:scale-90">
          <Play className="h-3 w-3 translate-x-px fill-current" />
        </span>
      </span>
      {clip.duration && (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-[rgb(5_9_12/0.8)] px-1 text-[10px] font-medium tabular-nums text-foreground">
          {formatDuration(clip.duration)}
        </span>
      )}
    </button>
  );
}

function GameMedia({ game }: { game: NbaGame }) {
  // Motion Stationi recap avaneb videoaknas; kui seda pole (vana mäng, RSS-i aken), ESPN-i highlight lingina.
  const clip = recapClip(game);
  if (!game.recap && !clip && !game.video) return null;
  return (
    <div className="flex items-center gap-4 pb-3 pl-9 text-xs">
      {game.recap && (
        <a href={game.recap.url} target="_blank" rel="noopener noreferrer" className={`${MEDIA_LINK} min-w-0 flex-1`}>
          <span className="sr-only">Mängu ülevaade: </span>
          <span className="truncate">{game.recap.headline ?? "Mängu ülevaade"}</span>
        </a>
      )}
      {clip ? (
        <RecapThumbnail clip={clip} />
      ) : (
        game.video && (
          <a
            href={game.video.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${MEDIA_LINK} ml-auto shrink-0 gap-1.5 tabular-nums`}
          >
            <Play className="h-3 w-3 fill-current" aria-hidden />
            {/* ESPN: "1:13" (ekraanilugejale "Video 1:13") või kestuseta "Video". */}
            {game.video.duration ? <span className="sr-only">Video</span> : "Video"}
            {game.video.duration ? <span>{formatDuration(game.video.duration)}</span> : null}
          </a>
        )
      )}
    </div>
  );
}

function GameRow({ game, open, onToggle }: { game: NbaGame; open: boolean; onToggle: () => void }) {
  // Boxscore on olemas ainult käimasoleval või lõppenud mängul (edasi lükatud mängul mitte).
  const expandable = game.state === "in" || game.completed;
  const boxscoreId = `nba-box-${game.id}`;

  const content = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <TeamLine side={game.away} game={game} />
        <TeamLine side={game.home} game={game} />
      </span>
      <span className="flex w-24 shrink-0 flex-col items-end gap-1 text-right">
        <GameStatus game={game} />
        {game.note && <span className="text-[11px] text-muted/70">{game.note}</span>}
      </span>
      {expandable ? (
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      ) : (
        <span className="w-4 shrink-0" aria-hidden />
      )}
    </>
  );

  // Avatud mäng on üks tume paneel ja selle rida jääb boxscore'i kerimisel loendi ülaserva kinni.
  // Kleepuv rida vajab läbipaistmatut tausta (muidu paistavad tabeli numbrid läbi): sama värv kui
  // boxscore'i tabelil, nii et paneel on ühtne.
  return (
    <li
      className={
        open
          ? "-mx-2 my-1 rounded-xl bg-[rgb(10_18_23)] px-2 ring-1 ring-white/[0.06]"
          : "border-t border-white/[0.06] first:border-t-0"
      }
    >
      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={boxscoreId}
          className={`-mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-4 rounded-lg px-2 py-3 text-left transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-bright ${
            open ? "sticky top-0 z-10 rounded-b-none rounded-t-xl bg-[rgb(10_18_23)] hover:bg-[rgb(14_24_30)]" : "hover:bg-white/[0.03]"
          }`}
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-4 py-3">{content}</div>
      )}
      <GameMedia game={game} />
      {expandable && open && (
        <div id={boxscoreId} className="pb-5 pt-1">
          <NbaBoxscore game={game} />
        </div>
      )}
    </li>
  );
}

function GamesSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <Skeleton className="h-3 w-28" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-6 w-1/2" />
          </div>
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
    </div>
  );
}

export function NbaGamesCard({ period }: { period: NbaPeriod }) {
  const league = useLeague();
  const { data, isPending, isFetching, isPlaceholderData, refetch } = useNbaGames(period, league.id);
  const [openGameId, setOpenGameId] = useState<string | null>(null);
  const gameCount = data?.days.reduce((count, day) => count + day.games.length, 0) ?? 0;

  let body: ReactNode;
  if (data) {
    body = (
      <>
        {/* Kuu vaates on üle 200 mängu: loend kerib kaardi sees.
            px-2 annab ridade hover-taustale ruumi kerimisala sees (muidu tekiks horisontaalne kerimine). */}
        <div
          // Kaart on laial ekraanil kleepuv: loend lüheneb madalal ekraanil, et kaart mahuks vaatesse.
          className={`-mx-2 max-h-[min(44rem,calc(100dvh-12rem))] overflow-y-auto px-2 transition-opacity duration-200 ${isPlaceholderData ? "opacity-50" : ""}`}
        >
          {data.days.map((day) => (
            <section key={day.date} aria-label={dayLabel(day.date, data.today)}>
              {/* Pole kleepuv: klaaskaardi sees vajaks kleepuv pealkiri läbipaistmatut tausta, mis jääb
                  tumeda ribana silma (kaart on backdrop-juur, hägu ei näe taevast). */}
              <h3 className="py-2 text-xs font-medium text-muted">
                {dayLabel(day.date, data.today)}
              </h3>
              {day.games.length === 0 ? (
                <p className="pb-4 pt-2 text-sm text-muted">Sel päeval mänge pole.</p>
              ) : (
                <ul className="mb-3">
                  {day.games.map((game) => (
                    <GameRow
                      key={game.id}
                      game={game}
                      open={openGameId === game.id}
                      onToggle={() => setOpenGameId((current) => (current === game.id ? null : game.id))}
                    />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted/70">{league.dayNote}</p>
      </>
    );
  } else if (isPending) {
    body = <GamesSkeleton />;
  } else {
    body = (
      <div className="flex flex-1 flex-col items-start justify-center gap-4">
        <div>
          <p className="text-sm text-foreground">Mänge ei saanud laadida.</p>
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <WidgetTitle icon={CalendarDays}>Mängud</WidgetTitle>
        {data && (
          <p className="text-xs text-muted tabular-nums">
            {gameCount} {gameCount === 1 ? "mäng" : "mängu"}
          </p>
        )}
      </div>
      {body}
    </Card>
  );
}
