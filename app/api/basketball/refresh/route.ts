import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { IS_DEMO } from "@/lib/demo/mode";
import * as estlat from "@/lib/estlat/api";
import * as euroleague from "@/lib/euroleague/api";
import * as europecup from "@/lib/europecup/api";
import * as nba from "@/lib/nba/espn";
import type {
  League,
  NbaGamesResponse,
  NbaLeadersResponse,
  NbaMvpResponse,
  NbaPeriod,
  NbaStandingsResponse,
} from "@/lib/queries/useNba";

// Verceli cron (vercel.json "crons") kutsub seda öösel ja hommikul. Liigavaadete serveri vahemälu
// (fetch revalidate, unstable_cache) annab pärast aegumist esimesele päringule vana seisu ja uuendab
// alles taustal: ainsa kasutaja esimene hommikune avamine näitaks eilse õhtu seisu. See päring teeb
// vahemälu enne korda. Vercel lisab cronile ise päise "Authorization: Bearer <CRON_SECRET>".

export const dynamic = "force-dynamic";
// Neli liigat korraga; külm päev käib läbi kõik päeva boxscore'id (liigade leaders-route'idel on 60).
export const maxDuration = 120;

const MIN_SECRET_LENGTH = 32;
/** Vaadete vaikeperiood (NbaWidget avab 3 päeva); lõppenud päevad jäävad vahemällu ka teistele perioodidele. */
const PERIOD: NbaPeriod = "3d";
/** Esimese läbimise tausta-uuendused jõuavad selle ajaga vahemällu. */
const SECOND_PASS_DELAY_MS = 5000;

interface LeagueApi {
  getGameDays(period: NbaPeriod): Promise<NbaGamesResponse>;
  getLeaders(period: NbaPeriod): Promise<NbaLeadersResponse>;
  getMvpRace(): Promise<NbaMvpResponse>;
  getStandings(): Promise<NbaStandingsResponse>;
}

const LEAGUES: Record<League, LeagueApi> = { nba, euroleague, estlat, europecup };

function authorized(request: Request, expected: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7).trim() : "");
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want);
}

type Outcome = "ok" | "viga";

/** Iga liiga mängud, parimad sooritused, MVP ja tabel korraga; tulemus nime järgi ("nba/games": "ok"). */
async function pass(): Promise<Record<string, Outcome>> {
  const jobs = (Object.keys(LEAGUES) as League[]).flatMap((league) => {
    const api = LEAGUES[league];
    return [
      { name: `${league}/games`, run: () => api.getGameDays(PERIOD) },
      { name: `${league}/leaders`, run: () => api.getLeaders(PERIOD) },
      { name: `${league}/mvp`, run: () => api.getMvpRace() },
      { name: `${league}/standings`, run: () => api.getStandings() },
    ];
  });
  const results = await Promise.allSettled(jobs.map((job) => job.run()));
  return Object.fromEntries(
    results.map((result, i): [string, Outcome] => {
      if (result.status === "rejected") console.error(`[basketball/refresh] ${jobs[i].name}`, result.reason);
      return [jobs[i].name, result.status === "fulfilled" ? "ok" : "viga"];
    }),
  );
}

export async function GET(request: Request) {
  // Demo ehitatakse samast repost samade cronidega; seal pole kedagi, kelle jaoks vahemälu soojendada.
  if (IS_DEMO) return NextResponse.json({ skipped: "demo" });

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    console.error(secret ? `CRON_SECRET on lühem kui ${MIN_SECRET_LENGTH} märki` : "CRON_SECRET puudub");
    return NextResponse.json({ error: "Server pole seadistatud" }, { status: 503 });
  }
  if (!authorized(request, secret)) return NextResponse.json({ error: "Pole lubatud" }, { status: 401 });

  const started = Date.now();
  // Esimene läbimine käivitab aegunud kirjete tausta-uuenduse, teine loeb juba värske seisu ja arvutab
  // lõppenud päevade edetabelid vahemällu (lib/basketball/leaders.ts).
  const first = await pass();
  await new Promise((resolve) => setTimeout(resolve, SECOND_PASS_DELAY_MS));
  const second = await pass();
  return NextResponse.json({ ms: Date.now() - started, first, second });
}
