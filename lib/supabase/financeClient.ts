import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { IS_DEMO } from "@/lib/demo/mode";
import { createDemoClient } from "@/lib/demo/supabase";

let client: SupabaseClient | null = null;

export function getFinanceClient() {
  if (!client) {
    if (IS_DEMO) return (client = createDemoClient("finance"));
    const supabaseUrl = process.env.NEXT_PUBLIC_FINANCE_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_FINANCE_SUPABASE_ANON_KEY!;
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}
