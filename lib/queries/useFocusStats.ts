import { useQuery } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";
import { getCurrentWeekDates, nextDate, toDayRange } from "@/lib/date";

export interface FocusStats {
  totalSeconds: number;
  topActivity: { name: string; color: string; seconds: number } | null;
  activities: { name: string; color: string; seconds: number }[];
}

interface FocusSessionRow {
  focused_seconds: number;
  activity_id: string | null;
  activities: { name: string; color: string } | null;
}

function aggregateFocusStats(rows: FocusSessionRow[]): FocusStats {
  const totalSeconds = rows.reduce((sum, row) => sum + row.focused_seconds, 0);

  const byActivity = new Map<string, { name: string; color: string; seconds: number }>();
  for (const row of rows) {
    if (!row.activity_id || !row.activities) continue;
    const existing = byActivity.get(row.activity_id);
    if (existing) {
      existing.seconds += row.focused_seconds;
    } else {
      byActivity.set(row.activity_id, {
        name: row.activities.name,
        color: row.activities.color,
        seconds: row.focused_seconds,
      });
    }
  }

  const activities = Array.from(byActivity.values()).sort((a, b) => b.seconds - a.seconds);
  return { totalSeconds, topActivity: activities[0] ?? null, activities };
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function useTodayFocusStats() {
  return useQuery({
    queryKey: ["today-focus-stats"],
    queryFn: async (): Promise<FocusStats> => {
      const { start, end } = toDayRange(todayDate());
      const { data, error } = await getTasksClient()
        .from("focus_sessions")
        .select("focused_seconds, activity_id, activities(name, color)")
        .gte("completed_at", start)
        .lt("completed_at", end);

      if (error) throw error;
      return aggregateFocusStats((data ?? []) as unknown as FocusSessionRow[]);
    },
  });
}

export function useWeeklyFocusStats() {
  return useQuery({
    queryKey: ["weekly-focus-stats"],
    queryFn: async (): Promise<FocusStats> => {
      const week = getCurrentWeekDates();
      const { data, error } = await getTasksClient()
        .from("focus_sessions")
        .select("focused_seconds, activity_id, activities(name, color)")
        .gte("completed_at", `${week[0].date}T00:00:00.000Z`)
        .lt("completed_at", `${nextDate(week[6].date)}T00:00:00.000Z`);

      if (error) throw error;
      return aggregateFocusStats((data ?? []) as unknown as FocusSessionRow[]);
    },
  });
}
