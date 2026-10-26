import { unstable_cache } from "next/cache";
import { shiftDate } from "@/lib/date";
import { recapClip } from "@/lib/nba/clip";
import type {
  NbaBoxscore,
  NbaGame,
  NbaGameDay,
  NbaGamesResponse,
  NbaGameState,
  NbaLeaderMetric,
  NbaLeadersResponse,
  NbaMvpEntry,
  NbaMvpResponse,
  NbaPerformance,
  NbaPeriod,
  NbaPlayerLine,
  NbaStatLine,
  NbaTeamBox,
  NbaTeamSide,
} from "@/lib/queries/useNba";

// Ainult serveris (app/api/nba/*). ESPN-i avalik, kuid dokumenteerimata API: võtit pole vaja,
// skeem võib muutuda. Kõik väljad loetakse kaitsvalt; puuduva põhiväljaga kirje jäetakse vahele.
const ESPN_NBA = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";

const PERIOD_DAYS: Record<NbaPeriod, number> = { today: 1, "3d": 3, "7d": 7, "30d": 30 };

const LEADER_METRICS: NbaLeaderMetric[] = ["eff", "pts", "reb", "ast"];
const TOP_COUNT = 10;

const BOXSCORE_CONCURRENCY = 8;

export function parsePeriod(value: string | null): NbaPeriod | null {
  return value !== null && Object.prototype.hasOwnProperty.call(PERIOD_DAYS, value)
    ? (value as NbaPeriod)
    : null;
}

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

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`ESPN vastas koodiga ${res.status}`);
  return (await res.json()) as T;
}

function espnJson<T>(path: string, init: RequestInit): Promise<T> {
  return fetchJson<T>(`${ESPN_NBA}${path}`, init);
}

function teamLogo(team: EspnTeam): string | null {
  return team.logo ?? team.logos?.[0]?.href ?? null;
}

// Lingid lähevad otse href-i: ainult http(s), et vastusesse sattunud "javascript:" ei saaks käivituda.
function safeUrl(value: string | undefined): string | null {
  return value && /^https?:\/\//i.test(value) ? value : null;
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
// Kanali üleslaadimiste playlist on sama id "UU" eesliitega.
const RECAP_UPLOADS_PLAYLIST = `UU${RECAP_CHANNEL_ID.slice(2)}`;
const RECAP_REVALIDATE = 600;
// Pikim vahemik on 30 päeva; üks päev varu, sest video ilmub järgmisel päeval (UTC).
const RECAP_LOOKBACK_DAYS = 31;
// 12 x 50 videot katab ka tihedaima kuu (~250 mängu) varuga.
const RECAP_MAX_PAGES = 12;
const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

// "Game Recap: Pistons 106, 76ers 93", vahel täisnimedega ("Los Angeles Lakers 127, ...").
const RECAP_TITLE = /^Game Recap:\s*(.+?)\s+(\d+)\s*,\s*(.+?)\s+(\d+)\s*$/i;
const VIDEO_ID = /^[\w-]{11}$/;

interface RecapVideo {
  id: string;
  title: string;
  publishedAt: string;
}

/** Võtmega: kõik viimase 31 päeva videod. Uusimad on playlistis eespool, seega peatub vanemani jõudes. */
async function fetchRecapVideosApi(apiKey: string, since: number): Promise<RecapVideo[]> {
  const videos: RecapVideo[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < RECAP_MAX_PAGES; page++) {
    const params = new URLSearchParams({ part: "snippet", playlistId: RECAP_UPLOADS_PLAYLIST, maxResults: "50" });
    if (pageToken) params.set("pageToken", pageToken);
    // Võti päises, mitte URL-is: nii ei satu see logidesse ega vahemälu võtme nähtavasse ossa.
    const res = await fetch(`${YOUTUBE_API}/playlistItems?${params}`, {
      headers: { "X-Goog-Api-Key": apiKey },
      next: { revalidate: RECAP_REVALIDATE },
    });
    if (!res.ok) throw new Error(`YouTube vastas koodiga ${res.status}`);
    const json = (await res.json()) as {
      nextPageToken?: string;
      items?: { snippet?: { title?: string; publishedAt?: string; resourceId?: { videoId?: string } } }[];
    };

    let reachedOld = false;
    for (const item of json.items ?? []) {
      const snippet = item.snippet;
      const id = snippet?.resourceId?.videoId;
      if (!id || !snippet?.title || !snippet.publishedAt) continue;
      if (Date.parse(snippet.publishedAt) < since) {
        reachedOld = true;
        continue;
      }
      videos.push({ id, title: snippet.title, publishedAt: snippet.publishedAt });
    }
    pageToken = json.nextPageToken;
    if (reachedOld || !pageToken) break;
  }
  return videos;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Võtmeta: kanali RSS annab 15 viimast videot (umbes kaks mängupäeva). */
async function fetchRecapVideosRss(): Promise<RecapVideo[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${RECAP_CHANNEL_ID}`, {
    next: { revalidate: RECAP_REVALIDATE },
  });
  if (!res.ok) throw new Error(`YouTube RSS vastas koodiga ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap(([, entry]) => {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = entry.match(/<title>([^<]+)<\/title>/)?.[1];
    const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    return id && title && publishedAt ? [{ id, title: decodeXml(title), publishedAt }] : [];
  });
}

/**
 * Recap-videod ei tohi mängude laadimist kunagi murda: API vea (kvoot täis, vigane võti) korral
 * proovitakse RSS-i, selle vea korral jäävad recapid lihtsalt ära. apiKey on tagastatud ainult siis,
 * kui API päring õnnestus (kestuste jaoks).
 */
async function getRecapVideos(today: string): Promise<{ videos: RecapVideo[]; apiKey: string | null }> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (apiKey) {
    try {
      const since = Date.parse(`${shiftDate(today, -RECAP_LOOKBACK_DAYS)}T00:00:00Z`);
      return { videos: await fetchRecapVideosApi(apiKey, since), apiKey };
    } catch {
      // langeb RSS-ile
    }
  }
  try {
    return { videos: await fetchRecapVideosRss(), apiKey: null };
  } catch {
    return { videos: [], apiKey: null };
  }
}

// "PT2M44S" -> 164
function parseIsoDuration(value: string | undefined): number | null {
  const match = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const [, h = "0", m = "0", s = "0"] = match;
  const seconds = Number(h) * 3600 + Number(m) * 60 + Number(s);
  return seconds > 0 ? seconds : null;
}

/** Kestused on lisainfo: vea korral jäävad need lihtsalt puudu. */
async function fetchDurations(apiKey: string, ids: string[]): Promise<Map<string, number>> {
  const durations = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 50) {
    const params = new URLSearchParams({ part: "contentDetails", id: ids.slice(i, i + 50).join(",") });
    try {
      const res = await fetch(`${YOUTUBE_API}/videos?${params}`, {
        headers: { "X-Goog-Api-Key": apiKey },
        next: { revalidate: 86400 },
      });
      if (!res.ok) break;
      const json = (await res.json()) as { items?: { id?: string; contentDetails?: { duration?: string } }[] };
      for (const item of json.items ?? []) {
        const seconds = parseIsoDuration(item.contentDetails?.duration);
        if (item.id && seconds) durations.set(item.id, seconds);
      }
    } catch {
      break;
    }
  }
  return durations;
}

