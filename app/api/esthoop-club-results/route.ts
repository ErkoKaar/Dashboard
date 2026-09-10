import { NextResponse } from "next/server";
import type { ClubResult } from "@/lib/queries/useEstHoopClub";

const LIMIT = 5;
const REVALIDATE = 1800;

// Klubitulemused on laiali 24 mängija stats-endpointi peal — brauser teeks 24
// päringut Renderi vastu, server teeb need korra ja vastus jääb vahemällu.
export const dynamic = "force-dynamic";

interface EstHoopPlayer {
  name: string;
  slug: string;
  proballers_id: number | null;
}

// ProBallersi mängurida nii, nagu EstHoopi API selle edastab (kõik stringid).
interface ProBallersGame {
  DATE?: string;
  OPPONENT?: string;
  LEAGUE?: string;
  RESULT?: string;
  SCORE?: string;
  PTS?: string;
  REB?: string;
  AST?: string;
  MIN?: string;
  GAME_URL?: string;
}

interface PlayerStats {
  seasons?: { TEAM?: string }[];
  clubGames?: ProBallersGame[];
}

/**
 * "May 9, 2026" -> "2026-05-09". Komponendid loeme parsitud kuupäevast välja,
 * et serveri ajavöönd päeva ei nihutaks.
 */
function parseGameDate(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

function parseStat(value: string | undefined): number | null {
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toResults(player: EstHoopPlayer, stats: PlayerStats): ClubResult[] {
  // Klubi nimi tuleb viimasest hooajast — vanema mängu puhul võib see olla
  // juba järgmine klubi, aga täpsemat infot ProBallersi mängurida ei kanna.
  const club = stats.seasons?.at(-1)?.TEAM ?? null;
  const rows: ClubResult[] = [];

  for (const game of stats.clubGames ?? []) {
    const date = game.DATE ? parseGameDate(game.DATE) : null;
    if (date == null) continue;

    // "@ PIN" = võõrsil, "vs PIN" = kodus.
    const opponentField = (game.OPPONENT ?? "").trim();
    if (!opponentField) continue;
    const home = opponentField.startsWith("vs");

    // SCORE on alati "kodu-võõras"; pöörame mängija klubi vaatesse.
    const [first, second] = (game.SCORE ?? "").split("-").map((n) => Number.parseInt(n, 10));
    if (!Number.isFinite(first) || !Number.isFinite(second)) continue;
    const own = home ? first : second;
    const against = home ? second : first;

    // Võit/kaotus: esmalt ProBallersi W/L veerg, selle puudumisel skoorist.
    const result = (game.RESULT ?? "").trim().toUpperCase();
    let won: boolean | null = null;
    if (result === "W") won = true;
    else if (result === "L") won = false;
    else if (own !== against) won = own > against;

    rows.push({
      id: `${player.slug}|${date}|${own}-${against}`,
      player: player.name,
      slug: player.slug,
      club,
      opponent: opponentField.replace(/^(@|vs)\s*/, "") || "?",
      league: game.LEAGUE?.trim() || null,
      date,
      own,
      against,
      home,
      won,
      pts: parseStat(game.PTS),
      reb: parseStat(game.REB),
      ast: parseStat(game.AST),
      min: parseStat(game.MIN),
      gameUrl: game.GAME_URL?.trim() || null,
    });
  }

  return rows;
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_ESTHOOP_API_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_ESTHOOP_API_URL puudub" }, { status: 500 });
  }

  let players: EstHoopPlayer[];
  try {
    const res = await fetch(`${baseUrl}/players`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) throw new Error("upstream");
    players = await res.json();
  } catch {
    return NextResponse.json({ error: "Klubitulemuste laadimine ebaõnnestus" }, { status: 502 });
  }

  // Ühe mängija päringu kukkumine ei tohi kogu nimekirja maha võtta.
  const settled = await Promise.allSettled(
    (players ?? [])
      .filter((p) => p.proballers_id)
      .map(async (player) => {
        const res = await fetch(`${baseUrl}/players/${player.slug}/stats`, {
          next: { revalidate: REVALIDATE },
        });
        if (!res.ok) throw new Error("upstream");
        return toResults(player, await res.json());
      }),
  );

  const results = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  // ISO kuupäev sorteerub leksikograafiliselt kronoloogiliselt — värskeim ette.
  results.sort((a, b) => b.date.localeCompare(a.date));

  // EstHoopi DB-s esineb sama mäng aeg-ajalt kahe vastasekoodiga — id kannab
  // mängija, kuupäeva ja skoori, nii et duplikaat kaob, päevakaksik jääb alles.
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  return NextResponse.json({ results: unique.slice(0, LIMIT) });
}
