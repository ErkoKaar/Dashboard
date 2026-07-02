import { useQuery } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";
import { getCurrentWeekDates } from "@/lib/date";
import { WeeklyStats } from "@/lib/queries/useWeeklyTaskStats";

export function useWeeklyHabitStats() {
  return useQuery({
    queryKey: ["weekly-habit-stats"],
    queryFn: async (): Promise<WeeklyStats> => {
      const week = getCurrentWeekDates();
      const client = getTasksClient();

      const [{ data: habits, error: habitsError }, { data: logs, error: logsError }] =
        await Promise.all([
          client.from("habits").select("id").is("archived_at", null),
          client.from("habit_logs").select("date").gte("date", week[0].date).lte("date", week[6].date),
        ]);

      if (habitsError) throw habitsError;
      if (logsError) throw logsError;

      const activeCount = habits?.length ?? 0;
      const daily = week.map(({ date, label }) => ({
        day: label,
        done: (logs ?? []).filter((log) => log.date === date).length,
        total: activeCount,
      }));

      return { totalDone: daily.reduce((sum, d) => sum + d.done, 0), daily };
    },
  });
}
