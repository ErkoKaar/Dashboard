import { NextResponse } from "next/server";
import { getMvpRace } from "@/lib/nba/espn";
import { requireUser } from "@/lib/server/requireUser";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  try {
    return NextResponse.json(await getMvpRace());
  } catch {
    return NextResponse.json({ error: "MVP race'i laadimine ebaõnnestus" }, { status: 502 });
  }
}
