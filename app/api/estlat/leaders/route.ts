import { NextResponse } from "next/server";
import { parsePeriod } from "@/lib/basketball/period";
import { getLeaders } from "@/lib/estlat/api";
import { requireUser } from "@/lib/server/requireUser";

export const dynamic = "force-dynamic";
// Hooaja esimene arvutus käib läbi kuni 380 boxscore'i; lõppenud päevad tulevad edaspidi vahemälust.
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  const period = parsePeriod(new URL(request.url).searchParams.get("period"));
  if (!period) return NextResponse.json({ error: "Tundmatu ajavahemik" }, { status: 400 });

  try {
    return NextResponse.json(await getLeaders(period));
  } catch {
    return NextResponse.json({ error: "Est-Lat liiga statistika laadimine ebaõnnestus" }, { status: 502 });
  }
}
