import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";
import { todayDate } from "@/lib/date";

export interface TodayHabit {
  id: string;
  name: string;
  done: boolean;
  children: TodayHabit[];
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
          client
            .from("habits")
            .select("id, name, parent_id")
            .is("archived_at", null)
            .order("id", { ascending: true }),
          client.from("habit_logs").select("habit_id").eq("date", today),
        ]);

      if (habitsError) throw habitsError;
      if (logsError) throw logsError;

      const doneIds = new Set((logs ?? []).map((log) => log.habit_id));
      const rows = habits ?? [];
      const ids = new Set(rows.map((h) => h.id));

      // Group children under their parent (one level of nesting).
      const childrenByParent = new Map<string, TodayHabit[]>();
      for (const h of rows) {
        if (h.parent_id && ids.has(h.parent_id)) {
          const list = childrenByParent.get(h.parent_id) ?? [];
          list.push({ id: h.id, name: h.name, done: doneIds.has(h.id), children: [] });
          childrenByParent.set(h.parent_id, list);
        }
      }

      // Roots: top-level habits, plus any child whose parent is missing (e.g. archived).
      return rows
        .filter((h) => !h.parent_id || !ids.has(h.parent_id))
        .map((h) => {
          const children = childrenByParent.get(h.id) ?? [];
          // A parent is done only when all its children are done; it is never
          // logged directly, so any stray parent log is ignored.
          const done = children.length > 0 ? children.every((c) => c.done) : doneIds.has(h.id);
          return { id: h.id, name: h.name, done, children };
        });
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
