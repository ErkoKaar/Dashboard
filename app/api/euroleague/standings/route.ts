import { NextResponse } from "next/server";
import { getStandings } from "@/lib/euroleague/api";
import { requireUser } from "@/lib/server/requireUser";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  try {
    return NextResponse.json(await getStandings());
  } catch {
    return NextResponse.json({ error: "Tabeli laadimine ebaõnnestus" }, { status: 502 });
  }
}
