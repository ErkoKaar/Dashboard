import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";
import { todayDate } from "@/lib/date";
import { combineTodayTasks, PROJECT_TASK_COLUMNS, TASK_COLUMNS, type TodayTask } from "@/lib/today";
import {
  CALENDAR_EVENTS_KEY,
  CalendarEvent,
  fetchCalendarEvents,
} from "@/lib/queries/useCalendarEvents";

export type { TodayTask };

export const TODAY_TASKS_KEY = ["today-tasks"];

/**
 * Selle päeva taskid kahest allikast: päevataskid tasks-tabelist ja projekti-taskid,
 * mille due_date on sama päev. Koopiat ei tehta — projekti-task jääb üheks reaks,
 * nii et linnuke siin lõpetab ta ka projektis.
 */
export function useTodayTasks(date: string = todayDate()) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [...TODAY_TASKS_KEY, date],
    queryFn: async (): Promise<TodayTask[]> => {
      const client = getTasksClient();
      const [
        { data: tasks, error },
        { data: projectTasks, error: projectError },
        calendarEvents,
      ] = await Promise.all([
        client
          .from("tasks")
          .select(TASK_COLUMNS)
          .eq("date", date)
          .order("id", { ascending: true }),
        client
          .from("project_tasks")
          .select(PROJECT_TASK_COLUMNS)
          .eq("due_date", date)
          .order("sort_order", { ascending: true }),
        // Sama cache mis CalendarWidgetil. Kalendri viga ei tohi taske peita — siis lihtsalt ilma.
        queryClient
          .fetchQuery({
            queryKey: CALENDAR_EVENTS_KEY,
            queryFn: fetchCalendarEvents,
            staleTime: 60_000,
          })
          .catch((): CalendarEvent[] => []),
      ]);

      if (error) throw error;
      if (projectError) throw projectError;

      return combineTodayTasks(date, tasks ?? [], projectTasks ?? [], calendarEvents);
    },
  });
}

export function useAddTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, date = todayDate() }: { title: string; date?: string }) => {
      const client = getTasksClient();
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Pole sisse logitud");

      const { error } = await client
        .from("tasks")
        .insert({ title, date, done: false, user_id: userId });

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TODAY_TASKS_KEY }),
  });
}

/** Kalendri-taski toimumiskorra linnuke: tehtud = rida tasks-tabelis, tegemata = rida kustutatakse. */
export function useToggleCalendarTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      title,
      done,
      date = todayDate(),
    }: {
      eventId: string;
      title: string;
      done: boolean;
      date?: string;
    }) => {
      const client = getTasksClient();

      if (done) {
        const { data: sessionData } = await client.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (!userId) throw new Error("Pole sisse logitud");

        const { error } = await client.from("tasks").upsert(
          { title, date, done: true, user_id: userId, calendar_event_id: eventId },
          { onConflict: "calendar_event_id,date" },
        );
        if (error) throw error;
      } else {
        const { error } = await client
          .from("tasks")
          .delete()
          .eq("calendar_event_id", eventId)
          .eq("date", date);
        if (error) throw error;
      }
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