// Pealkirjas on lühinimi ("Lakers") või täisnimi ("Los Angeles Lakers"); ESPN-i lühinimi on mõlema lõpp.
function sameTeam(titleName: string, side: NbaTeamSide): boolean {
  const title = titleName.trim().toLowerCase();
  const short = side.name.toLowerCase();
  return title === short || title.endsWith(` ${short}`);
}

/**
 * Seob video lõppenud mänguga: mõlemad tiimid ja mõlemad skoorid peavad klappima ning video peab
 * olema avaldatud pärast mängu algust (sama tulemus kuu eest ei sobi). Uusim sobiv video võidab.
 */
function attachRecaps(days: NbaGameDay[], videos: RecapVideo[]): NbaGameDay[] {
  const parsed = videos.flatMap((video) => {
    const match = video.title.match(RECAP_TITLE);
    if (!match || !VIDEO_ID.test(video.id)) return [];
    return [{ video, first: match[1], firstScore: Number(match[2]), second: match[3], secondScore: Number(match[4]) }];
  });

  const matches = (game: NbaGame, a: NbaTeamSide, b: NbaTeamSide) =>
    parsed.find(
      (p) =>
        Date.parse(p.video.publishedAt) >= Date.parse(game.startTime) &&
        sameTeam(p.first, a) &&
        p.firstScore === a.score &&
        sameTeam(p.second, b) &&
        p.secondScore === b.score,
    );

  return days.map((day) => ({
    ...day,
    games: day.games.map((game) => {
      if (!game.completed) return game;
      // Võitja on pealkirjas ees, aga see võib olla kumb tahes tiim.
      const found = matches(game, game.away, game.home) ?? matches(game, game.home, game.away);
      if (!found) return game;
      const videoId = found.video.id;
      return { ...game, youtube: { url: `https://www.youtube.com/watch?v=${videoId}`, videoId, duration: null } };
    }),
  }));
}

/** Teine samm (ainult API võtmega): kestused küsitakse ainult mängudega seotud videotele. */
async function withDurations(days: NbaGameDay[], apiKey: string): Promise<NbaGameDay[]> {
  const ids = days.flatMap((day) => day.games.flatMap((game) => (game.youtube ? [game.youtube.videoId] : [])));
  const durations = await fetchDurations(apiKey, ids);
  if (durations.size === 0) return days;
  return days.map((day) => ({
    ...day,
    games: day.games.map((game) => {
      const duration = game.youtube ? durations.get(game.youtube.videoId) : undefined;
      return duration && game.youtube ? { ...game, youtube: { ...game.youtube, duration } } : game;
    }),
  }));
}

function toGameDay(date: string, events: EspnEvent[]): NbaGameDay {
  const games = events.flatMap((event) => toGame(event, date) ?? []);
  games.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  return { date, games };
}

