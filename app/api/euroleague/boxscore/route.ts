import { NextResponse } from "next/server";
import { getFinalBoxscore, getLiveBoxscore, parseGameKey } from "@/lib/euroleague/api";
import { requireUser } from "@/lib/server/requireUser";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  const params = new URL(request.url).searchParams;
  const id = params.get("id") ?? "";
  if (!parseGameKey(id)) return NextResponse.json({ error: "Vigane mängu id" }, { status: 400 });

  try {
    if (params.get("final") === "1") {
      try {
        return NextResponse.json(await getFinalBoxscore(id));
      } catch {
        // Kliendi arvates lõppenud, API järgi veel mitte (või ajutine viga): proovi otse.
      }
    }
    return NextResponse.json(await getLiveBoxscore(id));
  } catch {
    return NextResponse.json({ error: "Boxscore'i laadimine ebaõnnestus" }, { status: 502 });
  }
}
