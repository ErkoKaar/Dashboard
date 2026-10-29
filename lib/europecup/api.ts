import { unstable_cache } from "next/cache";
import { fetchText, settleWithLimit } from "@/lib/basketball/http";
import { buildLeaders } from "@/lib/basketball/leaders";
import { groupGameDays } from "@/lib/basketball/period";
import type {
  NbaBoxscore,
  NbaGame,
  NbaGameState,
  NbaGamesResponse,
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

// Ainult serveris (app/api/europecup/*). FIBA Europe Cup: FIBA avalikku API-t ei paku (digital-api vajab
// nende veebikliendi võtit). Andmed loetakse fiba.basketball lehtede Next.js RSC andmetest
// (self.__next_f), kus mängukava, tabel ja boxscore on JSON-ina, ning teisendatakse samadesse
// tüüpidesse nagu NBA (useNba.ts). Lehe ülesehituse muutumisel lakkab lugemine töötamast: siis annab
// route vea ja vaade näitab veateadet. Näidatakse ainult kolme Eesti klubi mänge, nende gruppide
// tabeleid ja (parimates sooritustes ja mängijates) nende mängijaid. Efektiivsus on FIBA EFF.

const SITE = "https://www.fiba.basketball/en/events";
const ASSETS = "https://assets.fiba.basketball/image/upload";
const TALLINN = "Europe/Tallinn";
// Klubid nime järgi: sponsorinimi muutub (Kalev/Cramo -> Bigbank/Kalev), linn jääb.
const OUR_CLUBS = /kalev|tartu|p[äa]rnu/i;
// Mäng koos pausidega: alguse järel nii kaua "käimas", siis ilma tulemuseta "ootab tulemust".
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;
const MVP_COUNT = 10;
// Mängu leht on ~500 KB: boxscore'e korraga kuni 3.
const BOXSCORE_CONCURRENCY = 3;
const STANDINGS_REVALIDATE = 300;

// --- FIBA toorkuju (ainult kasutatud väljad, kõik valikulised) ---

interface FibaTeam {
  teamId?: number;
  organisationId?: number;
  code?: string;
  officialName?: string;
  shortName?: string;
}

interface FibaGame {
  gameId?: number;
  statusCode?: string;
  gameResultStatusCode?: string;
  teamA?: FibaTeam;
  teamB?: FibaTeam;
  teamAScore?: number;
  teamBScore?: number;
  isLive?: boolean;
  isPostponed?: boolean;
  currentPeriod?: string;
  chrono?: string;
  gameDateTimeUTC?: string;
  hasTimeGameDateTime?: boolean;
  groupPairingCode?: string | null;
  round?: { roundCode?: string; roundName?: string; roundType?: string };
}

interface FibaPerson {
  personId?: number;
  firstName?: string;
  lastName?: string;
  position?: string;
}

interface FibaStatLine {
  AS?: number;
  BS?: number;
  REB?: number;
  FGA?: number;
  FGM?: number;
  FG3A?: number;
  FG3M?: number;
  FTA?: number;
  FTM?: number;
  PF?: number;
  PTS?: number;
  ST?: number;
  TO?: number;
  /** Mänguaeg "32:9" (minutid:sekundid). */
  TP?: string;
  PM?: number;
  EFF?: number;
  Starter?: boolean;
  HasPlayed?: boolean;
}

/** Boxscore'i tiim: Id "T_<organisationId>", mängijad Id-ga "P_<personId>". */
interface FibaBoxTeam {
  Id?: string;
  Children?: { Id?: string; Stats?: FibaStatLine }[];
}

interface FibaGroup {
  groupName?: string;
  gameIds?: number[];
  teamsStats?: { rank?: number; team?: number; gamesPlayed?: number; gamesWon?: number; gamesLost?: number; plusMinus?: number }[];
}

/** Tabelilehe etapp (kvalifikatsioon, põhiturniir, teine ring...); grupiturniiril type "groups". */
interface FibaStandingStage {
  type?: string;
  startDate?: string;
  current?: boolean;
  data?: { groups?: FibaGroup[] };
}

// --- RSC ---

/** Lehe RSC andmed: self.__next_f.push([1,"..."]) tükid kokku liidetuna. */
function rscPayload(html: string): string {
  let payload = "";
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try {
      payload += JSON.parse(match[1]) as string;
    } catch {
      // Loetamatu tükk jääb vahele; vajaliku andme puudumisel annab kutsuja vea.
    }
  }
  return payload;
}

