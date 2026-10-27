import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Ainult serveris (app/api/*). Sisselogimine on muidu ainult brauseris, seega iga route
// kontrollib ise, et päringu tegi kehtiva TaskManageri sessiooniga kasutaja.
let client: SupabaseClient | null = null;

function getAuthClient() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_TASKS_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_TASKS_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return client;
}

// Kontrollitud tokenid: Supabase'ilt küsitakse token kohta üks kord (Verceli funktsioonist 150-350 ms),
// edasi tuleb vastus mälust ja paralleelsed päringud sama tokeniga ootavad sama kontrolli. Mälus kuni
// tokeni aegumiseni, aga mitte kauem kui VERIFIED_MAX_MS: välja logitud või tühistatud sessioon lakkab
// töötamast hiljemalt selle aja pärast.
const VERIFIED_MAX_MS = 5 * 60 * 1000;
const VERIFIED_LIMIT = 200;
const verified = new Map<string, { userId: Promise<string | null>; until: number }>();

/** JWT-i aegumisaeg (ms). Allkirja siin ei kontrollita: väärtus ainult piirab vahemälu aega. */
function expiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    return typeof payload?.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function pruneVerified(now: number) {
  for (const [token, entry] of verified) if (entry.until <= now) verified.delete(token);
  // Map hoiab lisamise järjekorda: üle piiri minnes kaovad vanimad.
  for (const token of verified.keys()) {
    if (verified.size < VERIFIED_LIMIT) break;
    verified.delete(token);
  }
}

function verify(token: string): Promise<string | null> {
  const now = Date.now();
  const hit = verified.get(token);
  if (hit && hit.until > now) return hit.userId;

  const userId = getAuthClient()
    .auth.getUser(token)
    .then(
      ({ data, error }) => (error || !data.user ? null : data.user.id),
      () => null,
    );
  // Aegunud või loetamatut tokenit ei salvestata, Supabase lükkab selle niikuinii tagasi.
  const exp = expiresAt(token);
  if (exp === null || exp <= now) return userId;

  pruneVerified(now);
  const entry = { userId, until: Math.min(exp, now + VERIFIED_MAX_MS) };
  verified.set(token, entry);
  // Tagasi lükatud (või võrguvea tõttu kontrollimata) tokenit ei jäeta meelde: järgmine päring küsib uuesti.
  void userId.then((id) => {
    if (id === null && verified.get(token) === entry) verified.delete(token);
  });
  return userId;
}

/**
 * Tagastab kasutaja id või valmis 401 vastuse. Kasutus route'is:
 *   const auth = await requireUser(request);
 *   if (auth instanceof Response) return auth;
 */
export async function requireUser(request: Request): Promise<{ userId: string } | Response> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return unauthorized();

  const userId = await verify(token);
  if (!userId) return unauthorized();
  return { userId };
}

function unauthorized() {
  return NextResponse.json({ error: "Pole sisse logitud" }, { status: 401 });
}
