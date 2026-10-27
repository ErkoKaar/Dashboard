import { unstable_cache } from "next/cache";
import { buildLeaders } from "@/lib/basketball/leaders";
import { fetchJson, safeUrl, settleWithLimit } from "@/lib/basketball/http";
import { periodDates } from "@/lib/basketball/period";
import { attachRecaps, getChannelVideos, RecapVideo, withDurations } from "@/lib/basketball/youtube";
import { shiftDate } from "@/lib/date";
import type {
  NbaBoxscore,
  NbaGame,
  NbaGameDay,
  NbaGamesResponse,
  NbaGameState,
  NbaLeadersResponse,
  NbaMvpEntry,
  NbaMvpResponse,
  NbaPeriod,
  NbaPlayerLine,
  NbaStandingsGroup,
  NbaStandingsResponse,
  NbaStandingsRow,
  NbaTeamBox,
  NbaTeamSide,
} from "@/lib/queries/useNba";

// Ainult serveris (app/api/nba/*). ESPN-i avalik, kuid dokumenteerimata API: võtit pole vaja,
// skeem võib muutuda. Kõik väljad loetakse kaitsvalt; puuduva põhiväljaga kirje jäetakse vahele.
const ESPN_NBA = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";

// Hooaja vaates kuni ~170 mängupäeva: korraga kuni 10 päringut.
const SCOREBOARD_CONCURRENCY = 10;

// --- ESPN-i toorkuju (ainult kasutatud väljad, kõik valikulised) ---

interface EspnTeam {
  id?: string;
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  color?: string;
  logo?: string;
  logos?: { href?: string }[];
}

interface EspnCompetitor {
  homeAway?: string;
  score?: string;
  winner?: boolean;
  team?: EspnTeam;
  records?: { summary?: string }[];
}

interface EspnStatus {
  period?: number;
  displayClock?: string;
  type?: { name?: string; state?: string; completed?: boolean };
}

interface EspnVideo {
  duration?: number;
  links?: { web?: { href?: string } };
}

interface EspnEvent {
  id?: string;
  date?: string;
  season?: { type?: number };
  status?: EspnStatus;
  links?: { rel?: string[]; href?: string }[];
  competitions?: {
    type?: { abbreviation?: string };
    timeValid?: boolean;
    competitors?: EspnCompetitor[];
    headlines?: { type?: string; shortLinkText?: string; description?: string; video?: EspnVideo[] }[];
    highlights?: EspnVideo[];
  }[];
}

interface EspnScoreboard {
  day?: { date?: string };
  events?: EspnEvent[];
  /** calendar: hooaja mängupäevad ("2026-10-03T07:00Z"), sh eelhooaeg. */
  leagues?: { calendar?: unknown[] }[];
}

interface EspnAthleteRow {
  athlete?: {
    id?: string;
    displayName?: string;
    shortName?: string;
    headshot?: { href?: string };
    position?: { abbreviation?: string };
  };
  starter?: boolean;
  didNotPlay?: boolean;
  reason?: string;
  stats?: string[];
}

interface EspnSummary {
  header?: {
    competitions?: {
      status?: EspnStatus;
      competitors?: { homeAway?: string; score?: string; winner?: boolean; team?: { id?: string } }[];
    }[];
  };
  boxscore?: {
    players?: {
      team?: EspnTeam;
      statistics?: { keys?: string[]; athletes?: EspnAthleteRow[] }[];
    }[];
  };
}

function espnJson<T>(path: string, init: RequestInit): Promise<T> {
  return fetchJson<T>(`${ESPN_NBA}${path}`, init);
}

function teamLogo(team: EspnTeam): string | null {
  return team.logo ?? team.logos?.[0]?.href ?? null;
}

function teamColor(value: string | undefined): string | null {
  return value && /^[0-9a-f]{6}$/i.test(value) ? `#${value.toLowerCase()}` : null;
}

function parseScore(value: string | undefined): number | null {
  const score = Number.parseInt(value ?? "", 10);
  return Number.isFinite(score) ? score : null;
}

// --- Mängud ---

