import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/requireUser";

// EstHoopi backend'i CORS-i loendis dashboardi pole (ei toodangu aadressi ega dev-porti), seega
// brauser küsib siit ja server küsib backend'ist. Lubatud on ainult koondise widgeti endpoint'id,
// et route ei oleks lahtine proxy kogu backend'ile.
const ALLOWED = new Set(["national-team/games", "national-team/game-stats", "players"]);
// Ülempiir, et rippuv backend ei hoiaks funktsiooni kinni.
const TIMEOUT_MS = 60_000;

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  const path = (await params).path.join("/");
  if (!ALLOWED.has(path)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const baseUrl = process.env.NEXT_PUBLIC_ESTHOOP_API_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_ESTHOOP_API_URL puudub" }, { status: 500 });
  }

  try {
    const res = await fetch(`${baseUrl}/${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error("upstream");
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "EstHoop andmete laadimine ebaõnnestus" }, { status: 502 });
  }
}
