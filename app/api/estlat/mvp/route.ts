import { NextResponse } from "next/server";
import { getMvpRace } from "@/lib/estlat/api";
import { requireUser } from "@/lib/server/requireUser";

export const dynamic = "force-dynamic";
// Esimene arvutus loeb kõigi lõppenud mängude boxscore'id (edaspidi vahemälust).
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  try {
    return NextResponse.json(await getMvpRace());
  } catch {
    return NextResponse.json({ error: "Est-Lat liiga MVP race'i laadimine ebaõnnestus" }, { status: 502 });
  }
}
