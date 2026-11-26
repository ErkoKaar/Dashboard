import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { leagueTag } from "@/lib/basketball/http";
import type { League } from "@/lib/queries/useNba";
import { requireUser } from "@/lib/server/requireUser";

// Vidina värskendusnupp: tühjendab ühe liiga ajaliselt aeguva serveri vahemälu, nii et järgmine päring
// küsib allikast uue seisu (muidu annaks vahemälu pärast aegumist esmalt vana seisu ja uuendaks taustal).
// Lõppenud mängude boxscore'id on sildita ja jäävad alles. Demos on route kinni (requireUser): võõras
// ei saa vahemälu tühjendades allikaid koormata.

export const dynamic = "force-dynamic";

const LEAGUES: readonly League[] = ["nba", "euroleague", "estlat", "europecup"];

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  const body: { league?: unknown } | null = await request.json().catch(() => null);
  const league = LEAGUES.find((id) => id === body?.league);
  if (!league) return NextResponse.json({ error: "Tundmatu liiga" }, { status: 400 });

  revalidateTag(leagueTag(league));
  return NextResponse.json({ ok: true });
}
