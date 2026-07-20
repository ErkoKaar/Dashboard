import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";
import { todayDate } from "@/lib/date";

export interface TodayHabit {
  id: string;
  name: string;
  done: boolean;
}

const TODAY_HABITS_KEY = ["today-habits"];

export function useTodayHabits() {
  return useQuery({
    queryKey: TODAY_HABITS_KEY,
    queryFn: async (): Promise<TodayHabit[]> => {
      const client = getTasksClient();
      const today = todayDate();

      const [{ data: habits, error: habitsError }, { data: logs, error: logsError }] =
        await Promise.all([
          client.from("habits").select("id, name").is("archived_at", null).order("id", { ascending: true }),
          client.from("habit_logs").select("habit_id").eq("date", today),
        ]);

      if (habitsError) throw habitsError;
      if (logsError) throw logsError;

      const doneIds = new Set((logs ?? []).map((log) => log.habit_id));
      return (habits ?? []).map((habit) => ({ ...habit, done: doneIds.has(habit.id) }));
    },
  });
}

export function useToggleHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId, done }: { habitId: string; done: boolean }) => {
      const client = getTasksClient();
      const today = todayDate();

      const { error } = done
        ? await client.from("habit_logs").insert({ habit_id: habitId, date: today })
        : await client.from("habit_logs").delete().eq("habit_id", habitId).eq("date", today);

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TODAY_HABITS_KEY }),
  });
}
