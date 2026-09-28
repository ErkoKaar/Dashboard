import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";
import { todayDate } from "@/lib/date";
import {
  CALENDAR_EVENTS_KEY,
  CalendarEvent,
  fetchCalendarEvents,
} from "@/lib/queries/useCalendarEvents";

export interface TodayTask {
  id: string;
  title: string;
  done: boolean;
  project_task_id: string | null;
  /**
   * "task" = päevatask tasks-tabelist, "project_task" = projekti-task, mille due_date on see päev,
   * "calendar" = taskiks märgitud Google Calendari sündmus (id on toimumiskorra id).
   */
  origin: "task" | "project_task" | "calendar";
  /** Ainult project_task päritolul — mutatsioonid vajavad seda invalideerimiseks. */
  projectId: string | null;
}

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
          .select("id, title, done, project_task_id, calendar_event_id")
          .eq("date", date)
          .order("id", { ascending: true }),
        client
          .from("project_tasks")
          .select("id, project_id, title, completed_at")
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

      const dated: TodayTask[] = (projectTasks ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        done: t.completed_at !== null,
        project_task_id: null,
        origin: "project_task",
        projectId: t.project_id,
      }));

      // Tehtud projekti-task peegeldatakse tasks-tabelisse (vt useToggleProjectTask).
      // Kui tal on ka due_date, oleks ta nimekirjas kaks korda — peegelrida kukub välja.
      const datedIds = new Set(dated.map((t) => t.id));
      const plain: TodayTask[] = (tasks ?? [])
        // Kalendri-taski read on ainult tehtud-olek, mitte eraldi taskid.
        .filter((t) => !t.calendar_event_id)
        .filter((t) => !t.project_task_id || !datedIds.has(t.project_task_id))
        .map((t) => ({
          id: t.id,
          title: t.title,
          done: t.done,
          project_task_id: t.project_task_id,
          origin: "task",
          projectId: null,
        }));

      // Kalender pärib ainult jooksvat nädalat — teiste kuupäevade puhul jääb see tühjaks.
      const doneCalendarIds = new Set(
        (tasks ?? []).filter((t) => t.calendar_event_id && t.done).map((t) => t.calendar_event_id),
      );
      const calendar: TodayTask[] = calendarEvents
        .filter((e) => e.isTask && e.date === date)
        .map((e) => ({
          id: e.id,
          title: e.title,
          done: doneCalendarIds.has(e.id),
          project_task_id: null,
          origin: "calendar",
          projectId: null,
        }));

      return [...plain, ...calendar, ...dated];
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
