// Tänaste taskide ja habitite koostamine Supabase'i ridadest. Ühine dashboardi hookidele (brauser, RLS)
// ja iPhone'i vidina endpointile (server, service role), et mõlemad näitaksid täpselt sama nimekirja.

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

export interface TodayHabit {
  id: string;
  name: string;
  done: boolean;
  children: TodayHabit[];
}

export const TASK_COLUMNS = "id, title, done, project_task_id, calendar_event_id";
export const PROJECT_TASK_COLUMNS = "id, project_id, title, completed_at";
export const HABIT_COLUMNS = "id, name, parent_id";

interface TaskRow {
  id: string;
  title: string;
  done: boolean;
  project_task_id: string | null;
  calendar_event_id: string | null;
}

interface ProjectTaskRow {
  id: string;
  project_id: string;
  title: string;
  completed_at: string | null;
}

interface CalendarTaskSource {
  id: string;
  title: string;
  date: string;
  isTask: boolean;
}

interface HabitRow {
  id: string;
  name: string;
  parent_id: string | null;
}

/**
 * Selle päeva taskid kolmest allikast: päevataskid tasks-tabelist, projekti-taskid, mille due_date on
 * sama päev, ja taskiks märgitud kalendrisündmused. Koopiat ei tehta: projekti-task jääb üheks reaks.
 */
export function combineTodayTasks(
  date: string,
  tasks: TaskRow[],
  projectTasks: ProjectTaskRow[],
  calendarEvents: CalendarTaskSource[],
): TodayTask[] {
  const dated: TodayTask[] = projectTasks.map((t) => ({
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
  const plain: TodayTask[] = tasks
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
  const doneCalendarIds = new Set(tasks.filter((t) => t.calendar_event_id && t.done).map((t) => t.calendar_event_id));
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
}

/** Aktiivsed habitid, alamhabitid ülemise alla (üks tase); doneIds = selle päeva logitud habitid. */
export function groupTodayHabits(habits: HabitRow[], doneIds: Set<string>): TodayHabit[] {
  const ids = new Set(habits.map((h) => h.id));

  // Group children under their parent (one level of nesting).
  const childrenByParent = new Map<string, TodayHabit[]>();
  for (const h of habits) {
    if (h.parent_id && ids.has(h.parent_id)) {
      const list = childrenByParent.get(h.parent_id) ?? [];
      list.push({ id: h.id, name: h.name, done: doneIds.has(h.id), children: [] });
      childrenByParent.set(h.parent_id, list);
    }
  }

  // Roots: top-level habits, plus any child whose parent is missing (e.g. archived).
  return habits
    .filter((h) => !h.parent_id || !ids.has(h.parent_id))
    .map((h) => {
      const children = childrenByParent.get(h.id) ?? [];
      // A parent is done only when all its children are done; it is never
      // logged directly, so any stray parent log is ignored.
      const done = children.length > 0 ? children.every((c) => c.done) : doneIds.has(h.id);
      return { id: h.id, name: h.name, done, children };
    });
}
