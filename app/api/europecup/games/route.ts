import { NextResponse } from "next/server";
import { parsePeriod } from "@/lib/basketball/period";
import { getGameDays } from "@/lib/europecup/api";
import { requireUser } from "@/lib/server/requireUser";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  const period = parsePeriod(new URL(request.url).searchParams.get("period"));
  if (!period) return NextResponse.json({ error: "Tundmatu ajavahemik" }, { status: 400 });

  try {
    return NextResponse.json(await getGameDays(period));
  } catch {
    return NextResponse.json({ error: "Europe Cupi mängude laadimine ebaõnnestus" }, { status: 502 });
  }
}
