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
  NbaStandingsResponse,
  NbaStandingsRow,
  NbaTeamBox,
  NbaTeamSide,
} from "@/lib/queries/useNba";

// Ainult serveris (app/api/estlat/*). Eesti-Läti korvpalliliiga avalikku API-t ei paku: andmed
// loetakse estlatbl.com lehtede HTML-tabelitest (ajakava, tulemused, boxscore, turniiritabel) ja
// teisendatakse samadesse tüüpidesse nagu NBA (useNba.ts). Lehe märgistuse muutumisel lakkab
// lugemine töötamast: siis annab route vea ja vaade näitab veateadet. Efektiivsus on liiga oma EF.

const SITE = "https://www.estlatbl.com/et";
const PAGE_REVALIDATE = 300;
const TALLINN = "Europe/Tallinn";
// Mäng koos pausidega: alguse järel nii kaua "käimas", siis ilma tulemuseta "ootab tulemust".
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;
const MVP_COUNT = 10;
// Leht on väike ja ühe lehe HTML ~300 KB: boxscore'e korraga kuni 4.
const BOXSCORE_CONCURRENCY = 4;

// --- HTML ---

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(html: string): string {
  return html.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#")) {
      const point = code[1].toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    }
    return ENTITIES[code.toLowerCase()] ?? entity;
  });
}