function toTeamSide(competitor: EspnCompetitor | undefined, state: NbaGameState): NbaTeamSide | null {
  const team = competitor?.team;
  if (!team?.id || !team.abbreviation) return null;
  return {
    id: team.id,
    abbreviation: team.abbreviation,
    name: team.shortDisplayName ?? team.displayName ?? team.abbreviation,
    logo: teamLogo(team),
    // ESPN annab enne mängu skooriks "0", see pole päris skoor.
    score: state === "pre" ? null : parseScore(competitor?.score),
    winner: competitor?.winner === true,
    record: competitor?.records?.[0]?.summary ?? null,
  };
}

function toVideo(video: EspnVideo | undefined): NbaGame["video"] {
  const url = safeUrl(video?.links?.web?.href);
  if (!url) return null;
  const duration = video?.duration;
  return { url, duration: typeof duration === "number" && duration > 0 ? Math.round(duration) : null };
}

function toGame(event: EspnEvent, gameDay: string): NbaGame | null {
  const competition = event.competitions?.[0];
  if (!event.id || !event.date || Number.isNaN(Date.parse(event.date)) || !competition) return null;

  const rawState = event.status?.type?.state;
  const state: NbaGameState = rawState === "in" || rawState === "post" ? rawState : "pre";
  const competitors = competition.competitors ?? [];
  const away = toTeamSide(competitors.find((c) => c.homeAway === "away"), state);
  const home = toTeamSide(competitors.find((c) => c.homeAway === "home"), state);
  if (!away || !home) return null;

  const preseason = event.season?.type === 1;
  const allStar = competition.type?.abbreviation === "ALLSTAR";
  const completed = event.status?.type?.completed === true;

  // Recap ja video on mõttekad ainult lõppenud mängul (enne mängu on samas kohas eelvaade).
  const recapHeadline = competition.headlines?.find((h) => h.type === "Recap");
  const recapUrl = completed ? safeUrl(event.links?.find((l) => l.rel?.includes("recap"))?.href) : null;
  // description algab ESPN-is mõttekriipsuga ("— Luka Doncic scored..."): see eemaldatakse.
  const headline =
    recapHeadline?.shortLinkText?.trim() || recapHeadline?.description?.replace(/^[\s—–-]+/, "").trim() || null;

  return {
    id: event.id,
    gameDay,
    startTime: event.date,
    timeKnown: competition.timeValid !== false,
    state,
    completed,
    status: event.status?.type?.name ?? "",
    period: event.status?.period ?? 0,
    clock: event.status?.displayClock ?? "",
    note: allStar ? "Tähtede mäng" : preseason ? "Eelhooaeg" : null,
    countsForStats: !preseason && !allStar,
    away,
    home,
    recap: recapUrl ? { url: recapUrl, headline } : null,
    video: completed ? (toVideo(recapHeadline?.video?.[0]) ?? toVideo(competition.highlights?.[0])) : null,
    // Täidetakse getGameDays'is, kui Motion Stationi video leitakse (attachRecaps).
    youtube: null,
  };
}

// --- Mänguülevaated YouTube'is (Motion Station) ---

const RECAP_CHANNEL_ID = "UCLd4dSmXdrJykO_hgOzbfPw";

// "Game Recap: Pistons 106, 76ers 93", vahel täisnimedega ("Los Angeles Lakers 127, ...").
const RECAP_TITLE = /^Game Recap:\s*(.+?)\s+(\d+)\s*,\s*(.+?)\s+(\d+)\s*$/i;

// Pealkirjas on lühinimi ("Lakers") või täisnimi ("Los Angeles Lakers"); ESPN-i lühinimi on mõlema lõpp.
function sameTeam(titleName: string, side: NbaTeamSide): boolean {
  const title = titleName.trim().toLowerCase();
  const short = side.name.toLowerCase();
  return title === short || title.endsWith(` ${short}`);
}

/** Mõlemad tiimid ja mõlemad skoorid peavad klappima; võitja on pealkirjas ees, aga see võib olla kumb tahes. */
function findRecap(game: NbaGame, videos: RecapVideo[]): RecapVideo | undefined {
  const matches = (a: NbaTeamSide, b: NbaTeamSide) =>
    videos.find((video) => {
      const m = video.title.match(RECAP_TITLE);
      return (
        m !== null &&
        sameTeam(m[1], a) &&
        Number(m[2]) === a.score &&
        sameTeam(m[3], b) &&
        Number(m[4]) === b.score
      );
    });
  return matches(game.away, game.home) ?? matches(game.home, game.away);
}

