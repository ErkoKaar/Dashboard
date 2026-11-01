import type {
  NbaBoxscore,
  NbaGame,
  NbaPlayerProfile,
  NbaProfileGame,
  NbaSeasonAverages,
  NbaStatLine,
} from "@/lib/queries/useNba";

// Mängija profiil kõigile liigadele (app/api/<liiga>/player). NBA ja EuroLeague annavad mängulogi oma
// API-st; Est-Lat ja Europe Cup arvutavad selle vahemälus olevatest boxscore'idest (profileFromBoxscores).

export const PROFILE_GAMES = 5;

export type StatTotals = Omit<NbaStatLine, "pf" | "plusMinus">;

const round1 = (value: number) => Math.round(value * 10) / 10;
const pct = (made: number, attempted: number) => (attempted > 0 ? Math.round((made / attempted) * 100) : null);

/** Hooaja keskmised mängitud mängude ridadest; null, kui mänge pole. */
export function averagesOf(lines: StatTotals[]): NbaSeasonAverages | null {
  if (lines.length === 0) return null;
  const sum = (key: keyof StatTotals) => lines.reduce((total, line) => total + line[key], 0);
  const avg = (key: keyof StatTotals) => round1(sum(key) / lines.length);
  return {
    games: lines.length,
    min: avg("min"),
    pts: avg("pts"),
    reb: avg("reb"),
    ast: avg("ast"),
    stl: avg("stl"),
    blk: avg("blk"),
    tov: avg("tov"),
    fgPct: pct(sum("fgm"), sum("fga")),
    tpPct: pct(sum("tpm"), sum("tpa")),
    ftPct: pct(sum("ftm"), sum("fta")),
    eff: avg("eff"),
  };
}

/** Täisaastad sünniajast ("1996-10-04..."); vigase kuupäeva korral null. */
export function ageFrom(birthDate: string | undefined, now: Date): number | null {
  const birth = birthDate ? new Date(birthDate) : null;
  if (!birth || Number.isNaN(birth.getTime())) return null;
  const age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  return beforeBirthday ? age - 1 : age;
}

/**
 * Mängija hooaeg boxscore'idest (Est-Lat, Europe Cup): arvesse lähevad mängud, kus ta mängis. Tiim ja
 * nimi tulevad viimasest mängust; foto ja värvi lisab liiga adapter. Mängijat ei leitud: null.
 */
export function profileFromBoxscores(
  playerId: string,
  entries: { game: NbaGame; boxscore: NbaBoxscore }[],
): NbaPlayerProfile | null {
  const appearances = entries
    .flatMap(({ game, boxscore }) => {
      const team = boxscore.teams.find((t) => t.players.some((player) => player.id === playerId));
      const line = team?.players.find((player) => player.id === playerId);
      if (!team || !line || line.didNotPlay) return [];
      return [{ game, team, opponent: boxscore.teams.find((t) => t.id !== team.id), line }];
    })
    .sort((a, b) => Date.parse(b.game.startTime) - Date.parse(a.game.startTime));
  if (appearances.length === 0) return null;

  const { team, line } = appearances[0];
  const games = appearances.slice(0, PROFILE_GAMES).map(({ game, team, opponent, line }): NbaProfileGame => {
    const opponentScore = opponent?.score ?? null;
    return {
      date: game.gameDay,
      opponent: opponent?.abbreviation ?? "?",
      home: team.home,
      won: team.score !== null && opponentScore !== null && team.score !== opponentScore ? team.score > opponentScore : null,
      teamScore: team.score,
      opponentScore,
      stats: { min: line.min, pts: line.pts, reb: line.reb, ast: line.ast, eff: line.eff },
    };
  });
  return {
    player: { id: line.id, name: line.name, position: line.position, headshot: line.headshot, jersey: null },
    team: { abbreviation: team.abbreviation, name: team.shortName, logo: team.logo, color: team.color },
    bio: [],
    season: averagesOf(appearances.map((appearance) => appearance.line)),
    games,
  };
}