/**
 * Tänane mängupäev (ESPN-i järgi, USA aeg) ja sellele eelnevad päevad perioodi pikkuses.
 * ESPN ei luba kuupäevavahemikku, seega iga päev on eraldi päring (30 paralleelselt ~1 s).
 */
export async function getGameDays(period: NbaPeriod): Promise<NbaGamesResponse> {
  // Tänane tabel muutub live-mängude ajal: lühike vahemälu.
  const current = await espnJson<EspnScoreboard>("/scoreboard", { next: { revalidate: 30 } });
  const today = current.day?.date;
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new Error("ESPN ei andnud tänast mängupäeva");
  }

  const pastDates = Array.from({ length: PERIOD_DAYS[period] - 1 }, (_, i) => shiftDate(today, -(i + 1)));
  const [past, recaps] = await Promise.all([
    Promise.all(
      pastDates.map(async (date) => {
        const board = await espnJson<EspnScoreboard>(`/scoreboard?dates=${date.replaceAll("-", "")}`, {
          next: { revalidate: 300 },
        });
        return toGameDay(date, board.events ?? []);
      }),
    ),
    getRecapVideos(today),
  ]);

  // Tänane päev jääb alati sisse (ka tühjana); möödunud tühjad päevad (puhkepäevad) jäetakse välja.
  const days = attachRecaps(
    [toGameDay(today, current.events ?? []), ...past.filter((day) => day.games.length > 0)],
    recaps.videos,
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

  return {
    id: athlete.id,
    name: athlete.displayName,
    shortName: athlete.shortName ?? athlete.displayName,
    position: athlete.position?.abbreviation ?? null,
    headshot: athlete.headshot?.href ?? null,
    starter: row.starter === true,
    didNotPlay: played ? null : row.reason?.trim() || "Ei mänginud",
    min: int("minutes"),
    pts: int("points"),
    reb: int("rebounds"),
    ast: int("assists"),
    stl: int("steals"),
    blk: int("blocks"),
    tov: int("turnovers"),
    pf: int("fouls"),
    fgm,
    fga,
    tpm,
    tpa,
    ftm,
    fta,
    plusMinus: played && Number.isFinite(plusMinus) ? plusMinus : null,
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
 * Võtme versioon tõuseb, kui NbaBoxscore'i kuju muutub (v2: tiimivärv, skoor, kodu/võõrsil).
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
  ["nba-final-boxscore-v2"],
  { revalidate: false },
);

// --- Parimad sooritused ---

/** Nagu Promise.allSettled, aga korraga töös kuni `limit` päringut; ebaõnnestunu on null. */
async function settleWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index]);
      } catch {
        results[index] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function toStatLine(line: NbaPlayerLine): NbaStatLine {
  const { min, pts, reb, ast, stl, blk, tov, pf, fgm, fga, tpm, tpa, ftm, fta, plusMinus } = line;
  const eff = pts + reb + ast + stl + blk - (fga - fgm) - (fta - ftm) - tov;
  return { min, pts, reb, ast, stl, blk, tov, pf, fgm, fga, tpm, tpa, ftm, fta, plusMinus, eff };
}

// Viigi korral otsustab EFF, siis punktid.
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

export async function getLeaders(period: NbaPeriod): Promise<NbaLeadersResponse> {
  const { days } = await getGameDays(period);
  const games = days.flatMap((day) => day.games).filter((game) => game.completed && game.countsForStats);
  const boxscores = await settleWithLimit(games, BOXSCORE_CONCURRENCY, (game) => getFinalBoxscore(game.id));

  const performances: NbaPerformance[] = [];
  boxscores.forEach((boxscore, index) => {
    if (!boxscore) return;
    const game = games[index];
    for (const team of boxscore.teams) {
      const opponent = boxscore.teams.find((t) => t.id !== team.id);
      const won =
        team.score !== null && opponent?.score != null && team.score !== opponent.score
          ? team.score > opponent.score
          : null;
      for (const line of team.players) {
        if (line.didNotPlay) continue;
        performances.push({
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
          // Motion Stationi video avaneb videoaknas; kui seda pole, viib tulemus ESPN-i artiklile.
          clip: recapClip(game),
          recapUrl: game.recap?.url ?? null,
        });
      }
    }
  });

  const top = Object.fromEntries(
    LEADER_METRICS.map((metric) => [metric, topByMetric(performances, metric)]),
  ) as Record<NbaLeaderMetric, NbaPerformance[]>;

  return {
    top,
    gamesCounted: boxscores.filter((b) => b !== null).length,
    gamesTotal: games.length,
  };
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
  children?: { standings?: { entries?: { team?: { id?: string }; stats?: { name?: string; value?: number }[] }[] } }[];
}

interface EspnTeams {
  sports?: { leagues?: { teams?: { team?: { id?: string; color?: string } }[] }[] }[];
}

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

export async function getMvpRace(): Promise<NbaMvpResponse> {
  // Bilanss ja tiimivärv on lisainfo: nende viga ei tohi edetabelit maha võtta.
  const [stats, standings, teams] = await Promise.all([
    fetchJson<EspnSeasonStats>(ESPN_SEASON_STATS, { next: { revalidate: MVP_REVALIDATE } }),
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