function toGameDay(date: string, events: EspnEvent[]): NbaGameDay {
  const games = events.flatMap((event) => toGame(event, date) ?? []);
  games.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  return { date, games };
}

/** Hooaja mängupäevad ESPN-i kalendrist (sh eelhooaeg), tänasest varasemad, uuemast vanemani. */
function seasonDates(current: EspnScoreboard, today: string): string[] {
  const dates = (current.leagues?.[0]?.calendar ?? []).flatMap((entry) => {
    const value = typeof entry === "string" ? entry : (entry as { startDate?: unknown })?.startDate;
    const date = typeof value === "string" ? value.slice(0, 10) : "";
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today ? [date] : [];
  });
  return [...new Set(dates)].sort().reverse();
}

async function fetchDay(date: string, today: string): Promise<NbaGameDay> {
  // Üle kahe päeva vanad tulemused enam ei muutu: pikk vahemälu (hooaja vaates ~170 päeva).
  const revalidate = date < shiftDate(today, -2) ? 86400 : 300;
  const board = await espnJson<EspnScoreboard>(`/scoreboard?dates=${date.replaceAll("-", "")}`, {
    next: { revalidate },
  });
  return toGameDay(date, board.events ?? []);
}

/**
 * Tänane mängupäev (ESPN-i järgi, USA aeg) ja sellele eelnevad päevad perioodi pikkuses; hooaja
 * vaates kõik hooaja mängupäevad. ESPN ei luba kuupäevavahemikku, seega iga päev on eraldi päring.
 */
export async function getGameDays(period: NbaPeriod): Promise<NbaGamesResponse> {
  // Tänane tabel muutub live-mängude ajal: lühike vahemälu.
  const current = await espnJson<EspnScoreboard>("/scoreboard", { next: { revalidate: 30 } });
  const today = current.day?.date;
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new Error("ESPN ei andnud tänast mängupäeva");
  }

  const pastDates = period === "season" ? seasonDates(current, today) : periodDates(today, period).slice(1);
  const [past, recaps] = await Promise.all([
    settleWithLimit(pastDates, SCOREBOARD_CONCURRENCY, (date) => fetchDay(date, today)),
    getChannelVideos(RECAP_CHANNEL_ID, today),
  ]);

  // Tänane päev jääb alati sisse (ka tühjana); möödunud tühjad päevad (puhkepäevad) ja
  // ebaõnnestunud päringud jäetakse välja.
  const days = attachRecaps(
    [
      toGameDay(today, current.events ?? []),
      ...past.filter((day): day is NbaGameDay => day !== null && day.games.length > 0),
    ],
    recaps.videos,
    findRecap,
  );
  return { today, days: recaps.apiKey ? await withDurations(days, recaps.apiKey) : days };
}

// --- Boxscore ---

function toPlayerLine(row: EspnAthleteRow, keys: string[]): NbaPlayerLine | null {
  const athlete = row.athlete;
  if (!athlete?.id || !athlete.displayName) return null;

  const stats = row.stats ?? [];
  const raw = (key: string) => {
    const index = keys.indexOf(key);
    return index >= 0 ? (stats[index] ?? "") : "";
  };
  const int = (key: string) => {
    const value = Number.parseInt(raw(key), 10);
    return Number.isFinite(value) ? value : 0;
  };
  // "3-9" -> [3, 9]
  const pair = (key: string): [number, number] => {
    const [made, attempted] = raw(key).split("-").map((n) => Number.parseInt(n, 10));
    return [Number.isFinite(made) ? made : 0, Number.isFinite(attempted) ? attempted : 0];
  };

  const [fgm, fga] = pair("fieldGoalsMade-fieldGoalsAttempted");
  const [tpm, tpa] = pair("threePointFieldGoalsMade-threePointFieldGoalsAttempted");
  const [ftm, fta] = pair("freeThrowsMade-freeThrowsAttempted");
  const plusMinus = Number.parseInt(raw("plusMinus"), 10);
  const played = row.didNotPlay !== true && stats.length > 0;
  const [pts, reb, ast, stl, blk, tov] = ["points", "rebounds", "assists", "steals", "blocks", "turnovers"].map(int);

  return {
    id: athlete.id,
    name: athlete.displayName,
    shortName: athlete.shortName ?? athlete.displayName,
    position: athlete.position?.abbreviation ?? null,
    headshot: athlete.headshot?.href ?? null,
    starter: row.starter === true,
    didNotPlay: played ? null : row.reason?.trim() || "Ei mänginud",
    min: int("minutes"),
    pts,
    reb,
    ast,
    stl,
    blk,
    tov,
    pf: int("fouls"),
    fgm,
    fga,
    tpm,
    tpa,
    ftm,
    fta,
    plusMinus: played && Number.isFinite(plusMinus) ? plusMinus : null,
    // NBA efektiivsus: PTS + REB + AST + STL + BLK - möödaviskamised - mööda vabavisked - TO.
    eff: pts + reb + ast + stl + blk - (fga - fgm) - (fta - ftm) - tov,
  };
}

