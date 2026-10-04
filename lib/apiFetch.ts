import { getTasksClient } from "@/lib/supabase/tasksClient";

// Kõik /api päringud käivad selle kaudu: lisab TaskManageri sessiooni tokeni, mida route'id
// kontrollivad (lib/server/requireUser.ts). getSession uuendab aegunud tokeni enne päringut,
// nt kui arvuti oli tunde magama jäänud.
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await getTasksClient().auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}
