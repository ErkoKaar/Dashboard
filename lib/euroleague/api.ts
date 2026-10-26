import { unstable_cache } from "next/cache";
import { fetchJson } from "@/lib/basketball/http";
import { buildLeaders } from "@/lib/basketball/leaders";
import { groupGameDays } from "@/lib/basketball/period";
import { attachRecaps, getChannelVideos, RecapVideo, withDurations } from "@/lib/basketball/youtube";
import type {
  NbaBoxscore,
  NbaGame,
  NbaGamesResponse,
  NbaGameState,
  NbaLeadersResponse,
  NbaMvpEntry,
  NbaMvpResponse,
  NbaPeriod,
  NbaPlayerLine,
  NbaStandingsResponse,
  NbaStandingsRow,
  NbaTeamBox,
  NbaTeamSide,
} from "@/lib/queries/useNba";
import { clubColor } from "./colors";

// Ainult serveris (app/api/euroleague/*). EuroLeague'i ametlik API ametliku lehe CDN-i kaudu
// (feeds.incrowdsports.com; otse api-live.euroleague.net blokeerib paarikümne kiire päringu järel ~2 min):
// võtit pole vaja, CORS-i pole (seega ainult serverist). Andmed teisendatakse samadesse tüüpidesse
// nagu NBA (useNba.ts), nii et kasutajaliides on mõlemal liigal sama. Efektiivsus on PIR.

const API = "https://feeds.incrowdsports.com/provider/euroleague-feeds";
const COMPETITION = "E";
// Mänguülevaated: eelistatud MAGENTA SPORT (Saksa ülekandja, ~4 min saksakeelse kommentaariga, aga
// ainult umbes kolmandik mängudest), ülejäänutele ametlik EuroLeague'i kanal.
const MAGENTA_CHANNEL_ID = "UChr7ZXDFiPOEl543HM4Aj8g";
const EUROLEAGUE_CHANNEL_ID = "UCGr3nR_XH9r6E5b09ZJAT9w";
const TALLINN = "Europe/Tallinn";
// Mäng koos pausidega: alguse järel nii kaua "käimas", siis ilma tulemuseta "ootab tulemust".
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;
const MVP_COUNT = 10;

// --- EuroLeague'i toorkuju (ainult kasutatud väljad, kõik valikulised) ---

interface ElClub {
  code?: string;
  name?: string;
  abbreviatedName?: string;
  editorialName?: string;
  tvCode?: string;
  images?: { crest?: string };
}

interface ElGame {
  gameCode?: number;
  phaseType?: { code?: string; name?: string };
  round?: number;
  played?: boolean;
  utcDate?: string;
  confirmedHour?: boolean;
  local?: { club?: ElClub; score?: number };
  road?: { club?: ElClub; score?: number };
}

// Mängukava on CDN-is teisel kujul; see teisendatakse ElGame'iks (fromFeed).
interface FeedSide {
  code?: string;
  name?: string;
  abbreviatedName?: string;
  editorialName?: string;
  tla?: string;
  score?: number;
  imageUrls?: { crest?: string };
}

interface FeedGame {
  code?: number;
  date?: string;
  status?: string;
  confirmedTime?: boolean;
  round?: { round?: number };
  phaseType?: { code?: string; name?: string };
  home?: FeedSide;
  away?: FeedSide;
}

interface ElStatLine {
  timePlayed?: number;
  valuation?: number;
  points?: number;
  fieldGoalsMadeTotal?: number;
  fieldGoalsAttemptedTotal?: number;
  fieldGoalsMade3?: number;
  fieldGoalsAttempted3?: number;
  freeThrowsMade?: number;
  freeThrowsAttempted?: number;
  totalRebounds?: number;
  assistances?: number;
  steals?: number;
  turnovers?: number;
  blocksFavour?: number;
  foulsCommited?: number;
  plusMinus?: number;
  startFive?: boolean;
}

