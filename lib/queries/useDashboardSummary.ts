import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";
import { useTodayTasks } from "@/lib/queries/useTodayTasks";
import { useTodayHabits } from "@/lib/queries/useTodayHabits";
import { useTodayFocusStats } from "@/lib/queries/useFocusStats";
import { useWeather } from "@/lib/queries/useWeather";
import { useChessTrend } from "@/lib/queries/useChess";
import { useGithubContributions } from "@/lib/queries/useGithubContributions";

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

interface SummaryRow {
  date: string;
  summary: string;
}

const LATEST_SUMMARY_KEY = ["dashboard-summary-latest"];

export function useDashboardSummary() {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const latest = useQuery({
    queryKey: LATEST_SUMMARY_KEY,
    queryFn: async (): Promise<SummaryRow | null> => {
      const { data, error } = await getTasksClient()
        .from("dashboard_summaries")
        .select("date, summary")
        .order("date", { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const tasks = useTodayTasks();
  const habits = useTodayHabits();
  const focus = useTodayFocusStats();
  const weather = useWeather();
  const chessTrend = useChessTrend();
  const github = useGithubContributions();

  const dataReady =
    !tasks.isLoading &&
    !habits.isLoading &&
    !focus.isLoading &&
    !weather.isLoading &&
    !chessTrend.isLoading &&
    !github.isLoading;

  const needsGeneration =
    !latest.isLoading && latest.data?.date !== todayDate() && new Date().getHours() >= 20 && dataReady;

  useEffect(() => {
    if (!needsGeneration || generating) return;

    async function generate() {
      setGenerating(true);
      setGenerateError(null);
      try {
        const today = todayDate();
        const todayChessGames = (chessTrend.data ?? []).filter((g) => g.date === today);

        const payload = {
          tasks: (tasks.data ?? []).map((t) => ({ title: t.title, done: t.done })),
          habits: (habits.data ?? []).map((h) => ({ name: h.name, done: h.done })),
          focus: focus.data
            ? {
                totalMinutes: Math.round(focus.data.totalSeconds / 60),
                topActivity: focus.data.topActivity?.name ?? null,
              }
            : null,
          weather: weather.data
            ? { temperature: weather.data.temperature, description: weather.data.description }
            : null,
          chess: {
            gamesPlayed: todayChessGames.length,
            wins: todayChessGames.filter((g) => g.result === "win").length,
          },
          github: { commitsByRepo: github.data?.todayCommitsByRepo ?? [] },
        };

        const res = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Kokkuvõtte genereerimine ebaõnnestus");
        const { summary } = await res.json();

        const client = getTasksClient();
        const { data: sessionData } = await client.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (!userId) throw new Error("Pole sisse logitud");

        const { error } = await client
          .from("dashboard_summaries")
          .upsert({ user_id: userId, date: today, summary }, { onConflict: "user_id,date" });

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: LATEST_SUMMARY_KEY });
      } catch (err) {
        setGenerateError(err instanceof Error ? err.message : "Kokkuvõtte genereerimine ebaõnnestus");
      } finally {
        setGenerating(false);
      }
    }

    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGeneration]);

  return {
    summary: latest.data,
    isToday: latest.data?.date === todayDate(),
    isLoading: latest.isLoading || generating,
    error: latest.error ?? generateError,
  };
}
