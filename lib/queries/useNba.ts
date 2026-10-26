import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";

// NBA ja EuroLeague kasutavad samu tüüpe (Nba-eesliide on ajalooline): serveri adapterid
// (lib/nba/espn.ts, lib/euroleague/api.ts) teisendavad oma andmed neisse.

/** Liiga määrab API tee (/api/<liiga>/...) ja React Query võtme. */
export type League = "nba" | "euroleague" | "estlat";

export type NbaPeriod = "today" | "3d" | "7d" | "30d" | "season";

export type NbaGameState = "pre" | "in" | "post";

export interface NbaTeamSide {
  id: string;
  abbreviation: string;
  /** Lühinimi ("Lakers"). */
  name: string;
  logo: string | null;
  /** Null enne mängu algust. */
  score: number | null;
  winner: boolean;
  /** Hooaja võidud-kaotused ("3-1"). */
  record: string | null;
}

export interface NbaGame {
  id: string;
  /** NBA mängupäev USA aja järgi ("2026-10-25"). */
  gameDay: string;
  /** Algusaeg ISO kujul (UTC). */
  startTime: string;
  /** false, kui algusaeg pole veel kinnitatud. */
  timeKnown: boolean;
  state: NbaGameState;
  completed: boolean;
  /** ESPN-i staatus: STATUS_FINAL, STATUS_HALFTIME, STATUS_POSTPONED jne. */
  status: string;
  period: number;
  clock: string;
  /** "Eelhooaeg" või "Tähtede mäng"; tavalisel mängul null. */
  note: string | null;
  /** Eelhooaja ja tähtede mängu top 10 ei arvesta. */
  countsForStats: boolean;
  away: NbaTeamSide;
  home: NbaTeamSide;
  /** ESPN-i mänguülevaade (artikkel); ainult lõppenud mängul. Pealkiri võib puududa. */
  recap: { url: string; headline: string | null } | null;
  /** Highlight-video ESPN-is; kestus sekundites, kui teada. */
  video: { url: string; duration: number | null } | null;
  /** Motion Stationi "Game Recap" video YouTube'is; kestus on teada ainult API võtmega. */
  youtube: { url: string; videoId: string; duration: number | null } | null;
}

/** Mida videoaken mängib: Motion Stationi recap (lib/nba/clip.ts ehitab selle mängust). */
export interface NbaRecapClip {
  videoId: string;
  /** "Lakers 132, Jazz 123" */
  title: string;
  /** ESPN-i mänguülevaate pealkiri, kui see on olemas. */
  headline: string | null;
  duration: number | null;
}

export interface NbaGameDay {
  date: string;
  games: NbaGame[];
}

/** app/api/nba/games: päevad uuemast vanemani, esimene on alati tänane mängupäev. */
export interface NbaGamesResponse {
  today: string;
  days: NbaGameDay[];
}

export interface NbaPlayerLine {
  id: string;
  name: string;
  shortName: string;
  position: string | null;
  headshot: string | null;
  starter: boolean;
  /** Põhjus, kui mängija ei mänginud (nt "COACH'S DECISION"); siis on statistika nullid. */
  didNotPlay: string | null;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  plusMinus: number | null;
  /** Liiga efektiivsus: NBA-s EFF (arvutatud), EuroLeague'is ametlik PIR. */
  eff: number;
}

export interface NbaTeamBox {
  id: string;
  abbreviation: string;
  name: string;
  /** Lühinimi ("Lakers"). */
  shortName: string;
  logo: string | null;
  /** Tiimi põhivärv "#552583" kujul; puudub, kui ESPN seda ei anna. */
  color: string | null;
  score: number | null;
  winner: boolean;
  home: boolean;
  players: NbaPlayerLine[];
}

/** app/api/nba/boxscore: võõrsil mängiv tiim esimesena. */
export interface NbaBoxscore {
  gameId: string;
  teams: NbaTeamBox[];
}

export type NbaLeaderMetric = "eff" | "pts" | "reb" | "ast";

/** Ühe mängu statistika; kõik täisarvud. */
export interface NbaStatLine {
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  plusMinus: number | null;
  /** NBA efektiivsus: PTS + REB + AST + STL + BLK - möödaviskamised - mööda vabavisked - TO. */
  eff: number;
}

/** Ühe mängija üks mäng (parim sooritus valitud mõõdikus). */
export interface NbaPerformance {
  gameId: string;
  gameDay: string;
  player: {
    id: string;
    name: string;
    /** "D. Sabonis": kitsal ekraanil täisnime asemel. */
    shortName: string;
    position: string | null;
    headshot: string | null;
  };
  team: { abbreviation: string; name: string; color: string | null };
  /** Vastase lühend. */
  opponent: string;
  home: boolean;
  /** null, kui tulemust ei saa skoorist välja lugeda. */
  won: boolean | null;
  teamScore: number | null;
  opponentScore: number | null;
  stats: NbaStatLine;
  /** Motion Stationi video (avaneb videoaknas); puudumisel ESPN-i artikkel recapUrl. */
  clip: NbaRecapClip | null;
  recapUrl: string | null;
}

/** app/api/nba/leaders: iga mõõdiku top 10, igalt mängijalt tema parim mäng selles mõõdikus. */
export interface NbaLeadersResponse {
  top: Record<NbaLeaderMetric, NbaPerformance[]>;
  /** Lõppenud mängud, mille boxscore õnnestus kätte saada / kõik lõppenud mängud. */
  gamesCounted: number;
  gamesTotal: number;
}

