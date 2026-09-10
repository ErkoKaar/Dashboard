import { NextResponse } from "next/server";
import type { ClubPlayer, ClubScheduleGame } from "@/lib/queries/useEstHoopClub";

// Klubide mängugraafik elab EstHoopi frontendi bundle'is (src/data/...), mitte
// backendi API-s — loeme selle otse avalikust repost, et graafiku muudatused
// jõuaksid siia ilma faili kopeerimata. Hooaja vahetumisel tuleb URL uuendada.
const SCHEDULE_URL =
  "https://raw.githubusercontent.com/ErkoKaar/EstHoop/main/frontend/src/data/klubide_graafikud_2026-27.json";

const LIMIT = 5;
const TALLINN = "Europe/Tallinn";
const DAY = 86400;
const REVALIDATE = 600;

// 174 KB JSON-i ja 24 mängija nimekirja ei taha brauserisse saata — kogu töö
// käib serveris ja välja läheb ainult LIMIT rida.
export const dynamic = "force-dynamic";

// JSON-i riiginimi -> IANA ajavöönd. Klubi koduareeni vöönd; võõrsilmäng teises
// vööndis võib olla paigast, aga graafik ise annab aja koduriigi ajas.
const COUNTRY_TZ: Record<string, string> = {
  Eesti: TALLINN,
  Leedu: "Europe/Vilnius",
  Poola: "Europe/Warsaw",
  Saksamaa: "Europe/Berlin",
  Itaalia: "Europe/Rome",
  Hispaania: "Europe/Madrid",
  Prantsusmaa: "Europe/Paris",
  Rumeenia: "Europe/Bucharest",
  Jaapan: "Asia/Tokyo",
  USA: "America/New_York",
};

// Pikad sarjanimed kitsasse veergu. Ülejäänud lühendab truncate widgetis.
const COMPETITION_SHORT: Record<string, string> = {
  "Basketball Champions League": "BCL",
  "FIBA Europe Cup": "FIBA EC",
  "NCAA Division I": "NCAA",
  "Betclic Elite": "Betclic",
  "Eesti-Läti liiga": "EL liiga",
};

interface ScheduleJson {
  clubs?: {
    club?: string;
    country?: string;
    players?: string[];
    competitions?: {
      name?: string;
      games?: { date?: string; time_local?: string | null; home?: boolean; opponent?: string }[];
    }[];
  }[];
}

interface EstHoopPlayer {
  name: string;
  slug: string;
}

/** Ajavööndi nihe sekundites antud ajahetkel. */
function tzOffsetSeconds(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - utcMs) / 1000);
}

/**
 * Seinakella aeg ("2026-09-19", "18:30") ajavööndis tz -> unix-sekundid.
 * Kaks iteratsiooni katavad suveaja ülemineku, kus esimene nihe võib olla vale.
 */
function zonedToTimestamp(date: string, time: string, tz: string): number | null {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (![y, m, d, hh, mm].every(Number.isFinite)) return null;

  const wall = Date.UTC(y, m - 1, d, hh, mm) / 1000;
  if (!Number.isFinite(wall)) return null;
  let ts = wall - tzOffsetSeconds(wall * 1000, tz);
  ts = wall - tzOffsetSeconds(ts * 1000, tz);
  return ts;
}

// Nimede sidumine graafiku JSON-i ja API vahel: täpitähed, sidekriipsud ja
// tühikud ei tohi rolli mängida ("Maik-Kalev Kotsar" vs "Maik Kalev Kotsar").
function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function competitionLabel(name: string): string {
  // Sulgudes täpsustus maha ("PLK (Orlen Basket Liga)"), samuti hooaja aasta
  // ("Supercoppa LBA 2026") — kumbki ei mahu ega lisa infot.
  const base = name
    .replace(/\s*\(.*$/, "")
    .replace(/\s+\d{4}$/, "")
    .trim();
  return COMPETITION_SHORT[base] ?? base;
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_ESTHOOP_API_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_ESTHOOP_API_URL puudub" }, { status: 500 });
  }

  let schedule: ScheduleJson;
  let players: EstHoopPlayer[];
  try {
    const [scheduleRes, playersRes] = await Promise.all([
      fetch(SCHEDULE_URL, { next: { revalidate: REVALIDATE } }),
      fetch(`${baseUrl}/players`, { next: { revalidate: REVALIDATE } }),
    ]);
    if (!scheduleRes.ok || !playersRes.ok) throw new Error("upstream");
    [schedule, players] = await Promise.all([scheduleRes.json(), playersRes.json()]);
  } catch {
    return NextResponse.json({ error: "Klubigraafiku laadimine ebaõnnestus" }, { status: 502 });
  }

  const byNameKey = new Map<string, ClubPlayer>(
    (players ?? []).map((p) => [nameKey(p.name), { name: p.name, slug: p.slug }]),
  );
  const now = Math.floor(Date.now() / 1000);
  // Järjestusvõti jääb serverisse; väljapoole läheb kuupäev ISO stringina, et
  // brauser ei peaks kuupäeva ajatemplist tagasi arvutama.
  const games: { sortTimestamp: number; game: ClubScheduleGame }[] = [];

  for (const club of schedule.clubs ?? []) {
    if (!club.club) continue;
    // Klubi, mille koosseisust ühtki meie mängijat ei leia, ei kuulu siia.
    const clubPlayers = (club.players ?? [])
      .map((n) => byNameKey.get(nameKey(n)))
      .filter((p): p is ClubPlayer => Boolean(p));
    if (clubPlayers.length === 0) continue;

    const tz = COUNTRY_TZ[club.country ?? ""] ?? TALLINN;

    for (const comp of club.competitions ?? []) {
      for (const game of comp.games ?? []) {
        if (!game.date || !game.opponent) continue;

        // Kellaajata mängul on kuupäev ainus, mida teame — kasutame Eesti
        // päeva, sest just Eesti aja järgi kuvame ja kaotame ta graafikust.
        const dayStart = zonedToTimestamp(game.date, "00:00", TALLINN);
        if (dayStart == null) continue;

        const startTimestamp = game.time_local
          ? zonedToTimestamp(game.date, game.time_local, tz)
          : null;
        const visibleUntil = startTimestamp ?? dayStart + DAY;
        if (visibleUntil <= now) continue;

        games.push({
          // Kellaajata mäng läheb oma päeva lõppu.
          sortTimestamp: startTimestamp ?? dayStart + DAY - 1,
          game: {
            id: `${club.club}|${comp.name ?? ""}|${game.date}|${game.opponent}`,
            players: clubPlayers,
            club: club.club,
            opponent: game.opponent,
            home: Boolean(game.home),
            competition: competitionLabel(comp.name ?? ""),
            date: game.date,
            startTimestamp,
          },
        });
      }
    }
  }

  games.sort((a, b) => a.sortTimestamp - b.sortTimestamp);
  return NextResponse.json({ games: games.slice(0, LIMIT).map((g) => g.game) });
}
