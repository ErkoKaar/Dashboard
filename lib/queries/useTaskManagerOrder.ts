import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";

const ORDER_KEY = ["taskmanager-order"];

/**
 * Piirimärk salvestatud järjekorras: kõik pärast seda on "Kaugemas tulevikus".
 * Elab taskide võtmetega samas massiivis, et tabel ei vajaks uut veergu; taski võti
 * (`today-…`, `personal-…`, `projects-…`) ei saa sellega kattuda.
 */
export const LATER_KEY = "--later--";

/**
 * Täisjärjekord, milles piirimärk on alati sees: salvestatud võtmed oma kohal,
 * salvestamata (uued) taskid piiri ees. `unsaved` peab juba olema vaikejärjekorras.
 */
export function withLaterMarker(saved: string[], unsaved: string[]): string[] {
  const unique = [...new Set(saved)];
  const at = unique.indexOf(LATER_KEY);
  if (at === -1) return [...unique, ...unsaved, LATER_KEY];
  return [...unique.slice(0, at), ...unsaved, ...unique.slice(at)];
}

/**
 * Kannab nähtavas nimekirjas (lahtised read ja piir) tehtud lohistamise täisjärjekorda.
 * Peidetud read (tehtud, kuupäevafiltri taga) hoiavad oma kohta ja oma poolt piirist
 * ka siis, kui nähtav rida liigub üle piiri. `visible` peab olema `full` alamhulk ja
 * mõlemas peab piirimärk sees olema.
 */
export function moveInOrder(full: string[], visible: string[], from: number, to: number): string[] {
  const moved = [...visible];
  moved.splice(to, 0, ...moved.splice(from, 1));

  const shown = new Set(visible);
  let next = 0;
  const placed = full.map((key) => (shown.has(key) ? moved[next++] : key));

  const wasLater = new Set(full.slice(full.indexOf(LATER_KEY) + 1));
  const at = placed.indexOf(LATER_KEY);
  const above = placed.slice(0, at);
  const below = placed.slice(at + 1);
  // Peidetud read, mille nähtavate ridade nihkumine viis valele poole piiri.
  const sunk = new Set(below.filter((key) => !shown.has(key) && !wasLater.has(key)));
  const risen = new Set(above.filter((key) => !shown.has(key) && wasLater.has(key)));

  return [
    ...above.filter((key) => !risen.has(key)),
    ...sunk,
    LATER_KEY,
    ...risen,
    ...below.filter((key) => !sunk.has(key)),
  ];
}

export function useTaskManagerOrder() {
  return useQuery({
    queryKey: ORDER_KEY,
    queryFn: async (): Promise<string[] | null> => {
      const { data, error } = await getTasksClient()
        .from("taskmanager_order")
        .select("task_order")
        .maybeSingle();

      if (error) throw error;
      return data?.task_order ?? null;
    },
  });
}

export function useUpdateTaskManagerOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (order: string[]) => {
      const client = getTasksClient();
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Pole sisse logitud");

      const { error } = await client
        .from("taskmanager_order")
        .upsert({ user_id: userId, task_order: order }, { onConflict: "user_id" });

      if (error) throw error;
    },
    // Optimistlik uuendus, et lohistatud rida ei hüppaks enne serveri vastust tagasi.
    onMutate: async (order) => {
      await queryClient.cancelQueries({ queryKey: ORDER_KEY });
      const previous = queryClient.getQueryData<string[] | null>(ORDER_KEY);
      queryClient.setQueryData(ORDER_KEY, order);
      return { previous };
    },
    onError: (_err, _order, context) => {
      queryClient.setQueryData(ORDER_KEY, context?.previous ?? null);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ORDER_KEY }),
  });
}
