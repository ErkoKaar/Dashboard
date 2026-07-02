import { useQuery } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";
import { getCurrentWeekDates } from "@/lib/date";

export interface WeeklyStats {
  totalDone: number;
  daily: { day: string; done: number; total: number }[];
}

export function useWeeklyTaskStats() {
  return useQuery({
    queryKey: ["weekly-task-stats"],
    queryFn: async (): Promise<WeeklyStats> => {
      const week = getCurrentWeekDates();
      const { data, error } = await getTasksClient()
        .from("tasks")
        .select("date, done")
        .gte("date", week[0].date)
        .lte("date", week[6].date);

      if (error) throw error;

      const daily = week.map(({ date, label }) => {
        const dayTasks = (data ?? []).filter((task) => task.date === date);
        return {
          day: label,
          done: dayTasks.filter((task) => task.done).length,
          total: dayTasks.length,
        };
      });

      return { totalDone: daily.reduce((sum, d) => sum + d.done, 0), daily };
    },
  });
}
