import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";
import { todayDate } from "@/lib/date";

export type Criticality = "critical" | "warning" | "on_track";
export type ProjectSection = "projects" | "personal";

export interface Project {
  id: string;
  title: string;
  criticality: Criticality;
  sort_order: number;
  section: ProjectSection;
  taskCount: number;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  criticality: Criticality;
  sort_order: number;
  completed_at: string | null;
}

export interface KeyTask extends ProjectTask {
  projectTitle: string;
}

const PROJECTS_KEY = ["projects"];
const KEY_TASKS_KEY = ["key-tasks"];

export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: async (): Promise<Project[]> => {
      const client = getTasksClient();
      const [{ data: projects, error: projectsError }, { data: tasks, error: tasksError }] =
        await Promise.all([
          client
            .from("projects")
            .select("id, title, criticality, sort_order, section")
            .is("completed_at", null)
            .order("sort_order", { ascending: true }),
          client.from("project_tasks").select("project_id").is("completed_at", null),
        ]);

      if (projectsError) throw projectsError;
      if (tasksError) throw tasksError;

      const counts = new Map<string, number>();
      for (const t of tasks ?? []) {
        counts.set(t.project_id, (counts.get(t.project_id) ?? 0) + 1);
      }

      return (projects ?? []).map((p) => ({ ...p, taskCount: counts.get(p.id) ?? 0 }));
    },
  });
}

export function useKeyTasks() {
  return useQuery({
    queryKey: KEY_TASKS_KEY,
    queryFn: async (): Promise<KeyTask[]> => {
      const client = getTasksClient();
      const { data: projects, error: projectsError } = await client
        .from("projects")
        .select("id, title")
        .eq("section", "projects")
        .is("completed_at", null);

      if (projectsError) throw projectsError;

      const projectIds = (projects ?? []).map((p) => p.id);
      if (projectIds.length === 0) return [];

      const titleById = new Map((projects ?? []).map((p) => [p.id, p.title]));

      const { data: tasks, error: tasksError } = await client
        .from("project_tasks")
        .select("id, project_id, title, criticality, sort_order, completed_at")
        .in("project_id", projectIds)
        .eq("criticality", "critical")
        .or(`completed_at.is.null,completed_at.gte.${todayDate()}`)
        .order("sort_order", { ascending: true });

      if (tasksError) throw tasksError;

      return (tasks ?? []).map((t) => ({ ...t, projectTitle: titleById.get(t.project_id) ?? "" }));
    },
  });
}

export function useAddProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, section }: { title: string; section: ProjectSection }) => {
      const client = getTasksClient();
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Pole sisse logitud");

      const { error } = await client.from("projects").insert({ title, section, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useUpdateProjectCriticality() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, criticality }: { id: string; criticality: Criticality }) => {
      const { error } = await getTasksClient().from("projects").update({ criticality }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useProjectTasks(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: async (): Promise<ProjectTask[]> => {
      const { data, error } = await getTasksClient()
        .from("project_tasks")
        .select("id, project_id, title, criticality, sort_order, completed_at")
        .eq("project_id", projectId)
        .or(`completed_at.is.null,completed_at.gte.${todayDate()}`)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled,
  });
}

export function useAddProjectTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, title }: { projectId: string; title: string }) => {
      const client = getTasksClient();
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Pole sisse logitud");

      const { error } = await client
        .from("project_tasks")
        .insert({ project_id: projectId, title, user_id: userId });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

export function useUpdateProjectTaskCriticality() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      criticality,
    }: {
      id: string;
      projectId: string;
      criticality: Criticality;
    }) => {
      const { error } = await getTasksClient().from("project_tasks").update({ criticality }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: KEY_TASKS_KEY });
    },
  });
}

export function useToggleProjectTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, done }: { id: string; projectId: string; done: boolean }) => {
      const { error } = await getTasksClient()
        .from("project_tasks")
        .update({ completed_at: done ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      queryClient.invalidateQueries({ queryKey: KEY_TASKS_KEY });
    },
  });
}

export function useDeleteProjectTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; projectId: string }) => {
      const { error } = await getTasksClient().from("project_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}
