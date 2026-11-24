import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";

const PROJECTS_KEY = ["taskmanager-projects"];

/** Taskmanageri "Käimasolevad projektid": vaba nimekiri, TaskZeni projektidest sõltumatu. */
export interface TaskManagerProject {
  id: string;
  title: string;
  position: number;
}

async function requireUserId(): Promise<string> {
  const { data } = await getTasksClient().auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("Pole sisse logitud");
  return userId;
}

export function useTaskManagerProjects() {
  return useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: async (): Promise<TaskManagerProject[]> => {
      const { data, error } = await getTasksClient()
        .from("taskmanager_projects")
        .select("id, title, position")
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddTaskManagerProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, position }: { title: string; position: number }) => {
      const userId = await requireUserId();
      const { error } = await getTasksClient()
        .from("taskmanager_projects")
        .insert({ title, position, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useDeleteTaskManagerProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getTasksClient().from("taskmanager_projects").delete().eq("id", id);
      if (error) throw error;
    },
    // Optimistlik, et rida kaoks kohe; vea korral tuleb tagasi.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: PROJECTS_KEY });
      const previous = queryClient.getQueryData<TaskManagerProject[]>(PROJECTS_KEY);
      queryClient.setQueryData<TaskManagerProject[]>(PROJECTS_KEY, (current) =>
        current?.filter((project) => project.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(PROJECTS_KEY, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useRenameTaskManagerProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await getTasksClient()
        .from("taskmanager_projects")
        .update({ title })
        .eq("id", id);
      if (error) throw error;
    },
    // Optimistlik, et uus nimi paistaks kohe; vea korral tuleb vana tagasi.
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: PROJECTS_KEY });
      const previous = queryClient.getQueryData<TaskManagerProject[]>(PROJECTS_KEY);
      queryClient.setQueryData<TaskManagerProject[]>(PROJECTS_KEY, (current) =>
        current?.map((project) => (project.id === id ? { ...project, title } : project)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(PROJECTS_KEY, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

/** Salvestab kogu nimekirja uue järjekorra ühe päringuga; `ordered` on soovitud järjestuses. */
export function useReorderTaskManagerProjects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ordered: TaskManagerProject[]) => {
      const userId = await requireUserId();
      const { error } = await getTasksClient()
        .from("taskmanager_projects")
        .upsert(
          ordered.map((project, position) => ({
            id: project.id,
            user_id: userId,
            title: project.title,
            position,
          })),
          { onConflict: "id" },
        );
      if (error) throw error;
    },
    // Optimistlik, et lohistatud rida ei hüppaks enne serveri vastust tagasi.
    onMutate: async (ordered) => {
      await queryClient.cancelQueries({ queryKey: PROJECTS_KEY });
      const previous = queryClient.getQueryData<TaskManagerProject[]>(PROJECTS_KEY);
      queryClient.setQueryData<TaskManagerProject[]>(
        PROJECTS_KEY,
        ordered.map((project, position) => ({ ...project, position })),
      );
      return { previous };
    },
    onError: (_err, _ordered, context) => {
      queryClient.setQueryData(PROJECTS_KEY, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}
