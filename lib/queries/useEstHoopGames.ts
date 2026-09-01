import { useQuery } from "@tanstack/react-query";

export interface EstHoopEvent {
  id: string;
  startTimestamp: number;
  timeTBD: boolean;
  homeTeam: { name: string };
  awayTeam: { name: string };
  homeScore?: { current: number };
  awayScore?: { current: number };
  tournament?: { name: string };
}

export interface EstHoopGames {
  upcoming: EstHoopEvent[];
  recent: EstHoopEvent[];
}

export function useEstHoopGames() {
  return useQuery({
    queryKey: ["esthoop-games"],
    queryFn: async (): Promise<EstHoopGames> => {
      const baseUrl = process.env.NEXT_PUBLIC_ESTHOOP_API_URL;
      if (!baseUrl) throw new Error("NEXT_PUBLIC_ESTHOOP_API_URL puudub");

      const res = await fetch(`${baseUrl}/national-team/games`);
      if (!res.ok) throw new Error("EstHoop andmete laadimine ebaõnnestus");
      return res.json();
    },
  });
}

interface EstHoopBoxScorePlayer {
  name: string;
  pts: number;
  reb: number;
  ast: number;
}

interface EstHoopBoxScore {
  id: string;
  homePlayers: EstHoopBoxScorePlayer[];
  awayPlayers: EstHoopBoxScorePlayer[];
}

interface EstHoopPlayer {
  name: string;
  slug: string;
}

export interface EstHoopTopScorer {
  name: string;
  slug: string | null;
  pts: number;
  reb: number;
  ast: number;
  game: EstHoopEvent;
}

export function useEstHoopTopScorer() {
  return useQuery({
    queryKey: ["esthoop-top-scorer"],
    queryFn: async (): Promise<EstHoopTopScorer | null> => {
      const baseUrl = process.env.NEXT_PUBLIC_ESTHOOP_API_URL;
      if (!baseUrl) throw new Error("NEXT_PUBLIC_ESTHOOP_API_URL puudub");

      const [gamesRes, boxScoresRes, playersRes] = await Promise.all([
        fetch(`${baseUrl}/national-team/games`),
        fetch(`${baseUrl}/national-team/game-stats`),
        fetch(`${baseUrl}/players`),
      ]);
      if (!gamesRes.ok || !boxScoresRes.ok || !playersRes.ok) {
        throw new Error("EstHoop andmete laadimine ebaõnnestus");
      }

      const games: EstHoopGames = await gamesRes.json();
      const lastGame = games.recent[0];
      if (!lastGame) return null;

      const boxScores: EstHoopBoxScore[] = await boxScoresRes.json();
      const boxScore = boxScores.find((b) => b.id === lastGame.id);
      if (!boxScore) return null;

      const estoniaPlayers =
        lastGame.homeTeam.name === "Estonia" ? boxScore.homePlayers : boxScore.awayPlayers;
      if (!estoniaPlayers?.length) return null;

      const top = [...estoniaPlayers].sort((a, b) => b.pts - a.pts)[0];

      // Box score'i nimed tulevad ilma diakriitikuteta ("Kullamae"), players-endpoint
      // diakriitikutega ("Kullamäe") — võrdle normaliseeritult.
      const normalize = (name: string) =>
        name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
      const players: EstHoopPlayer[] = await playersRes.json();
      const slug = players.find((p) => normalize(p.name) === normalize(top.name))?.slug ?? null;

      return { name: top.name, slug, pts: top.pts, reb: top.reb, ast: top.ast, game: lastGame };
    },
  });
}