interface ElBoxSide {
  players?: {
    player?: {
      person?: { code?: string; name?: string; abbreviatedName?: string };
      positionName?: string;
      images?: { headshot?: string };
    };
    stats?: ElStatLine;
  }[];
}

interface ElPlayerStats {
  players?: {
    player?: { code?: string; name?: string; imageUrl?: string; team?: { code?: string } };
    gamesPlayed?: number;
    minutesPlayed?: number;
    pointsScored?: number;
    twoPointersMade?: number;
    twoPointersAttempted?: number;
    threePointersMade?: number;
    threePointersAttempted?: number;
    threePointersPercentage?: string;
    freeThrowsPercentage?: string;
    totalRebounds?: number;
    assists?: number;
    steals?: number;
    turnovers?: number;
    blocks?: number;
    pir?: number;
  }[];
}

interface ElStandings {
  teams?: {
    position?: number;
    positionChange?: string;
    gamesWon?: number;
    gamesLost?: number;
    pointsDifference?: string;
    homeRecord?: string;
    awayRecord?: string;
    lastTenRecord?: string;
    last5Form?: string[];
    club?: ElClub;
  }[];
}

// --- Abifunktsioonid ---

const num = (value: number | undefined) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/** "2026-10-23T18:15:00Z" -> "2026-10-23" Eesti aja järgi (EuroLeague mängib Euroopas). */
function tallinnDate(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TALLINN, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

/** Hooaeg vahetub juulis: 2026. aasta oktoobris on käimas E2026 (2026-27). */
function currentSeason(now: Date): string {
  const year = now.getUTCFullYear();
  return `${COMPETITION}${now.getUTCMonth() >= 6 ? year : year - 1}`;
}

function seasonLabel(season: string): string {
  const year = Number(season.slice(1));
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

// "WALKER IV, LONNIE" -> "Lonnie Walker IV"; sidekriipsud ja ülakomad jäävad ("O'Neal", "Smith-Jones").
function personName(raw: string): string {
  const titleCase = (part: string) =>
    part
      .toLowerCase()
      .split(/([\s'-])/)
      .map((token) => (/^(ii|iii|iv|v|vi)$/.test(token) ? token.toUpperCase() : token.charAt(0).toUpperCase() + token.slice(1)))
      .join("");
  const [surname, given] = raw.split(",").map((s) => s.trim());
  return given ? `${titleCase(given)} ${titleCase(surname)}` : titleCase(surname);
}

// "Hall, D." -> "D. Hall"; puudumisel täisnimest initsiaal + perenimi.
function shortPersonName(abbreviated: string | undefined, full: string): string {
  const [surname, initial] = (abbreviated ?? "").split(",").map((s) => s.trim());
  if (surname && initial) return `${initial} ${personName(surname)}`;
  const parts = full.split(" ");
  return parts.length > 1 ? `${parts[0].charAt(0)}. ${parts.slice(1).join(" ")}` : full;
}

function positionLetter(name: string | undefined): string | null {
  const letter = name?.trim().charAt(0).toUpperCase();
  return letter === "G" || letter === "F" || letter === "C" ? letter : null;
}

function parsePercent(value: string | undefined): number | null {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

// --- Mängud ---

// Mängukava (380 mängu) on vaja ka iga boxscore'i juures (klubide andmed): sama protsessi päringud
// jagavad 30 s üht vastust, et hooaja arvutus ei teeks sadu korduspäringuid.
const SEASON_MEMO_MS = 30 * 1000;
const seasonMemo = new Map<string, { at: number; games: Promise<ElGame[]> }>();

function fromFeedSide(side: FeedSide | undefined): ElGame["local"] {
  if (!side) return undefined;
  const { code, name, abbreviatedName, editorialName, tla, score, imageUrls } = side;
  return { club: { code, name, abbreviatedName, editorialName, tvCode: tla, images: { crest: imageUrls?.crest } }, score };
}

function fromFeed(game: FeedGame): ElGame {
  return {
    gameCode: game.code,
    phaseType: game.phaseType,
    round: game.round?.round,
    played: game.status === "result",
    utcDate: game.date,
    confirmedHour: game.confirmedTime,
    local: fromFeedSide(game.home),
    road: fromFeedSide(game.away),
  };
}

function fetchSeasonGames(season: string): Promise<ElGame[]> {
  const cached = seasonMemo.get(season);
  if (cached && Date.now() - cached.at < SEASON_MEMO_MS) return cached.games;
  // Vaikimisi lehekülg on 50 mängu; hooajas on kuni ~410 (põhiturniir 380 + play-off ja Final Four).
  const games = fetchJson<{ data?: FeedGame[] }>(
    `${API}/v2/competitions/${COMPETITION}/seasons/${season}/games?limit=1000`,
    { next: { revalidate: 60 } },
  ).then((json) => (json.data ?? []).map(fromFeed));
  // Ebaõnnestunud päringut ei jäeta meelde.
  games.catch(() => seasonMemo.delete(season));
  seasonMemo.set(season, { at: Date.now(), games });
  return games;
}

type Records = Map<string, { wins: number; losses: number }>;

/** Hooaja bilanss mängitud mängudest (API-s eraldi tabelit pole vaja). */
function recordsOf(games: ElGame[]): Records {
  const records: Records = new Map();
  const add = (code: string | undefined, won: boolean) => {
    if (!code) return;
    const record = records.get(code) ?? { wins: 0, losses: 0 };
    if (won) record.wins += 1;
    else record.losses += 1;
    records.set(code, record);
  };
  for (const game of games) {
    if (!game.played || game.local?.score === undefined || game.road?.score === undefined) continue;
    add(game.local.club?.code, game.local.score > game.road.score);
    add(game.road.club?.code, game.road.score > game.local.score);
  }
  return records;
}

function toTeamSide(side: ElGame["local"], score: number | null, winner: boolean, records: Records): NbaTeamSide | null {
  const club = side?.club;
  if (!club?.code) return null;
  const record = records.get(club.code);
  return {
    id: club.code,
    abbreviation: club.tvCode ?? club.code,
    name: club.abbreviatedName ?? club.name ?? club.code,
    logo: club.images?.crest ?? null,
    score,
    winner,
    record: record ? `${record.wins}-${record.losses}` : null,
  };
}

function gameKey(season: string, gameCode: number): string {
  return `${season}-${gameCode}`;
}

function toGame(game: ElGame, season: string, records: Records, now: number): NbaGame | null {
  if (game.gameCode === undefined || !game.utcDate || Number.isNaN(Date.parse(game.utcDate))) return null;

  const start = Date.parse(game.utcDate);
  let state: NbaGameState;
  let status: string;
  if (game.played) {
    state = "post";
    status = "STATUS_FINAL";
  } else if (now < start) {
    state = "pre";
    status = "STATUS_SCHEDULED";
  } else if (now - start < LIVE_WINDOW_MS) {
    state = "in";
    status = "STATUS_IN_PROGRESS";
  } else {
    state = "post";
    status = "STATUS_RESULT_PENDING";
  }

  const localScore = state === "pre" ? null : num(game.local?.score);
  const roadScore = state === "pre" ? null : num(game.road?.score);
  const final = game.played === true && localScore !== null && roadScore !== null;
  const home = toTeamSide(game.local, localScore, final && localScore > roadScore, records);
  const away = toTeamSide(game.road, roadScore, final && roadScore > localScore, records);
  if (!home || !away) return null;

  const phase = game.phaseType?.code;
  return {
    id: gameKey(season, game.gameCode),
    gameDay: tallinnDate(game.utcDate),
    startTime: game.utcDate,
    timeKnown: game.confirmedHour !== false,
    state,
    completed: game.played === true,
    status,
    period: 0,
    clock: "",
    note: phase && phase !== "RS" ? (game.phaseType?.name ?? null) : null,
    countsForStats: true,
    away,
    home,
    recap: null,
    video: null,
    youtube: null,
  };
}

// --- Mänguülevaated YouTube'is ---

// MAGENTA SPORT: "Paris Basketball - Valencia Basket | EuroLeague | MAGENTA SPORT". Kodumeeskond ees,
// vooru ega skoori pole, klubinimed saksa keeles ja sponsoritega ("Panathinaikos AKTOR Athen").
// Mängijaportreed jm ("Duane Washington Jr. Profile | EuroLeague") jäävad välja, sest neis pole kahte klubi.
const MAGENTA_TITLE = /^([^|]+?)\s+-\s+([^|]+?)\s*\|\s*EuroLeague\b/i;
// EuroLeague: "Paris Basketball - Valencia Basket | R7 Basketball Highlights 2026-27", vahel ees
// hüüdlause ("WHAT A GAME! | ...") ja vahel "R4 Highlights" ilma sõnata "Basketball". Voor on pealkirjas.
const EUROLEAGUE_TITLE = /(?:^|\|\s*)([^|]+?)\s+-\s+([^|]+?)\s*\|\s*R(\d+)\s+(?:Basketball\s+)?Highlights/i;
// Sama paar kohtub hooajal mitu korda: video peab ilmuma kolme päeva jooksul pärast mängu algust.
const RECAP_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const IGNORED_WORDS = new Set(["basket", "basketball", "club"]);
// Saksakeelsed nimed, milles pole ühtki sõna EuroLeague'i nimest (klubi koodi järgi).
const GERMAN_NAMES: Record<string, string[]> = {
  MIL: ["mailand"], // "Armani Olimpia Mailand"
  OLY: ["olympiakos"], // "Olympiakos Piräus"
  RED: ["roter stern"], // "Roter Stern Meridianbet Belgrad"
};

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function clubMatches(titleTeam: string, club: ElClub | undefined): boolean {
  if (!club) return false;
  const title = normalize(titleTeam);
  const names = [club.abbreviatedName, club.editorialName, club.name, ...(GERMAN_NAMES[club.code ?? ""] ?? [])].flatMap(
    (name) => (name ? [normalize(name)] : []),
  );
  if (names.some((name) => title.includes(name))) return true;
  // Sponsorinimi muudab pealkirja ("Hapoel IBI Tel Aviv" vs "Hapoel TLV"): klubi esimene sisukas sõna.
  const word = normalize(club.abbreviatedName ?? club.name ?? "")
    .split(/\s+/)
    .find((w) => w.length >= 4 && !IGNORED_WORDS.has(w));
  return word !== undefined && title.includes(word);
}

/** Pealkirjast kaks klubi ja voor (null, kui kanal vooru ei märgi). */
type TitleParser = (title: string) => { first: string; second: string; round: number | null } | null;

const parseMagentaTitle: TitleParser = (title) => {
  const m = title.match(MAGENTA_TITLE);
  return m ? { first: m[1], second: m[2], round: null } : null;
};

const parseEuroLeagueTitle: TitleParser = (title) => {
  const m = title.match(EUROLEAGUE_TITLE);
  return m ? { first: m[1], second: m[2], round: Number(m[3]) } : null;
};

function recapFinder(sources: Map<string, ElGame>, parse: TitleParser) {
  return (game: NbaGame, videos: RecapVideo[]): RecapVideo | undefined => {
    const source = sources.get(game.id);
    if (!source) return undefined;
    const start = Date.parse(game.startTime);
    const matching = videos.filter((video) => {
      if (Date.parse(video.publishedAt) - start > RECAP_WINDOW_MS) return false;
      const parsed = parse(video.title);
      if (!parsed || (parsed.round !== null && parsed.round !== source.round)) return false;
      const { first, second } = parsed;
      return (
        (clubMatches(first, source.local?.club) && clubMatches(second, source.road?.club)) ||
        (clubMatches(first, source.road?.club) && clubMatches(second, source.local?.club))
      );
    });
    // Varaseim sobiv: hilisem sama paari video kuulub järgmisele kohtumisele.
    return matching.sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt))[0];
  };
}

/**
 * Mängupäevad Eesti aja järgi. "Täna" näitab tänaseid mänge; kui täna mänge pole (EuroLeague mängib
 * teisipäevast reedeni), lisandub lähim tulev mängupäev. "Hooaeg" on hooaja algusest tänaseni.
 */
export async function getGameDays(period: NbaPeriod): Promise<NbaGamesResponse> {
  const now = Date.now();
  const season = currentSeason(new Date(now));
  const today = tallinnDate(new Date(now).toISOString());
  const raw = await fetchSeasonGames(season);
  const records = recordsOf(raw);

  const sources = new Map<string, ElGame>();
  const games: NbaGame[] = [];
  for (const source of raw) {
    const game = toGame(source, season, records, now);
    if (!game) continue;
    sources.set(game.id, source);
    games.push(game);
  }
  let days = groupGameDays(games, today, period);

  const [magenta, euroleague] = await Promise.all([
    getChannelVideos(MAGENTA_CHANNEL_ID, today),
    getChannelVideos(EUROLEAGUE_CHANNEL_ID, today),
  ]);
  // Teine kanal täidab ainult need mängud, millele esimesel videot polnud.
  days = attachRecaps(days, magenta.videos, recapFinder(sources, parseMagentaTitle));
  days = attachRecaps(days, euroleague.videos, recapFinder(sources, parseEuroLeagueTitle));
  const apiKey = magenta.apiKey ?? euroleague.apiKey;
  return { today, days: apiKey ? await withDurations(days, apiKey) : days };
}

// --- Boxscore ---

function toPlayerLine(row: NonNullable<ElBoxSide["players"]>[number]): NbaPlayerLine | null {
  const person = row.player?.person;
  if (!person?.code || !person.name) return null;
  const s = row.stats ?? {};
  const name = personName(person.name);
  const played = num(s.timePlayed) > 0;
  return {
    id: person.code,
    name,
    shortName: shortPersonName(person.abbreviatedName, name),
    position: positionLetter(row.player?.positionName),
    headshot: row.player?.images?.headshot ?? null,
    starter: s.startFive === true,
    didNotPlay: played ? null : "Ei mänginud",
    // timePlayed on sekundites.
    min: Math.round(num(s.timePlayed) / 60),
    pts: num(s.points),
    reb: num(s.totalRebounds),
    ast: num(s.assistances),
    stl: num(s.steals),
    blk: num(s.blocksFavour),
    tov: num(s.turnovers),
    pf: num(s.foulsCommited),
    fgm: num(s.fieldGoalsMadeTotal),
    fga: num(s.fieldGoalsAttemptedTotal),
    tpm: num(s.fieldGoalsMade3),
    tpa: num(s.fieldGoalsAttempted3),
    ftm: num(s.freeThrowsMade),
    fta: num(s.freeThrowsAttempted),
    plusMinus: played ? num(s.plusMinus) : null,
    // PIR: EuroLeague'i ametlik efektiivsus.
    eff: num(s.valuation),
  };
}

function toTeamBox(side: ElBoxSide | undefined, team: NbaTeamSide, club: ElClub | undefined, home: boolean): NbaTeamBox {
  return {
    id: team.id,
    abbreviation: team.abbreviation,
    name: club?.name ?? team.name,
    shortName: team.name,
    logo: team.logo,
    color: clubColor(club?.code),
    score: team.score,
    winner: team.winner,
    home,
    players: (side?.players ?? []).flatMap((row) => toPlayerLine(row) ?? []),
  };
}

/** "E2026-70" -> hooaeg ja mängu kood; vigane võti annab nulli. */
export function parseGameKey(key: string): { season: string; gameCode: number } | null {
  const match = key.match(/^(E\d{4})-(\d{1,4})$/);
  return match ? { season: match[1], gameCode: Number(match[2]) } : null;
}

async function loadBoxscore(key: string): Promise<{ boxscore: NbaBoxscore; final: boolean }> {
  const parsed = parseGameKey(key);
  if (!parsed) throw new Error("Vigane mängu võti");
  const raw = await fetchSeasonGames(parsed.season);
  const source = raw.find((game) => game.gameCode === parsed.gameCode);
  const game = source ? toGame(source, parsed.season, recordsOf(raw), Date.now()) : null;
  if (!source || !game) throw new Error("Mängu ei leitud");

  const stats = await fetchJson<{ local?: ElBoxSide; road?: ElBoxSide }>(
    `${API}/v2/competitions/${COMPETITION}/seasons/${parsed.season}/games/${parsed.gameCode}/stats`,
    { cache: "no-store" },
  );
  // Võõrsil mängiv tiim ette, nagu mängude nimekirjas.
  const boxscore: NbaBoxscore = {
    gameId: key,
    teams: [
      toTeamBox(stats.road, game.away, source.road?.club, false),
      toTeamBox(stats.local, game.home, source.local?.club, true),
    ],
  };
  return { boxscore, final: game.completed };
}

export async function getLiveBoxscore(key: string): Promise<NbaBoxscore> {
  return (await loadBoxscore(key)).boxscore;
}

/** Lõppenud mängu boxscore jääb vahemällu igaveseks; pooleli mäng visatakse (ei salvestu). */
export const getFinalBoxscore = unstable_cache(
  async (key: string): Promise<NbaBoxscore> => {
    const { boxscore, final } = await loadBoxscore(key);
    if (!final) throw new Error("Mäng pole veel lõppenud");
    if (boxscore.teams.some((team) => team.players.length === 0)) throw new Error("Boxscore puudub");
    return boxscore;
  },
  ["euroleague-final-boxscore-v1"],
  { revalidate: false },
);

// --- Parimad sooritused ---

export async function getLeaders(period: NbaPeriod): Promise<NbaLeadersResponse> {
  const { today, days } = await getGameDays(period);
  return buildLeaders({
    league: "euroleague",
    today,
    days,
    getFinalBoxscore: (game) => getFinalBoxscore(game.id),
    // CDN annab ka ise ülekoormusel 429: korraga kuni 3 päeva x 4 boxscore'i.
    concurrency: { days: 3, boxscores: 4 },
  });
}

// --- MVP race ---

const round1 = (value: number) => Math.round(value * 10) / 10;

export async function getMvpRace(): Promise<NbaMvpResponse> {
  const season = currentSeason(new Date());
  const [stats, games] = await Promise.all([
    fetchJson<ElPlayerStats>(
      `${API}/v3/competitions/${COMPETITION}/statistics/players/traditional?seasonMode=Single&seasonCode=${season}&statisticMode=PerGame&limit=1000`,
      { next: { revalidate: 3600 } },
    ),
    fetchSeasonGames(season),
  ]);

  const records = recordsOf(games);
  const clubs = new Map<string, ElClub>();
  for (const game of games) {
    for (const club of [game.local?.club, game.road?.club]) if (club?.code) clubs.set(club.code, club);
  }

  const rows = stats.players ?? [];
  // API annab kõik mängijad (ka paar minutit mänginud): miinimum on pool suurimast mängude arvust.
  const mostGames = Math.max(0, ...rows.map((row) => num(row.gamesPlayed)));
  const minGames = Math.max(1, Math.ceil(mostGames / 2));

  const entries: NbaMvpEntry[] = rows.flatMap((row) => {
    const player = row.player;
    const code = player?.team?.code;
    if (!player?.code || !player.name || !code || num(row.gamesPlayed) < minGames) return [];
    const club = clubs.get(code);
    const record = records.get(code);
    const name = personName(player.name);
    const fgMade = num(row.twoPointersMade) + num(row.threePointersMade);
    const fgAttempted = num(row.twoPointersAttempted) + num(row.threePointersAttempted);
    return [
      {
        player: { id: player.code, name, shortName: shortPersonName(undefined, name), position: null, headshot: player.imageUrl ?? null },
        team: {
          abbreviation: club?.tvCode ?? code,
          name: club?.abbreviatedName ?? club?.name ?? code,
          color: clubColor(code),
          wins: record?.wins ?? null,
          losses: record?.losses ?? null,
        },
        games: num(row.gamesPlayed),
        min: round1(num(row.minutesPlayed)),
        pts: round1(num(row.pointsScored)),
        reb: round1(num(row.totalRebounds)),
        ast: round1(num(row.assists)),
        stl: round1(num(row.steals)),
        blk: round1(num(row.blocks)),
        tov: round1(num(row.turnovers)),
        fgPct: fgAttempted > 0 ? Math.round((fgMade / fgAttempted) * 100) : null,
        tpPct: num(row.threePointersAttempted) > 0 ? parsePercent(row.threePointersPercentage) : null,
        ftPct: parsePercent(row.freeThrowsPercentage),
        eff: round1(num(row.pir)),
      },
    ];
  });

  entries.sort((a, b) => b.eff - a.eff || b.pts - a.pts);
  return { season: seasonLabel(season), players: entries.slice(0, MVP_COUNT) };
}

// --- Tabel ---

const STANDINGS_REVALIDATE = 300;

/** Põhiturniiri ametlik tabel viimase mängitud vooru järgi (koha muutus on selle vooru mõju). */
export async function getStandings(): Promise<NbaStandingsResponse> {
  const season = currentSeason(new Date());
  const games = await fetchSeasonGames(season);
  const round = Math.max(0, ...games.filter((g) => g.played && g.phaseType?.code === "RS").map((g) => g.round ?? 0));
  if (round === 0) return { season: seasonLabel(season), note: null, groups: [] };

  const standings = await fetchJson<ElStandings>(
    `${API}/v3/competitions/${COMPETITION}/seasons/${season}/rounds/${round}/basicstandings`,
    { next: { revalidate: STANDINGS_REVALIDATE } },
  );
  const rows = (standings.teams ?? []).flatMap((team): NbaStandingsRow[] => {
    const club = team.club;
    if (!club?.code || typeof team.position !== "number") return [];
    const diff = Number.parseInt(team.pointsDifference ?? "", 10);
    const form = (team.last5Form ?? []).filter((result): result is "W" | "L" => result === "W" || result === "L");
    return [
      {
        position: team.position,
        team: {
          id: club.code,
          abbreviation: club.tvCode ?? club.code,
          name: club.abbreviatedName ?? club.name ?? club.code,
          logo: club.images?.crest ?? null,
        },
        wins: num(team.gamesWon),
        losses: num(team.gamesLost),
        gamesBehind: null,
        pointDiff: Number.isFinite(diff) ? diff : null,
        home: team.homeRecord ?? null,
        away: team.awayRecord ?? null,
        lastTen: team.lastTenRecord ?? null,
        streak: null,
        form: form.length > 0 ? form : null,
        change: team.positionChange === "Up" ? "up" : team.positionChange === "Down" ? "down" : null,
      },
    ];
  });
  rows.sort((a, b) => a.position - b.position);
  return {
    season: seasonLabel(season),
    note: `pärast ${round}. vooru`,
    groups: rows.length > 0 ? [{ id: "RS", name: null, rows }] : [],
  };
}