/** JSON-väärtus kohalt `start` ("[" või "{") kuni sobiva sulgeva suluni (jutumärkide sisu ei loe). */
function jsonAt(text: string, start: number): unknown {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === "\\") i++;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "[" || char === "{") {
      depth++;
    } else if (char === "]" || char === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

/** Kõik massiivid ja objektid, mis RSC andmetes järgnevad võtmele `"key":`. */
function valuesOf(payload: string, key: string): unknown[] {
  const needle = `"${key}":`;
  const values: unknown[] = [];
  for (let i = payload.indexOf(needle); i >= 0; i = payload.indexOf(needle, i + needle.length)) {
    const start = i + needle.length;
    if (payload[start] !== "[" && payload[start] !== "{") continue;
    const value = jsonAt(payload, start);
    if (value !== undefined) values.push(value);
  }
  return values;
}

/**
 * Lehe RSC andmed. FIBA CDN annab vahel poolikult renderdatud lehe (nt mängulehel puudub boxscore) ja
 * hoiab seda mõnda aega vahemälus: kui `marker` puudub, küsitakse lehte korra uuesti päringuparameetriga,
 * mis läheb CDN-ist mööda. Parameeter peab olema lõpliku aadressi küljes (ümbersuunamine kaotab selle).
 */
async function fetchPayload(path: string, marker: string, init: RequestInit): Promise<string> {
  const payload = rscPayload(await fetchText(`${SITE}/${path}`, init));
  if (payload.includes(marker)) return payload;
  return rscPayload(await fetchText(`${SITE}/${path}?fresh=${Date.now()}`, { cache: "no-store" }));
}

// --- Abifunktsioonid ---

const num = (value: number | undefined) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/** Hooaeg vahetub juulis: 2026. aasta oktoobris on käimas 2026-27 (algusaasta 2026). */
function seasonStart(now: Date): number {
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

const twoDigits = (year: number) => String(year % 100).padStart(2, "0");

function seasonLabel(start: number): string {
  return `${start}-${twoDigits(start + 1)}`;
}

/** Hooaja ürituse aadress: "fiba-europe-cup-26-27". */
function eventPath(start: number): string {
  return `fiba-europe-cup-${twoDigits(start)}-${twoDigits(start + 1)}`;
}

/** FIBA UTC aeg ilma vööndita ("2026-10-07T16:30:00", RSC-s vahel "$D" ees) -> ISO. */
function utcIso(value: string | undefined): string | null {
  if (!value) return null;
  const raw = value.replace(/^\$D/, "");
  const time = Date.parse(/(Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}Z`);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function tallinnDate(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TALLINN, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

const isOurClub = (team: FibaTeam | undefined) => OUR_CLUBS.test(`${team?.officialName ?? ""} ${team?.shortName ?? ""}`);
const isOurGame = (game: FibaGame) => isOurClub(game.teamA) || isOurClub(game.teamB);

/** Lõpptulemus on kinnitatud (enne seda on mäng käimas või ootab tulemust). */
const isFinal = (game: FibaGame) => game.statusCode === "VALID" && game.gameResultStatusCode === "VALID";

// Klubi logo; FIBA-s on see organisatsiooni küljes.
function logoOf(team: FibaTeam | undefined): string | null {
  const org = team?.organisationId;
  return typeof org === "number"
    ? `${ASSETS}/d_.logoflag--light--organisation_${org}.webp/w_96/f_auto/q_auto/.logoflag--light--organisation_${org}`
    : null;
}

/** Eesti klubidel ametlik nimi (täpitähtedega: "BC Pärnu"), teistel lühem nimi. */
function teamName(team: FibaTeam): string {
  return (isOurClub(team) ? team.officialName : team.shortName) ?? team.officialName ?? team.code ?? "?";
}

/** "Q4" -> 4, "OT1" -> 5. */
function periodNumber(value: string | undefined): number {
  const match = value?.match(/^(Q|OT)(\d+)$/);
  if (!match) return 0;
  return match[1] === "Q" ? Number(match[2]) : 4 + Number(match[2]);
}

const ROUND_NOTES: Record<string, string> = {
  Q: "Kvalifikatsioon",
  QF: "Veerandfinaal",
  SF: "Poolfinaal",
  F: "Finaal",
};

/** Mängu juures: grupp ("D-grupp", teises ringis "2. ring, I-grupp") või play-off'i etapp. */
function noteOf(game: FibaGame): string | null {
  const round = game.round;
  if (round?.roundType === "G" && game.groupPairingCode) {
    const group = `${game.groupPairingCode}-grupp`;
    return round.roundCode === "RS" ? group : `2. ring, ${group}`;
  }
  const known = round?.roundCode ? ROUND_NOTES[round.roundCode] : undefined;
  return known ?? (round?.roundName || null);
}

// --- Mängud ---

// Mängukava (kõik hooaja mängud, ~1 MB leht) on vaja ka iga boxscore'i ja tabeli juures: sama protsessi
// päringud jagavad 30 s üht vastust.
const SEASON_MEMO_MS = 30 * 1000;
let seasonMemo: { at: number; path: string; games: Promise<FibaGame[]> } | null = null;

function fetchSeasonGames(path: string): Promise<FibaGame[]> {
  if (seasonMemo && seasonMemo.path === path && Date.now() - seasonMemo.at < SEASON_MEMO_MS) return seasonMemo.games;
  const games = fetchPayload(`${path}/games`, '"gameDateTimeUTC"', { next: { revalidate: 60 } }).then((payload) => {
    // Lehel on ka teisi "games" massiive (nt järgmine mäng lühendatud kujul): mängukava on suurim.
    const lists = valuesOf(payload, "games").filter((value): value is FibaGame[] => Array.isArray(value));
    const schedule = lists.sort((a, b) => b.length - a.length)[0] ?? [];
    const valid = schedule.filter((game) => typeof game?.gameId === "number" && game.teamA && game.teamB);
    if (valid.length === 0) throw new Error("FIBA mängukava ei leitud");
    return valid;
  });
  // Ebaõnnestunud päringut ei jäeta meelde.
  games.catch(() => {
    if (seasonMemo?.games === games) seasonMemo = null;
  });
  seasonMemo = { at: Date.now(), path, games };
  return games;
}

type Records = Map<string, { wins: number; losses: number }>;

/** Bilanss kõigist selle hooaja lõppenud mängudest (ka kvalifikatsioon). */
function recordsOf(games: FibaGame[]): Records {
  const records: Records = new Map();
  const add = (team: FibaTeam | undefined, won: boolean) => {
    if (typeof team?.teamId !== "number") return;
    const id = String(team.teamId);
    const record = records.get(id) ?? { wins: 0, losses: 0 };
    if (won) record.wins += 1;
    else record.losses += 1;
    records.set(id, record);
  };
  for (const game of games) {
    if (!isFinal(game) || num(game.teamAScore) === num(game.teamBScore)) continue;
    add(game.teamA, num(game.teamAScore) > num(game.teamBScore));
    add(game.teamB, num(game.teamBScore) > num(game.teamAScore));
  }
  return records;
}

function toTeamSide(team: FibaTeam | undefined, score: number | null, winner: boolean, records: Records): NbaTeamSide | null {
  if (typeof team?.teamId !== "number") return null;
  const id = String(team.teamId);
  const record = records.get(id);
  return {
    id,
    abbreviation: team.code ?? id,
    name: teamName(team),
    logo: logoOf(team),
    score,
    winner,
    record: record ? `${record.wins}-${record.losses}` : null,
  };
}

function toGame(game: FibaGame, records: Records, now: number): NbaGame | null {
  const startTime = utcIso(game.gameDateTimeUTC);
  if (typeof game.gameId !== "number" || !startTime) return null;

  const start = Date.parse(startTime);
  const final = isFinal(game);
  let state: NbaGameState;
  let status: string;
  if (final) {
    state = "post";
    status = "STATUS_FINAL";
  } else if (game.isPostponed) {
    state = "pre";
    status = "STATUS_POSTPONED";
  } else if (game.isLive || (now >= start && now - start < LIVE_WINDOW_MS)) {
    state = "in";
    status = "STATUS_IN_PROGRESS";
  } else if (now < start) {
    state = "pre";
    status = "STATUS_SCHEDULED";
  } else {
    state = "post";
    status = "STATUS_RESULT_PENDING";
  }

  // teamA on FIBA-s kodumeeskond.
  const homeScore = state === "pre" ? null : num(game.teamAScore);
  const awayScore = state === "pre" ? null : num(game.teamBScore);
  const decided = final && homeScore !== null && awayScore !== null;
  const home = toTeamSide(game.teamA, homeScore, decided && homeScore > awayScore, records);
  const away = toTeamSide(game.teamB, awayScore, decided && awayScore > homeScore, records);
  if (!home || !away) return null;

  return {
    id: String(game.gameId),
    gameDay: tallinnDate(startTime),
    startTime,
    timeKnown: game.hasTimeGameDateTime !== false,
    state,
    completed: final,
    status,
    period: state === "pre" ? 0 : periodNumber(game.currentPeriod),
    clock: state === "in" ? (game.chrono ?? "") : "",
    note: noteOf(game),
    countsForStats: true,
    away,
    home,
    recap: null,
    video: null,
    youtube: null,
  };
}

/**
 * Eesti klubide mängupäevad Eesti aja järgi. "Täna" näitab tänaseid mänge; kui täna mänge pole,
 * lisandub lähim tulev mängupäev. "Hooaeg" on hooaja algusest (kvalifikatsioonist) tänaseni.
 */
export async function getGameDays(period: NbaPeriod): Promise<NbaGamesResponse> {
  const now = Date.now();
  const today = tallinnDate(new Date(now).toISOString());
  const raw = await fetchSeasonGames(eventPath(seasonStart(new Date(now))));
  const records = recordsOf(raw);
  const games = raw.filter(isOurGame).flatMap((game) => toGame(game, records, now) ?? []);
  return { today, days: groupGameDays(games, today, period) };
}

// --- Boxscore ---

export const isGameId = (id: string) => /^\d{4,9}$/.test(id);

/** "PG" -> "G", "SF" -> "F", "C" -> "C". */
function positionLetter(position: string | undefined): string | null {
  const code = position?.toUpperCase().split(/[/-]/)[0] ?? "";
  if (code.endsWith("G")) return "G";
  if (code.endsWith("F")) return "F";
  return code === "C" ? "C" : null;
}

/** "32:9" -> 32 (ümardatud minutid). */
function minutesOf(value: string | undefined): number {
  const match = value?.match(/^(\d+):(\d+)$/);
  return match ? Math.round(Number(match[1]) + Number(match[2]) / 60) : 0;
}

function toPlayerLine(row: NonNullable<FibaBoxTeam["Children"]>[number], people: Map<string, FibaPerson>): NbaPlayerLine | null {
  const id = row.Id?.replace(/^P_/, "");
  const person = id ? people.get(id) : undefined;
  if (!id || !person?.lastName) return null;
  const s = row.Stats ?? {};
  const first = person.firstName?.trim() ?? "";
  const name = first ? `${first} ${person.lastName}` : person.lastName;
  const played = s.HasPlayed === true;
  return {
    id,
    name,
    shortName: first ? `${first.charAt(0)}. ${person.lastName}` : person.lastName,
    position: positionLetter(person.position),
    headshot: null,
    starter: s.Starter === true,
    didNotPlay: played ? null : "Ei mänginud",
    min: minutesOf(s.TP),
    pts: num(s.PTS),
    reb: num(s.REB),
    ast: num(s.AS),
    stl: num(s.ST),
    blk: num(s.BS),
    tov: num(s.TO),
    pf: num(s.PF),
    fgm: num(s.FGM),
    fga: num(s.FGA),
    tpm: num(s.FG3M),
    tpa: num(s.FG3A),
    ftm: num(s.FTM),
    fta: num(s.FTA),
    plusMinus: played ? num(s.PM) : null,
    // FIBA ametlik efektiivsus.
    eff: num(s.EFF),
  };
}

function toTeamBox(
  team: NbaTeamSide,
  source: FibaTeam | undefined,
  boxTeams: FibaBoxTeam[],
  people: Map<string, FibaPerson>,
  home: boolean,
): NbaTeamBox {
  const box = boxTeams.find((t) => t.Id === `T_${source?.organisationId}`);
  return {
    id: team.id,
    abbreviation: team.abbreviation,
    name: source?.officialName ?? team.name,
    shortName: team.name,
    logo: team.logo,
    color: null,
    score: team.score,
    winner: team.winner,
    home,
    players: (box?.Children ?? []).flatMap((row) => toPlayerLine(row, people) ?? []),
  };
}

async function loadBoxscore(id: string): Promise<{ boxscore: NbaBoxscore; final: boolean }> {
  if (!isGameId(id)) throw new Error("Vigane mängu id");
  const now = Date.now();
  const path = eventPath(seasonStart(new Date(now)));
  const raw = await fetchSeasonGames(path);
  const source = raw.find((game) => String(game.gameId) === id);
  const game = source && isOurGame(source) ? toGame(source, recordsOf(raw), now) : null;
  if (!source || !game) throw new Error("Mängu ei leitud");

  // Mängulehe lõplik aadress "135816-KLV-KRFZ"; ainult id suunab sinna ümber (lühendite puudumisel).
  const [codeA, codeB] = [source.teamA?.code, source.teamB?.code];
  const slug = codeA && codeB ? `${id}-${encodeURIComponent(codeA)}-${encodeURIComponent(codeB)}` : id;
  const payload = await fetchPayload(`${path}/games/${slug}`, '"gameDetails":{"c":[', { cache: "no-store" });

  const details = valuesOf(payload, "gameDetails").find(
    (value): value is { c: FibaBoxTeam[] } => Array.isArray((value as { c?: unknown } | null)?.c),
  );
  const people = new Map<string, FibaPerson>();
  for (const key of ["playersTeamA", "playersTeamB"]) {
    for (const list of valuesOf(payload, key)) {
      if (!Array.isArray(list)) continue;
      for (const person of list as FibaPerson[]) if (typeof person?.personId === "number") people.set(String(person.personId), person);
    }
  }

  const boxTeams = details?.c ?? [];
  // Võõrsil mängiv tiim ette, nagu mängude nimekirjas.
  const boxscore: NbaBoxscore = {
    gameId: id,
    teams: [toTeamBox(game.away, source.teamB, boxTeams, people, false), toTeamBox(game.home, source.teamA, boxTeams, people, true)],
  };
  return { boxscore, final: game.completed };
}

export async function getLiveBoxscore(id: string): Promise<NbaBoxscore> {
  return (await loadBoxscore(id)).boxscore;
}

/** Lõppenud mängu boxscore jääb vahemällu igaveseks; pooleli mäng visatakse (ei salvestu). */
export const getFinalBoxscore = unstable_cache(
  async (id: string): Promise<NbaBoxscore> => {
    const { boxscore, final } = await loadBoxscore(id);
    if (!final) throw new Error("Mäng pole veel lõppenud");
    if (boxscore.teams.some((team) => team.players.length === 0)) throw new Error("Boxscore puudub");
    return boxscore;
  },
  ["europecup-final-boxscore-v1"],
  { revalidate: false },
);

/** Ainult Eesti klubide mängijad; vastase tiim jääb alles, et sooritusel oleks vastane ja tulemus. */
function onlyOurPlayers(boxscore: NbaBoxscore): NbaBoxscore {
  return { ...boxscore, teams: boxscore.teams.map((team) => (OUR_CLUBS.test(team.name) ? team : { ...team, players: [] })) };
}

// --- Parimad sooritused ---

export async function getLeaders(period: NbaPeriod): Promise<NbaLeadersResponse> {
  const { today, days } = await getGameDays(period);
  return buildLeaders({
    league: "europecup",
    today,
    days,
    getFinalBoxscore: async (game) => onlyOurPlayers(await getFinalBoxscore(game.id)),
    concurrency: { days: 2, boxscores: BOXSCORE_CONCURRENCY },
  });
}

// --- Parimad mängijad ---

const round1 = (value: number) => Math.round(value * 10) / 10;
const pct = (made: number, attempted: number) => (attempted > 0 ? Math.round((made / attempted) * 100) : null);

const SUMMED = ["min", "pts", "reb", "ast", "stl", "blk", "tov", "fgm", "fga", "tpm", "tpa", "ftm", "fta", "eff"] as const;

interface Totals extends Record<(typeof SUMMED)[number], number> {
  player: NbaMvpEntry["player"];
  team: { id: string; abbreviation: string; name: string };
  games: number;
}

/**
 * Eesti klubide mängijate hooaja keskmised lõppenud mängude boxscore'idest (need on vahemälus, seega
 * laaditakse ainult uued mängud). Arvesse lähevad mängijad, kes on mänginud vähemalt pooltes oma klubi
 * mängudest.
 */
export async function getMvpRace(): Promise<NbaMvpResponse> {
  const now = Date.now();
  const start = seasonStart(new Date(now));
  const raw = await fetchSeasonGames(eventPath(start));
  const played = raw.filter((game) => isOurGame(game) && isFinal(game));
  const boxscores = await settleWithLimit(played, BOXSCORE_CONCURRENCY, async (game) =>
    onlyOurPlayers(await getFinalBoxscore(String(game.gameId))),
  );

  const totals = new Map<string, Totals>();
  const teamGames = new Map<string, number>();
  for (const boxscore of boxscores) {
    for (const team of boxscore?.teams ?? []) {
      if (team.players.length === 0) continue;
      teamGames.set(team.id, (teamGames.get(team.id) ?? 0) + 1);
      for (const line of team.players) {
        if (line.didNotPlay) continue;
        const total: Totals = totals.get(line.id) ?? {
          player: { id: line.id, name: line.name, shortName: line.shortName, position: line.position, headshot: null },
          team: { id: team.id, abbreviation: team.abbreviation, name: team.shortName },
          games: 0,
          ...(Object.fromEntries(SUMMED.map((key) => [key, 0])) as Record<(typeof SUMMED)[number], number>),
        };
        total.games += 1;
        for (const key of SUMMED) total[key] += line[key];
        totals.set(line.id, total);
      }
    }
  }

  const records = recordsOf(raw);
  const entries = [...totals.values()]
    .filter((total) => total.games >= Math.ceil((teamGames.get(total.team.id) ?? 1) / 2))
    .map((total): NbaMvpEntry => {
      const avg = (value: number) => round1(value / total.games);
      const record = records.get(total.team.id);
      return {
        player: total.player,
        team: {
          abbreviation: total.team.abbreviation,
          name: total.team.name,
          color: null,
          wins: record?.wins ?? null,
          losses: record?.losses ?? null,
        },
        games: total.games,
        min: avg(total.min),
        pts: avg(total.pts),
        reb: avg(total.reb),
        ast: avg(total.ast),
        stl: avg(total.stl),
        blk: avg(total.blk),
        tov: avg(total.tov),
        fgPct: pct(total.fgm, total.fga),
        tpPct: pct(total.tpm, total.tpa),
        ftPct: pct(total.ftm, total.fta),
        eff: avg(total.eff),
      };
    })
    .sort((a, b) => b.eff - a.eff || b.pts - a.pts);

  return { season: seasonLabel(start), players: entries.slice(0, MVP_COUNT) };
}

// --- Tabel ---

/** Tabelilehe grupiturniiri etapid (põhiturniir, teine ring): objektid kujul {"type":"groups",...}. */
function groupStages(payload: string): FibaStandingStage[] {
  const needle = '{"type":"groups"';
  const stages: FibaStandingStage[] = [];
  for (let i = payload.indexOf(needle); i >= 0; i = payload.indexOf(needle, i + needle.length)) {
    const stage = jsonAt(payload, i) as FibaStandingStage | undefined;
    if (stage && Array.isArray(stage.data?.groups)) stages.push(stage);
  }
  return stages;
}

/**
 * Ainult grupid, kus mängib mõni Eesti klubi, viimasest alanud grupiturniirist (põhiturniir, hiljem
 * teine ring, kui mõni klubi sinna pääseb). Järjestus on FIBA ametlik (arvestab ka omavahelisi mänge).
 */
export async function getStandings(): Promise<NbaStandingsResponse> {
  const now = Date.now();
  const start = seasonStart(new Date(now));
  const path = eventPath(start);
  const [payload, raw] = await Promise.all([
    fetchPayload(`${path}/standings`, '{"type":"groups"', { next: { revalidate: STANDINGS_REVALIDATE } }),
    fetchSeasonGames(path),
  ]);

  const teams = new Map<number, FibaTeam>();
  for (const game of raw) {
    for (const team of [game.teamA, game.teamB]) if (typeof team?.teamId === "number") teams.set(team.teamId, team);
  }
  const ours = (group: FibaGroup) => (group.teamsStats ?? []).some((row) => isOurClub(teams.get(num(row.team))));
  const startOf = (stage: FibaStandingStage) => Date.parse(utcIso(stage.startDate) ?? "") || 0;
  const stage = groupStages(payload)
    .filter((s) => (s.current === true || startOf(s) <= now) && (s.data?.groups ?? []).some(ours))
    .sort((a, b) => startOf(b) - startOf(a))[0];
  if (!stage) return { season: seasonLabel(start), note: null, groups: [] };

  const byId = new Map(raw.map((game): [number | undefined, FibaGame] => [game.gameId, game]));
  // Vorm: grupi lõppenud mängud vanimast uusimani, viimased 5.
  const formOf = (teamId: number, group: FibaGroup) =>
    (group.gameIds ?? [])
      .flatMap((gameId) => {
        const game = byId.get(gameId);
        return game && isFinal(game) && (game.teamA?.teamId === teamId || game.teamB?.teamId === teamId) ? [game] : [];
      })
      .sort((a, b) => Date.parse(utcIso(a.gameDateTimeUTC) ?? "") - Date.parse(utcIso(b.gameDateTimeUTC) ?? ""))
      .map((game): "W" | "L" => {
        const home = game.teamA?.teamId === teamId;
        const [own, other] = home ? [game.teamAScore, game.teamBScore] : [game.teamBScore, game.teamAScore];
        return num(own) > num(other) ? "W" : "L";
      })
      .slice(-5);

  const groups = (stage.data?.groups ?? [])
    .filter(ours)
    .sort((a, b) => (a.groupName ?? "").localeCompare(b.groupName ?? ""))
    .flatMap((group): NbaStandingsGroup[] => {
      const rows = (group.teamsStats ?? []).flatMap((row): NbaStandingsRow[] => {
        const team = teams.get(num(row.team));
        if (typeof team?.teamId !== "number" || typeof row.rank !== "number") return [];
        const form = formOf(team.teamId, group);
        return [
          {
            position: row.rank,
            team: { id: String(team.teamId), abbreviation: team.code ?? String(team.teamId), name: teamName(team), logo: logoOf(team) },
            wins: num(row.gamesWon),
            losses: num(row.gamesLost),
            gamesBehind: null,
            pointDiff: typeof row.plusMinus === "number" ? row.plusMinus : null,
            home: null,
            away: null,
            lastTen: null,
            streak: null,
            form: form.length > 0 ? form : null,
            change: null,
          },
        ];
      });
      return rows.length > 0
        ? [{ id: group.groupName ?? "?", name: `${group.groupName}-grupp`, rows: rows.sort((a, b) => a.position - b.position) }]
        : [];
    });

  const rounds = Math.max(0, ...groups.flatMap((group) => group.rows.map((row) => row.wins + row.losses)));
  return { season: seasonLabel(start), note: rounds > 0 ? `pärast ${rounds}. vooru` : null, groups };
}