/** MVP race: hooaja keskmised (ühe komakohaga), protsendid täisarvudena. */
export interface NbaMvpEntry {
  player: { id: string; name: string; shortName: string; position: string | null; headshot: string | null };
  team: { abbreviation: string; name: string; color: string | null; wins: number | null; losses: number | null };
  games: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgPct: number | null;
  tpPct: number | null;
  ftPct: number | null;
  /** Hooaja EFF mängu kohta: järjestuse alus. */
  eff: number;
}

/** app/api/nba/mvp: 10 parimat hooaja EFF järgi (ESPN-i kvalifitseerunud mängijad). */
export interface NbaMvpResponse {
  /** "2026-27" */
  season: string | null;
  players: NbaMvpEntry[];
}

/** Tabeli rida. Liigal puuduv väli on null (NBA-l pole vormi ega koha muutust, EuroLeague'il GB-d ja seeriat). */
export interface NbaStandingsRow {
  position: number;
  team: { id: string; abbreviation: string; name: string; logo: string | null };
  wins: number;
  losses: number;
  /** Mänge liidrist maas: "3", "1.5", liidril "-". */
  gamesBehind: string | null;
  pointDiff: number | null;
  /** Bilanss kodus ja võõrsil: "5-1". */
  home: string | null;
  away: string | null;
  lastTen: string | null;
  /** Seeria: "W3" võidud järjest, "L2" kaotused. */
  streak: string | null;
  /** Viimased mängud vanimast uusimani. */
  form: ("W" | "L")[] | null;
  /** Koha muutus eelmise vooruga võrreldes. */
  change: "up" | "down" | null;
}

export interface NbaStandingsGroup {
  id: string;
  /** "Ida" / "Lääs"; ühe tabeliga liigal null. */
  name: string | null;
  rows: NbaStandingsRow[];
}

/** app/api/<liiga>/standings: põhiturniiri tabel (NBA kaks konverentsi, EuroLeague üks tabel). */
export interface NbaStandingsResponse {
  /** "2026-27" */
  season: string | null;
  /** Hooaja järel näidatav täpsustus, EuroLeague: "pärast 7. vooru". */
  note: string | null;
  groups: NbaStandingsGroup[];
}

// Kõik käivad läbi app/api/<liiga>/*: server kärbib vastused ja hoiab lõppenud mängud
// vahemälus. keepPreviousData: ajavahemiku vahetusel jäävad vanad andmed tuhmilt näha,
// kuni uued jõuavad.

export function useNbaGames(period: NbaPeriod, league: League) {
  return useQuery({
    queryKey: [league, "games", period],
    queryFn: async ({ signal }): Promise<NbaGamesResponse> => {
      const res = await apiFetch(`/api/${league}/games?period=${period}`, { signal });
      if (!res.ok) throw new Error("Mängude laadimine ebaõnnestus");
      return res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    // Live-mängu ajal iga 30 s, muidu piisab 5 minutist.
    refetchInterval: (query) =>
      query.state.data?.days.some((day) => day.games.some((game) => game.state === "in"))
        ? 30 * 1000
        : 5 * 60 * 1000,
  });
}

export function useNbaBoxscore(gameId: string, completed: boolean, league: League) {
  return useQuery({
    // completed võtmes: mängu lõppedes tuuakse lõplik (serveris vahemällu jääv) versioon.
    queryKey: [league, "boxscore", gameId, completed],
    queryFn: async ({ signal }): Promise<NbaBoxscore> => {
      const query = new URLSearchParams({ id: gameId });
      if (completed) query.set("final", "1");
      const res = await apiFetch(`/api/${league}/boxscore?${query}`, { signal });
      if (!res.ok) throw new Error("Boxscore'i laadimine ebaõnnestus");
      return res.json();
    },
    staleTime: completed ? Infinity : 15 * 1000,
    refetchInterval: completed ? false : 30 * 1000,
  });
}

export function useNbaLeaders(period: NbaPeriod, league: League) {
  return useQuery({
    queryKey: [league, "leaders", period],
    queryFn: async ({ signal }): Promise<NbaLeadersResponse> => {
      const res = await apiFetch(`/api/${league}/leaders?period=${period}`, { signal });
      if (!res.ok) throw new Error("Statistika laadimine ebaõnnestus");
      return res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

export function useNbaMvpRace(league: League) {
  return useQuery({
    queryKey: [league, "mvp"],
    queryFn: async ({ signal }): Promise<NbaMvpResponse> => {
      const res = await apiFetch(`/api/${league}/mvp`, { signal });
      if (!res.ok) throw new Error("MVP race'i laadimine ebaõnnestus");
      return res.json();
    },
    // Hooaja keskmised muutuvad ainult mängude lõppedes; server hoiab neid tund aega.
    staleTime: 30 * 60 * 1000,
  });
}

export function useNbaStandings(league: League) {
  return useQuery({
    queryKey: [league, "standings"],
    queryFn: async ({ signal }): Promise<NbaStandingsResponse> => {
      const res = await apiFetch(`/api/${league}/standings`, { signal });
      if (!res.ok) throw new Error("Tabeli laadimine ebaõnnestus");
      return res.json();
    },
    // Tabel muutub ainult mängude lõppedes; server hoiab seda 5 minutit.
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}
