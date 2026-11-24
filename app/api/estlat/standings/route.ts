import { NextResponse } from "next/server";
import { blockedResponse } from "@/lib/basketball/http";
import { getStandings } from "@/lib/estlat/api";
import { requireUser } from "@/lib/server/requireUser";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  try {
    return NextResponse.json(await getStandings());
  } catch (error) {
    console.error("[estlat/standings]", error);
    return blockedResponse(error) ?? NextResponse.json({ error: "Tabeli laadimine ebaõnnestus" }, { status: 502 });
  }
}
