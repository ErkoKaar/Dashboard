import { useQuery } from "@tanstack/react-query";
import { toDateString } from "@/lib/date";

const USERNAME = process.env.NEXT_PUBLIC_CHESS_USERNAME;

export interface ChessStats {
  rating: { current: number; best: number };
  record: { win: number; loss: number; draw: number };
}

export function useChessStats() {
  return useQuery({
    queryKey: ["chess-stats"],
    queryFn: async (): Promise<ChessStats> => {
      if (!USERNAME) throw new Error("NEXT_PUBLIC_CHESS_USERNAME puudub");

      const res = await fetch(`https://api.chess.com/pub/player/${USERNAME}/stats`);
      if (!res.ok) throw new Error("Chess.com andmete laadimine ebaõnnestus");

      const json = await res.json();
      const rapid = json.chess_rapid;
      if (!rapid) throw new Error("Rapid andmeid ei leitud");

      return {
        rating: { current: rapid.last.rating, best: rapid.best.rating },
        record: { win: rapid.record.win, loss: rapid.record.loss, draw: rapid.record.draw },
      };
    },
  });
}

export interface ChessTrendPoint {
  date: string;
  rating: number;
  result: "win" | "loss" | "draw";
}

interface ChessGame {
  time_class: string;
  end_time: number;
  white?: { username: string; rating: number; result: string };
  black?: { username: string; rating: number; result: string };
}

const DRAW_RESULTS = new Set([
  "agreed",
  "repetition",
  "stalemate",
  "insufficient",
  "50move",
  "timevsinsufficient",
]);

function toResult(raw: string): "win" | "loss" | "draw" {
  if (raw === "win") return "win";
  if (DRAW_RESULTS.has(raw)) return "draw";
  return "loss";
}

function lastThreeMonths(): { year: number; month: number }[] {
  const now = new Date();
  return [2, 1, 0].map((i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

export function useChessTrend() {
  return useQuery({
    queryKey: ["chess-trend"],
    queryFn: async (): Promise<ChessTrendPoint[]> => {
      if (!USERNAME) throw new Error("NEXT_PUBLIC_CHESS_USERNAME puudub");
      const usernameLower = USERNAME.toLowerCase();

      const months = lastThreeMonths();
      const responses = await Promise.all(
        months.map(({ year, month }) =>
          fetch(`https://api.chess.com/pub/player/${USERNAME}/games/${year}/${String(month).padStart(2, "0")}`).then(
            (res) => (res.ok ? res.json() : { games: [] as ChessGame[] }),
          ),
        ),
      );

      const raw: { endTime: number; rating: number; result: "win" | "loss" | "draw" }[] = [];
      for (const { games } of responses as { games: ChessGame[] }[]) {
        for (const game of games ?? []) {
          if (game.time_class !== "rapid") continue;
          const side =
            game.white?.username?.toLowerCase() === usernameLower
              ? game.white
              : game.black?.username?.toLowerCase() === usernameLower
                ? game.black
                : null;
          if (!side) continue;
          raw.push({ endTime: game.end_time, rating: side.rating, result: toResult(side.result) });
        }
      }

      return raw
        .sort((a, b) => a.endTime - b.endTime)
        .map(({ endTime, rating, result }) => ({
          date: toDateString(new Date(endTime * 1000)),
          rating,
          result,
        }));
    },
  });
}
