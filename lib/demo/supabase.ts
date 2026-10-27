import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { DEMO_SESSION } from "@/lib/demo/mode";
import type { DemoProject } from "@/lib/demo/fixtures";

/**
 * supabase-js klient, mille päringud vastab lib/demo/postgrest.ts mälus (võrku ei lähe midagi).
 * getSession annab demo sessiooni, sest hookid võtavad sealt user_id.
 */
export function createDemoClient(project: DemoProject): SupabaseClient {
  // Eri URL kummalegi projektile, et auth-salvestuse võtmed ei kattuks (nagu kahel päris projektil).
  const client = createClient(`https://${project}.demo.invalid`, "demo-anon-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) =>
        (await import("@/lib/demo/postgrest")).handleSupabaseRequest(project, input, init),
    },
  });
  client.auth.getSession = async () => ({ data: { session: DEMO_SESSION }, error: null });
  return client;
}