function parseBoxscore(gameId: string, summary: EspnSummary): NbaBoxscore {
  const sides = new Map(
    (summary.header?.competitions?.[0]?.competitors ?? []).flatMap((c) => (c.team?.id ? [[c.team.id, c] as const] : [])),
  );

  const teams = (summary.boxscore?.players ?? []).flatMap((block): NbaTeamBox[] => {
    const team = block.team;
    if (!team?.id || !team.abbreviation) return [];
    const stat = block.statistics?.[0];
    const keys = stat?.keys ?? [];
    const side = sides.get(team.id);
    return [
      {
        id: team.id,
        abbreviation: team.abbreviation,
        name: team.displayName ?? team.abbreviation,
        shortName: team.shortDisplayName ?? team.displayName ?? team.abbreviation,
        logo: teamLogo(team),
        color: teamColor(team.color),
        score: parseScore(side?.score),
        winner: side?.winner === true,
        home: side?.homeAway === "home",
        players: (stat?.athletes ?? []).flatMap((row) => toPlayerLine(row, keys) ?? []),
      },
    ];
  });

  // Võõrsil mängiv tiim ette, nagu mängude nimekirjas.
  teams.sort((a, b) => Number(a.home) - Number(b.home));
  return { gameId, teams };
}

async function fetchSummary(gameId: string): Promise<EspnSummary> {
  return espnJson<EspnSummary>(`/summary?event=${encodeURIComponent(gameId)}`, { cache: "no-store" });
}

/** Käimasoleva mängu boxscore: alati värske, ei jää vahemällu. */
export async function getLiveBoxscore(gameId: string): Promise<NbaBoxscore> {
  return parseBoxscore(gameId, await fetchSummary(gameId));
}

/**
 * Lõppenud mängu boxscore ei muutu: kärbitud kuju (~10 KB) jääb Next'i Data Cache'i, mis püsib
 * ka serveri taaskäivitusel. Kui mäng pole tegelikult lõppenud või andmed puuduvad, visatakse
 * viga: unstable_cache vigu ei salvesta, nii et poolik seis vahemällu ei jää.
 * Võtme versioon tõuseb, kui NbaBoxscore'i kuju muutub (v2: tiimivärv, skoor, kodu/võõrsil;
 * v3: mängija eff).
 */
export const getFinalBoxscore = unstable_cache(
  async (gameId: string): Promise<NbaBoxscore> => {
    const summary = await fetchSummary(gameId);
    if (summary.header?.competitions?.[0]?.status?.type?.completed !== true) {
      throw new Error("Mäng pole veel lõppenud");
    }
    const boxscore = parseBoxscore(gameId, summary);
    if (boxscore.teams.length < 2) throw new Error("Boxscore puudub");
    return boxscore;
  },
  ["nba-final-boxscore-v3"],
  { revalidate: false },
);

// --- Parimad sooritused ---

export async function getLeaders(period: NbaPeriod): Promise<NbaLeadersResponse> {
  const { today, days } = await getGameDays(period);
  return buildLeaders({ league: "nba", today, days, getFinalBoxscore: (game) => getFinalBoxscore(game.id) });
}

// --- MVP race ---

