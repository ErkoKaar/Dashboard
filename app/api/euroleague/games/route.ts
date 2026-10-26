import { NextResponse } from "next/server";
import { parsePeriod } from "@/lib/basketball/period";
import { getGameDays } from "@/lib/euroleague/api";
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
    return NextResponse.json({ error: "EuroLeague'i mängude laadimine ebaõnnestus" }, { status: 502 });
  }
}
