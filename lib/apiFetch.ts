import { getTasksClient } from "@/lib/supabase/tasksClient";
import { IS_DEMO } from "@/lib/demo/mode";

// Kõik /api päringud käivad selle kaudu: lisab TaskManageri sessiooni tokeni, mida route'id
// kontrollivad (lib/server/requireUser.ts). getSession uuendab aegunud tokeni enne päringut,
// nt kui arvuti oli tunde magama jäänud.
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  if (IS_DEMO) return (await import("@/lib/demo/api")).demoApiFetch(input, init);
  const { data } = await getTasksClient().auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}
