import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";

const QUICK_NOTE_KEY = ["quick-note"];

export function useQuickNote() {
  return useQuery({
    queryKey: QUICK_NOTE_KEY,
    queryFn: async (): Promise<string> => {
      const { data, error } = await getTasksClient()
        .from("quick_notes")
        .select("content")
        .maybeSingle();

      if (error) throw error;
      return data?.content ?? "";
    },
  });
}

export function useSaveQuickNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      const client = getTasksClient();
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Pole sisse logitud");

      const { error } = await client
        .from("quick_notes")
        .upsert({ user_id: userId, content, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUICK_NOTE_KEY }),
  });
}
