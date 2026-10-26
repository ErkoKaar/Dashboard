import { unstable_cache } from "next/cache";
import { recapClip } from "@/lib/nba/clip";
import type {
  NbaBoxscore,
  NbaGame,
  NbaGameDay,
  NbaLeaderMetric,
  NbaLeadersResponse,
  NbaPerformance,
  NbaPlayerLine,
  NbaStatLine,
} from "@/lib/queries/useNba";
import { settleWithLimit } from "./http";

// Parimad sooritused (igalt mängijalt parim mäng) mõlemale liigale. Iga päeva top läheb eraldi
// vahemällu, kui päev on täielikult läbi: siis koondab "Hooaeg" (NBA-s ~170 päeva) ainult päevade
// tulemused ega käi iga kord läbi kõiki ~1200 boxscore'i.

const LEADER_METRICS: NbaLeaderMetric[] = ["eff", "pts", "reb", "ast"];
const TOP_COUNT = 10;
// Vaikimisi kuni 4 päeva x 8 boxscore'i korraga; päringuid piirav liiga (EuroLeague) annab väiksema.
const DEFAULT_CONCURRENCY = { days: 4, boxscores: 8 };
// Mängud, mis ei tule kunagi (ei takista päeva lõplikuks lugemist).
const NEVER_PLAYED = new Set(["STATUS_POSTPONED", "STATUS_CANCELED"]);

type Top = Record<NbaLeaderMetric, NbaPerformance[]>;

interface DayTop {
  top: Top;
  gamesCounted: number;
  gamesTotal: number;
}

function toStatLine(line: NbaPlayerLine): NbaStatLine {
  const { min, pts, reb, ast, stl, blk, tov, pf, fgm, fga, tpm, tpa, ftm, fta, plusMinus, eff } = line;
  return { min, pts, reb, ast, stl, blk, tov, pf, fgm, fga, tpm, tpa, ftm, fta, plusMinus, eff };
}

// Viigi korral otsustab efektiivsus, siis punktid.
function compare(a: NbaPerformance, b: NbaPerformance, metric: NbaLeaderMetric): number {
  return a.stats[metric] - b.stats[metric] || a.stats.eff - b.stats.eff || a.stats.pts - b.stats.pts;
}

/** Igalt mängijalt tema parim mäng selles mõõdikus, siis TOP_COUNT parimat. */
function topByMetric(performances: NbaPerformance[], metric: NbaLeaderMetric): NbaPerformance[] {
  const best = new Map<string, NbaPerformance>();
  for (const performance of performances) {
    const current = best.get(performance.player.id);
    if (!current || compare(performance, current, metric) > 0) best.set(performance.player.id, performance);
  }
  return [...best.values()].sort((a, b) => compare(b, a, metric)).slice(0, TOP_COUNT);
}

function topOf(performances: NbaPerformance[]): Top {
  return Object.fromEntries(LEADER_METRICS.map((metric) => [metric, topByMetric(performances, metric)])) as Top;
}

/** Ühe mängu sooritused. Video ja artikkel lisatakse alles koondamisel (vt buildLeaders). */
function performancesOf(game: NbaGame, boxscore: NbaBoxscore): NbaPerformance[] {
  return boxscore.teams.flatMap((team) => {
    const opponent = boxscore.teams.find((t) => t.id !== team.id);
    const won =
      team.score !== null && opponent?.score != null && team.score !== opponent.score ? team.score > opponent.score : null;
    return team.players.flatMap((line): NbaPerformance[] =>
      line.didNotPlay
        ? []
        : [
            {
              gameId: game.id,
              gameDay: game.gameDay,
              player: {
                id: line.id,
                name: line.name,
                shortName: line.shortName,
                position: line.position,
                headshot: line.headshot,
              },
              team: { abbreviation: team.abbreviation, name: team.shortName, color: team.color },
              opponent: opponent?.abbreviation ?? "?",
              home: team.home,
              won,
              teamScore: team.score,
              opponentScore: opponent?.score ?? null,
              stats: toStatLine(line),
              clip: null,
              recapUrl: null,
            },
          ],
    );
  });
}

class IncompleteDay extends Error {
  constructor(readonly result: DayTop) {
    super("Päev pole veel lõplik");
  }
}

interface LeaderOptions {
  /** Vahemälu võtme osa: "nba" või "euroleague". */
  league: string;
  /** Liiga tänane päev: tänane ja tulevased päevad pole kunagi lõplikud. */
  today: string;
  days: NbaGameDay[];
  getFinalBoxscore: (game: NbaGame) => Promise<NbaBoxscore>;
  concurrency?: { days: number; boxscores: number };
}

async function computeDay(day: NbaGameDay, options: LeaderOptions): Promise<{ result: DayTop; complete: boolean }> {
  const games = day.games.filter((game) => game.completed && game.countsForStats);
  const limit = (options.concurrency ?? DEFAULT_CONCURRENCY).boxscores;
  const boxscores = await settleWithLimit(games, limit, options.getFinalBoxscore);
  const performances = boxscores.flatMap((boxscore, i) => (boxscore ? performancesOf(games[i], boxscore) : []));
  const counted = boxscores.filter((b) => b !== null).length;
  const complete =
    day.date < options.today &&
    day.games.every((game) => game.completed || NEVER_PLAYED.has(game.status)) &&
    counted === games.length;
  return { result: { top: topOf(performances), gamesCounted: counted, gamesTotal: games.length }, complete };
}

/**
 * Lõplik päev jääb vahemällu igaveseks (unstable_cache ei salvesta visatud viga, seega poolik päev
 * arvutatakse järgmisel korral uuesti, kuid selle tulemust kasutatakse kohe).
 */
async function dayTop(day: NbaGameDay, options: LeaderOptions): Promise<DayTop> {
  const run = async () => {
    const { result, complete } = await computeDay(day, options);
    if (!complete) throw new IncompleteDay(result);
    return result;
  };
  try {
    return await unstable_cache(run, ["bb-day-top-v1", options.league, day.date], { revalidate: false })();
  } catch (error) {
    if (error instanceof IncompleteDay) return error.result;
    throw error;
  }
}

export async function buildLeaders(options: LeaderOptions): Promise<NbaLeadersResponse> {
  const dayLimit = (options.concurrency ?? DEFAULT_CONCURRENCY).days;
  const dayTops = await settleWithLimit(options.days, dayLimit, (day) => dayTop(day, options));
  const tops = dayTops.filter((d): d is DayTop => d !== null);

  // Video ja ESPN-i artikkel lisatakse praegustest mänguandmetest: highlight ilmub tihti tunde pärast
  // mängu ja peab jõudma ka juba vahemälus olevale päevale.
  const games = new Map(options.days.flatMap((day) => day.games.map((game): [string, NbaGame] => [game.id, game])));
  const withMedia = (performance: NbaPerformance): NbaPerformance => {
    const game = games.get(performance.gameId);
    return game ? { ...performance, clip: recapClip(game), recapUrl: game.recap?.url ?? null } : performance;
  };

  const top = Object.fromEntries(
    LEADER_METRICS.map((metric) => [
      metric,
      topByMetric(
        tops.flatMap((d) => d.top[metric]),
        metric,
      ).map(withMedia),
    ]),
  ) as Top;

  return {
    top,
    gamesCounted: tops.reduce((sum, d) => sum + d.gamesCounted, 0),
    gamesTotal: tops.reduce((sum, d) => sum + d.gamesTotal, 0),
  };
}
