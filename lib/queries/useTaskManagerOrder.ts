import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";

const ORDER_KEY = ["taskmanager-order"];

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