// ESPN-i hooaja statistika: kõik kvalifitseerunud mängijad (~450) ühe päringuga.
const ESPN_SEASON_STATS =
  "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&limit=1000&sort=offensive.avgPoints:desc";
const ESPN_STANDINGS = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings";
const MVP_REVALIDATE = 3600;
const MVP_COUNT = 10;

interface EspnSeasonStats {
  requestedSeason?: { displayName?: string };
  categories?: { name?: string; names?: string[] }[];
  athletes?: {
    athlete?: {
      id?: string;
      displayName?: string;
      shortName?: string;
      headshot?: { href?: string };
      position?: { abbreviation?: string };
      teamId?: string;
      teamName?: string;
      teamShortName?: string;
    };
    categories?: { name?: string; values?: number[] }[];
  }[];
}

interface EspnStandings {
  children?: {
    abbreviation?: string;
    name?: string;
    standings?: {
      seasonDisplayName?: string;
      entries?: { team?: EspnTeam; stats?: { name?: string; value?: number; displayValue?: string }[] }[];
    };
  }[];
}

interface EspnTeams {
  sports?: { leagues?: { teams?: { team?: { id?: string; color?: string } }[] }[] }[];
}

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

async function loadMvpRace(): Promise<NbaMvpResponse> {
  // Bilanss ja tiimivärv on lisainfo: nende viga ei tohi edetabelit maha võtta.
  const [stats, standings, teams] = await Promise.all([
    fetchJson<EspnSeasonStats>(ESPN_SEASON_STATS, { cache: "no-store" }),
    fetchJson<EspnStandings>(ESPN_STANDINGS, { next: { revalidate: MVP_REVALIDATE } }).catch(() => null),
    espnJson<EspnTeams>("/teams", { next: { revalidate: 86400 } }).catch(() => null),
  ]);

  const records = new Map<string, { wins: number | null; losses: number | null }>();
  for (const entry of (standings?.children ?? []).flatMap((c) => c.standings?.entries ?? [])) {
    if (!entry.team?.id) continue;
    const stat = (name: string) => {
      const value = entry.stats?.find((s) => s.name === name)?.value;
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    };
    records.set(entry.team.id, { wins: stat("wins"), losses: stat("losses") });
  }

  const colors = new Map<string, string | null>();
  for (const { team } of teams?.sports?.[0]?.leagues?.[0]?.teams ?? []) {
    if (team?.id) colors.set(team.id, teamColor(team.color));
  }

  // Iga kategooria väärtused on samas järjekorras kui päise names-loend.
  const columns = new Map<string, Map<string, number>>();
  for (const category of stats.categories ?? []) {
    if (category.name) columns.set(category.name, new Map((category.names ?? []).map((name, i) => [name, i])));
  }

  const entries: NbaMvpEntry[] = (stats.athletes ?? []).flatMap((row) => {
    const athlete = row.athlete;
    if (!athlete?.id || !athlete.displayName || !athlete.teamShortName) return [];
    const value = (category: string, name: string) => {
      const index = columns.get(category)?.get(name);
      const raw = index === undefined ? undefined : row.categories?.find((c) => c.name === category)?.values?.[index];
      return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    };
    const num = (category: string, name: string) => value(category, name) ?? 0;

    const games = num("general", "gamesPlayed");
    if (games < 1) return [];
    const pts = num("offensive", "avgPoints");
    const reb = num("general", "avgRebounds");
    const ast = num("offensive", "avgAssists");
    const stl = num("defensive", "avgSteals");
    const blk = num("defensive", "avgBlocks");
    const tov = num("offensive", "avgTurnovers");
    const missedFg = num("offensive", "avgFieldGoalsAttempted") - num("offensive", "avgFieldGoalsMade");
    const missedFt = num("offensive", "avgFreeThrowsAttempted") - num("offensive", "avgFreeThrowsMade");
    const pct = (name: string) => {
      const raw = value("offensive", name);
      return raw === null ? null : Math.round(raw);
    };
    const record = athlete.teamId ? records.get(athlete.teamId) : undefined;

    return [
      {
        player: {
          id: athlete.id,
          name: athlete.displayName,
          shortName: athlete.shortName ?? athlete.displayName,
          position: athlete.position?.abbreviation ?? null,
          headshot: athlete.headshot?.href ?? null,
        },
        team: {
          abbreviation: athlete.teamShortName,
          name: athlete.teamName ?? athlete.teamShortName,
          color: athlete.teamId ? (colors.get(athlete.teamId) ?? null) : null,
          wins: record?.wins ?? null,
          losses: record?.losses ?? null,
        },
        games,
        min: round(num("general", "avgMinutes"), 1),
        pts: round(pts, 1),
        reb: round(reb, 1),
        ast: round(ast, 1),
        stl: round(stl, 1),
        blk: round(blk, 1),
        tov: round(tov, 1),
        fgPct: pct("fieldGoalPct"),
        tpPct: pct("threePointFieldGoalPct"),
        ftPct: pct("freeThrowPct"),
        eff: round(pts + reb + ast + stl + blk - missedFg - missedFt - tov, 1),
      },
    ];
  });

  entries.sort((a, b) => b.eff - a.eff || b.pts - a.pts);
  return { season: stats.requestedSeason?.displayName ?? null, players: entries.slice(0, MVP_COUNT) };
}

