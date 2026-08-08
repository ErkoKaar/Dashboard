import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";

const LAYOUT_KEY = ["dashboard-layout"];

export function useDashboardLayout() {
  return useQuery({
    queryKey: LAYOUT_KEY,
    queryFn: async (): Promise<string[] | null> => {
      const { data, error } = await getTasksClient()
        .from("dashboard_layout")
        .select("widget_order")
        .maybeSingle();

      if (error) throw error;
      return data?.widget_order ?? null;
    },
  });
}

export function useUpdateDashboardLayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (order: string[]) => {
      const client = getTasksClient();
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Pole sisse logitud");

      const { error } = await client
        .from("dashboard_layout")
        .upsert({ user_id: userId, widget_order: order }, { onConflict: "user_id" });

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LAYOUT_KEY }),
  });
}
