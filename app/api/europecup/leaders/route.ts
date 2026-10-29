import { NextResponse } from "next/server";
import { parsePeriod } from "@/lib/basketball/period";
import { getLeaders } from "@/lib/europecup/api";
import { requireUser } from "@/lib/server/requireUser";

export const dynamic = "force-dynamic";
// Hooaja esimene arvutus laeb iga Eesti klubi mängu lehe (~500 KB); lõppenud päevad tulevad edaspidi vahemälust.
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  const period = parsePeriod(new URL(request.url).searchParams.get("period"));
  if (!period) return NextResponse.json({ error: "Tundmatu ajavahemik" }, { status: 400 });

  try {
    return NextResponse.json(await getLeaders(period));
  } catch {
    return NextResponse.json({ error: "Europe Cupi statistika laadimine ebaõnnestus" }, { status: 502 });
  }
}