/**
 * ESPN-i hooaja statistika on ~4 MB ja Next'i andmevahemälu ei salvesta üle 2 MB vastuseid, nii et
 * toores päring käiks igal MVP race'i avamisel uuesti. Vahemällu läheb valmis edetabel, tunniks.
 */
export const getMvpRace = unstable_cache(loadMvpRace, ["nba-mvp-race-v1"], { revalidate: MVP_REVALIDATE });

// --- Tabel ---

const STANDINGS_REVALIDATE = 300;
const CONFERENCE_NAMES: Record<string, string> = { East: "Ida", West: "Lääs" };

type EspnStandingsEntry = NonNullable<NonNullable<NonNullable<EspnStandings["children"]>[number]["standings"]>["entries"]>[number];

function toStandingsRow(entry: EspnStandingsEntry): NbaStandingsRow | null {
  const team = entry.team;
  const stat = (name: string) => entry.stats?.find((s) => s.name === name);
  const count = (name: string) => {
    const value = stat(name)?.value;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  // Kokkuvõtte väljad ("0-2", "L3"); ESPN annab puuduva väärtuse kohal "-".
  const text = (name: string) => {
    const value = stat(name)?.displayValue?.trim();
    return value && value !== "-" ? value : null;
  };
  const seed = count("playoffSeed");
  const wins = count("wins");
  const losses = count("losses");
  if (!team?.id || !team.abbreviation || seed === null || wins === null || losses === null) return null;

  return {
    position: seed,
    team: {
      id: team.id,
      abbreviation: team.abbreviation,
      name: team.shortDisplayName ?? team.displayName ?? team.abbreviation,
      logo: teamLogo(team),
    },
    wins,
    losses,
    gamesBehind: text("gamesBehind") ?? "-",
    pointDiff: count("pointDifferential"),
    home: text("Home"),
    away: text("Road"),
    lastTen: text("Last Ten Games"),
    streak: text("streak"),
    form: null,
    change: null,
  };
}

/** Konverentside tabelid asetuse (playoffSeed) järgi; ESPN-i järjestus on muu. */
export async function getStandings(): Promise<NbaStandingsResponse> {
  const standings = await fetchJson<EspnStandings>(ESPN_STANDINGS, { next: { revalidate: STANDINGS_REVALIDATE } });
  const groups = (standings.children ?? []).flatMap((conference): NbaStandingsGroup[] => {
    // ESPN annab hooaja alguses viigis tiimidele sama asetuse (kaks 8., 9. puudub): koht on järjekorranumber.
    const rows = (conference.standings?.entries ?? [])
      .map(toStandingsRow)
      .filter((row): row is NbaStandingsRow => row !== null)
      .sort((a, b) => a.position - b.position)
      .map((row, i) => ({ ...row, position: i + 1 }));
    if (rows.length === 0) return [];
    const id = conference.abbreviation ?? conference.name ?? String(rows[0].position);
    return [{ id, name: CONFERENCE_NAMES[id] ?? conference.name ?? null, rows }];
  });
  return {
    season: standings.children?.[0]?.standings?.seasonDisplayName ?? null,
    note: null,
    groups,
  };
}
