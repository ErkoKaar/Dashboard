import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";

export interface TodayTask {
  id: string;
  title: string;
  done: boolean;
}

const TODAY_TASKS_KEY = ["today-tasks"];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function useTodayTasks() {
  return useQuery({
    queryKey: TODAY_TASKS_KEY,
    queryFn: async (): Promise<TodayTask[]> => {
      const { data, error } = await getTasksClient()
        .from("tasks")
        .select("id, title, done")
        .eq("date", todayDate())
        .order("id", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title }: { title: string }) => {
      const client = getTasksClient();
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Pole sisse logitud");

      const { error } = await client
        .from("tasks")
        .insert({ title, date: todayDate(), done: false, user_id: userId });

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TODAY_TASKS_KEY }),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, title, done }: { id: string; title?: string; done?: boolean }) => {
      const { error } = await getTasksClient()
        .from("tasks")
        .update({ ...(title !== undefined && { title }), ...(done !== undefined && { done }) })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TODAY_TASKS_KEY }),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await getTasksClient().from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TODAY_TASKS_KEY }),
  });
}