/** Märgenditeta tekst ühe tühikuga. */
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const rowsOf = (html: string) => [...html.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => m[0]);
// Lehel on päises <th>...</td> paare: lõpumärgend võib olla kumbki.
const cellsOf = (row: string) => [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((m) => m[1]);
const tablesOf = (html: string) => [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map((m) => m[0]);
const imageOf = (html: string) => html.match(/<img[^>]+src="(https:\/\/[^"]+)"/)?.[1] ?? null;

/** Lehe sisuosa: ülal on mängude karussell, mille numbrid ei tohi tabelitega segi minna. */
async function fetchPage(path: string): Promise<string> {
  const html = await fetchText(`${SITE}/${path}`, { next: { revalidate: PAGE_REVALIDATE } });
  const start = html.indexOf("<article");
  return start >= 0 ? html.slice(start) : html;
}

// --- Abifunktsioonid ---

function tallinnDate(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TALLINN, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

/** Eesti kohalik aeg (Läti on samas ajavööndis) -> ISO UTC. */
function tallinnToIso(year: number, month: number, day: number, hour: number, minute: number): string {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TALLINN,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const offset = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute")) - guess;
  return new Date(guess - offset).toISOString();
}

/** Hooaeg vahetub juulis: 2026. aasta oktoobris on käimas 2026-27. */
function seasonLabel(now: Date): string {
  const year = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

// --- Mängud ---

interface RawSide {
  code: string;
  name: string;
  logo: string | null;
  score: number | null;
}

interface RawGame {
  id: string;
  start: string;
  /** Tulemuste lehelt: mäng on lõppenud ja skoor lõplik. */
  played: boolean;
  home: RawSide;
  away: RawSide;
}

function parseSide(cell: string, kind: "home" | "visitor", score: number | null): RawSide | null {
  const name = text(cell.match(new RegExp(`${kind}TeamNameDesktop">([\\s\\S]*?)</span>`))?.[1] ?? "");
  const code = text(cell.match(new RegExp(`${kind}TeamNameMobile">([\\s\\S]*?)</span>`))?.[1] ?? "");
  if (!name || !code) return null;
  return { code, name, logo: imageOf(cell), score };
}

/** Ajakava ja tulemuste tabeli read: "P 25.10.2026, 17:00 | BC Pärnu PAR | 91:77 | Latvijas Universitāte LAT". */
function parseGameRows(html: string, played: boolean): RawGame[] {
  return rowsOf(html).flatMap((row): RawGame[] => {
    const id = row.match(/(?:tulemused\/|gid=)(\d{9,12})/)?.[1];
    const cells = cellsOf(row);
    if (!id || cells.length < 4) return [];
    const when = text(cells[0]).match(/(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s+(\d{1,2}):(\d{2})/);
    if (!when) return [];
    const [, day, month, year, hour, minute] = when.map(Number);
    const score = text(cells[2]).match(/^(\d+)\s*:\s*(\d+)$/);
    const home = parseSide(cells[1], "home", score ? Number(score[1]) : null);
    const away = parseSide(cells[3], "visitor", score ? Number(score[2]) : null);
    if (!home || !away) return [];
    return [{ id, start: tallinnToIso(year, month, day, hour, minute), played: played && score !== null, home, away }];
  });
}

// Sama protsessi päringud jagavad 30 s üht mängukava (boxscore'id ja MVP vajavad seda samuti).
const SEASON_MEMO_MS = 30 * 1000;
let seasonMemo: { at: number; games: Promise<RawGame[]> } | null = null;

function fetchSeason(): Promise<RawGame[]> {
  if (seasonMemo && Date.now() - seasonMemo.at < SEASON_MEMO_MS) return seasonMemo.games;
  const games = Promise.all([fetchPage("tulemused"), fetchPage("ajakava")]).then(([results, schedule]) => {
    const played = parseGameRows(results, true);
    const ids = new Set(played.map((game) => game.id));
    const games = [...played, ...parseGameRows(schedule, false).filter((game) => !ids.has(game.id))];
    if (games.length === 0) throw new Error("Est-Lat liiga mängukava ei õnnestunud lugeda");
    return games;
  });
  games.catch(() => {
    seasonMemo = null;
  });
  seasonMemo = { at: Date.now(), games };
  return games;
}

type Records = Map<string, { wins: number; losses: number }>;

function recordsOf(games: RawGame[]): Records {
  const records: Records = new Map();
  for (const game of games) {
    if (!game.played || game.home.score === null || game.away.score === null) continue;
    for (const [side, won] of [
      [game.home, game.home.score > game.away.score],
      [game.away, game.away.score > game.home.score],
    ] as const) {
      const record = records.get(side.code) ?? { wins: 0, losses: 0 };
      if (won) record.wins += 1;
      else record.losses += 1;
      records.set(side.code, record);
    }
  }
  return records;
}

function toTeamSide(side: RawSide, score: number | null, winner: boolean, records: Records): NbaTeamSide {
  const record = records.get(side.code);
  return {
    id: side.code,
    abbreviation: side.code,
    name: side.name,
    logo: side.logo,
    score,
    winner,
    record: record ? `${record.wins}-${record.losses}` : null,
  };
}

function toGame(game: RawGame, records: Records, now: number): NbaGame {
  const start = Date.parse(game.start);
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

  const homeScore = state === "pre" ? null : game.home.score;
  const awayScore = state === "pre" ? null : game.away.score;
  const homeWon = game.played && homeScore !== null && awayScore !== null && homeScore > awayScore;
  const awayWon = game.played && homeScore !== null && awayScore !== null && awayScore > homeScore;
  return {
    id: game.id,
    gameDay: tallinnDate(game.start),
    startTime: game.start,
    timeKnown: true,
    state,
    completed: game.played,
    status,
    period: 0,
    clock: "",
    note: null,
    countsForStats: true,
    away: toTeamSide(game.away, awayScore, awayWon, records),
    home: toTeamSide(game.home, homeScore, homeWon, records),
    recap: null,
    video: null,
    youtube: null,
  };
}

async function seasonGames(now: number): Promise<{ raw: RawGame[]; games: NbaGame[] }> {
  const raw = await fetchSeason();
  const records = recordsOf(raw);
  return { raw, games: raw.map((game) => toGame(game, records, now)) };
}

/** Mängupäevad Eesti aja järgi; liiga ei avalda mänguülevaate videoid, seega recap'e pole. */
export async function getGameDays(period: NbaPeriod): Promise<NbaGamesResponse> {
  const now = Date.now();
  const today = tallinnDate(new Date(now).toISOString());
  const { games } = await seasonGames(now);
  return { today, days: groupGameDays(games, today, period) };
}

// --- Boxscore ---

export const isGameId = (id: string) => /^\d{9,12}$/.test(id);

// Positsioon numbrina: 1 mängujuht, 2 ääremängija, 3 väikeäär, 4 suurääär, 5 tsenter.
const POSITIONS: Record<string, string> = { "1": "G", "2": "G", "3": "F", "4": "F", "5": "C" };

/** "Javeon Christopher Jones" -> "J. Jones". */
function shortName(name: string): string {
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0].charAt(0)}. ${parts[parts.length - 1]}` : name;
}

const slug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** "2-6" -> [2, 6] */
function madeAttempted(value: string | undefined): [number, number] {
  const match = value?.match(/^(\d+)\s*-\s*(\d+)$/);
  return match ? [Number(match[1]), Number(match[2])] : [0, 0];
}

const int = (value: string | undefined) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Tiimi tabel: päises "# | PAR | Pos | Min | PNK | SV | ... | EF". Veerud loetakse päise järgi, mitte
 * järjekorra järgi. Read "Kokku" ja "Võistkond / Peatreener" pole mängijad.
 */
function parseTeamTable(table: string): { code: string; players: NbaPlayerLine[] } | null {
  const [header, ...rows] = rowsOf(table);
  if (!header) return null;
  const labels = cellsOf(header).map(text);
  const col = (label: string) => labels.indexOf(label);
  if (col("Min") < 0 || col("PNK") < 0) return null;
  const code = labels[1];

  const players = rows.flatMap((row): NbaPlayerLine[] => {
    const cells = cellsOf(row);
    const value = (label: string) => (col(label) >= 0 ? text(cells[col(label)] ?? "") : undefined);
    const nameCell = cells[1] ?? "";
    const name = text(nameCell).replace(/\s*\*$/, "");
    if (!name || name === "Kokku" || name.startsWith("Võistkond")) return [];

    const [minutes, seconds] = (value("Min") ?? "").split(":").map(Number);
    const played = Number.isFinite(minutes) && (minutes > 0 || seconds > 0);
    const [fgm, fga] = madeAttempted(value("SV"));
    const [tpm, tpa] = madeAttempted(value("3P"));
    const [ftm, fta] = madeAttempted(value("VV"));
    const plusMinus = Number.parseInt(value("+/-") ?? "", 10);
    return [
      {
        id: `${code}-${slug(name)}`,
        name,
        shortName: shortName(name),
        position: POSITIONS[value("Pos") ?? ""] ?? null,
        headshot: null,
        starter: /Algviisiku mängija/.test(nameCell) || /\*\s*$/.test(text(nameCell)),
        didNotPlay: played ? null : "DNP",
        min: played ? Math.round(minutes + (seconds || 0) / 60) : 0,
        pts: int(value("PNK")),
        reb: int(value("L")),
        ast: int(value("RS")),
        stl: int(value("VL")),
        blk: int(value("BL")),
        tov: int(value("PK")),
        pf: int(value("V")),
        fgm,
        fga,
        tpm,
        tpa,
        ftm,
        fta,
        plusMinus: Number.isFinite(plusMinus) ? plusMinus : null,
        eff: int(value("EF")),
      },
    ];
  });
  return { code, players };
}

function toTeamBox(team: NbaTeamSide, players: NbaPlayerLine[], home: boolean): NbaTeamBox {
  return {
    id: team.id,
    abbreviation: team.abbreviation,
    name: team.name,
    shortName: team.name,
    logo: team.logo,
    color: null,
    score: team.score,
    winner: team.winner,
    home,
    players,
  };
}

async function loadBoxscore(id: string): Promise<{ boxscore: NbaBoxscore; final: boolean }> {
  const [{ games }, html] = await Promise.all([seasonGames(Date.now()), fetchPage(`tulemused/${id}/boxscore`)]);
  const game = games.find((g) => g.id === id);
  if (!game) throw new Error("Mängu ei leitud");

  const tables = tablesOf(html).flatMap((table) => parseTeamTable(table) ?? []);
  const byCode = new Map(tables.map((table) => [table.code, table.players]));
  // Kood päises peaks klappima; kui ei klapi, on lehel kodutiim esimene.
  const homePlayers = byCode.get(game.home.abbreviation) ?? tables[0]?.players ?? [];
  const awayPlayers = byCode.get(game.away.abbreviation) ?? tables[1]?.players ?? [];
  // Võõrsil mängiv tiim ette, nagu mängude nimekirjas.
  const boxscore: NbaBoxscore = {
    gameId: id,
    teams: [toTeamBox(game.away, awayPlayers, false), toTeamBox(game.home, homePlayers, true)],
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
  ["estlat-final-boxscore-v1"],
  { revalidate: false },
);

// --- Parimad sooritused ---

export async function getLeaders(period: NbaPeriod): Promise<NbaLeadersResponse> {
  const { today, days } = await getGameDays(period);
  return buildLeaders({
    league: "estlat",
    today,
    days,
    getFinalBoxscore: (game) => getFinalBoxscore(game.id),
    concurrency: { days: 2, boxscores: 2 },
  });
}

// --- MVP race ---

const round1 = (value: number) => Math.round(value * 10) / 10;
const pct = (made: number, attempted: number) => (attempted > 0 ? Math.round((made / attempted) * 100) : null);

interface Totals {
  player: NbaMvpEntry["player"];
  team: string;
  games: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  eff: number;
}

/**
 * Hooaja keskmised liiga ei avalda mängijate kaupa ühes tabelis: arvutatakse lõppenud mängude
 * boxscore'idest (need on vahemälus, seega ainult uued mängud laaditakse).
 */
export async function getMvpRace(): Promise<NbaMvpResponse> {
  const now = Date.now();
  const { raw, games } = await seasonGames(now);
  const played = games.filter((game) => game.completed);
  const boxscores = await settleWithLimit(played, BOXSCORE_CONCURRENCY, (game) => getFinalBoxscore(game.id));

  const totals = new Map<string, Totals>();
  for (const boxscore of boxscores) {
    for (const team of boxscore?.teams ?? []) {
      for (const line of team.players) {
        if (line.didNotPlay) continue;
        const total = totals.get(line.id) ?? {
          player: { id: line.id, name: line.name, shortName: line.shortName, position: line.position, headshot: null },
          team: team.abbreviation,
          games: 0,
          min: 0,
          pts: 0,
          reb: 0,
          ast: 0,
          stl: 0,
          blk: 0,
          tov: 0,
          fgm: 0,
          fga: 0,
          tpm: 0,
          tpa: 0,
          ftm: 0,
          fta: 0,
          eff: 0,
        };
        total.games += 1;
        for (const key of ["min", "pts", "reb", "ast", "stl", "blk", "tov", "fgm", "fga", "tpm", "tpa", "ftm", "fta", "eff"] as const) {
          total[key] += line[key];
        }
        totals.set(line.id, total);
      }
    }
  }

  const records = recordsOf(raw);
  const teamNames = new Map(raw.flatMap((game) => [[game.home.code, game.home.name] as const, [game.away.code, game.away.name] as const]));
  // Vähemalt pooled liidri mängudest, et paari hea mänguga mängija ei tõuseks ette.
  const mostGames = Math.max(0, ...[...totals.values()].map((total) => total.games));
  const minGames = Math.max(1, Math.ceil(mostGames / 2));

  const entries = [...totals.values()]
    .filter((total) => total.games >= minGames)
    .map((total): NbaMvpEntry => {
      const avg = (value: number) => round1(value / total.games);
      const record = records.get(total.team);
      return {
        player: total.player,
        team: {
          abbreviation: total.team,
          name: teamNames.get(total.team) ?? total.team,
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

  return { season: seasonLabel(new Date(now)), players: entries.slice(0, MVP_COUNT) };
}

// --- Tabel ---

/** Turniiritabel: "1. VEF Rīga | MA | VÕ | KA | PNK | % | PTS+ | PTS- | +/- | H | A | OT | L10". */
export async function getStandings(): Promise<NbaStandingsResponse> {
  const now = Date.now();
  const [html, raw] = await Promise.all([fetchPage("turniiritabel"), fetchSeason()]);
  const [table] = tablesOf(html);
  if (!table) throw new Error("Turniiritabelit ei leitud");

  // Tabelis on tiimi nimi ja logo, koodi pole: kood tuleb mängukavast nime järgi.
  const codes = new Map(raw.flatMap((game) => [[game.home.name, game.home.code] as const, [game.away.name, game.away.code] as const]));
  const results = raw
    .filter((game) => game.played && game.home.score !== null && game.away.score !== null)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const formOf = (code: string) =>
    results
      .filter((game) => game.home.code === code || game.away.code === code)
      .map((game): "W" | "L" => {
        const [own, other] = game.home.code === code ? [game.home, game.away] : [game.away, game.home];
        return (own.score ?? 0) > (other.score ?? 0) ? "W" : "L";
      })
      .slice(-5);

  const [header, ...rows] = rowsOf(table);
  const labels = cellsOf(header ?? "").map(text);
  const col = (label: string) => labels.indexOf(label);
  const standings = rows.flatMap((row, i): NbaStandingsRow[] => {
    const cells = cellsOf(row);
    const value = (label: string) => (col(label) >= 0 ? text(cells[col(label)] ?? "") : "");
    const teamCell = cells[0] ?? "";
    const name = text(teamCell.match(/class="teamName">([\s\S]*?)<\/div>/)?.[1] ?? "");
    if (!name) return [];
    const code = codes.get(name) ?? slug(name).toUpperCase();
    const position = Number.parseInt(text(teamCell.match(/class="standingNr">([\s\S]*?)<\/div>/)?.[1] ?? ""), 10);
    const diff = Number.parseInt(value("+/-"), 10);
    const form = formOf(code);
    return [
      {
        position: Number.isFinite(position) ? position : i + 1,
        team: { id: code, abbreviation: code, name, logo: imageOf(teamCell) },
        wins: int(value("VÕ")),
        losses: int(value("KA")),
        gamesBehind: null,
        pointDiff: Number.isFinite(diff) ? diff : null,
        home: value("H") || null,
        away: value("A") || null,
        lastTen: value("L10") || null,
        streak: null,
        form: form.length > 0 ? form : null,
        change: null,
      },
    ];
  });
  if (standings.length === 0) throw new Error("Turniiritabelit ei õnnestunud lugeda");

  return {
    season: seasonLabel(new Date(now)),
    note: null,
    groups: [{ id: "estlat", name: null, rows: standings.sort((a, b) => a.position - b.position) }],
  };
}
