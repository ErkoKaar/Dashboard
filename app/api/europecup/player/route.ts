import { NextResponse } from "next/server";
import { getPlayerProfile, isPlayerId } from "@/lib/europecup/api";
import { requireUser } from "@/lib/server/requireUser";

export const dynamic = "force-dynamic";
// Esimene avamine loeb Eesti klubide lõppenud mängude boxscore'id (edaspidi vahemälust).
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!isPlayerId(id)) return NextResponse.json({ error: "Vigane mängija id" }, { status: 400 });

  try {
    const profile = await getPlayerProfile(id);
    if (!profile) return NextResponse.json({ error: "Mängijat ei leitud" }, { status: 404 });
    return NextResponse.json(profile);
  } catch (error) {
    console.error("[europecup/player]", error);
    return NextResponse.json({ error: "Europe Cupi mängija profiili laadimine ebaõnnestus" }, { status: 502 });
  }
}
