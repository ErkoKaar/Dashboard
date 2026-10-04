import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/requireUser";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// Valede katsete loendur kasutaja kaupa. Serveri mälus, seega kehtib ühe instantsi piires
// (Vercel võib käivitada mitu) — ühe kasutaja dashboardi jaoks piisav tõke, mitte õhukindel.
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

// Räsid on alati sama pikkusega, nii et timingSafeEqual ei lekita ka PIN-i pikkust.
function pinMatches(submitted: string, pin: string) {
  const a = createHash("sha256").update(submitted).digest();
  const b = createHash("sha256").update(pin).digest();
  return timingSafeEqual(a, b);
}

// FINANCE_WIDGET_PIN on server-only env — parool ei satu kliendi bundle'isse.
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  return NextResponse.json({ enabled: !!process.env.FINANCE_WIDGET_PIN });
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;

  const pin = process.env.FINANCE_WIDGET_PIN;
  if (!pin) return NextResponse.json({ ok: true });

  const now = Date.now();
  const entry = failedAttempts.get(auth.userId);
  if (entry && entry.lockedUntil > now) {
    const minutes = Math.ceil((entry.lockedUntil - now) / 60000);
    return NextResponse.json(
      { ok: false, error: `Liiga palju valesid katseid. Proovi ${minutes} min pärast uuesti.` },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const submitted = typeof body?.pin === "string" ? body.pin : "";

  if (pinMatches(submitted, pin)) {
    failedAttempts.delete(auth.userId);
    return NextResponse.json({ ok: true });
  }

  // Eelmine lukustus on möödas → loendus algab otsast.
  const lockoutExpired = entry !== undefined && entry.lockedUntil !== 0 && entry.lockedUntil <= now;
  const count = (lockoutExpired ? 0 : (entry?.count ?? 0)) + 1;
  failedAttempts.set(auth.userId, {
    count,
    lockedUntil: count >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0,
  });
  return NextResponse.json({ ok: false });
}
