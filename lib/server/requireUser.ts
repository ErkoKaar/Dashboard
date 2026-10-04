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

/**
 * Tagastab kasutaja id või valmis 401 vastuse. Kasutus route'is:
 *   const auth = await requireUser(request);
 *   if (auth instanceof Response) return auth;
 */
export async function requireUser(request: Request): Promise<{ userId: string } | Response> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return unauthorized();

  const { data, error } = await getAuthClient().auth.getUser(token);
  if (error || !data.user) return unauthorized();
  return { userId: data.user.id };
}

function unauthorized() {
  return NextResponse.json({ error: "Pole sisse logitud" }, { status: 401 });
}
