"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { useTodayFocusStats, useWeeklyFocusStats } from "@/lib/queries/useFocusStats";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function FocusLoopWidget() {
  const [view, setView] = useState<"today" | "week">("today");

  const todayStats = useTodayFocusStats();
  const weeklyStats = useWeeklyFocusStats();
  const active = view === "today" ? todayStats : weeklyStats;

  return (
    <Card className="col-span-12 md:col-span-6 xl:col-span-4">
      <div className="mb-4 flex items-center justify-between">
        <WidgetTitle icon={Target}>FocusLoop</WidgetTitle>
        <div className="flex gap-1">
          <TabButton active={view === "today"} onClick={() => setView("today")}>
            Täna
          </TabButton>
          <TabButton active={view === "week"} onClick={() => setView("week")}>
            See nädal
          </TabButton>
        </div>
      </div>

      {active.isLoading || !active.data ? (
        <Skeleton className="h-24 w-full" />
      ) : active.error ? (
        <p className="text-sm text-destructive">FocusLoopi laadimine ebaõnnestus.</p>
      ) : (
        <div className="space-y-3 text-sm">
          <p>
            Kokku fookust:{" "}
            <span className="font-mono font-semibold text-foreground">
              {formatDuration(active.data.totalSeconds)}
            </span>
          </p>

          <div>
            <p className="text-muted">Top activity</p>
            {active.data.topActivity ? (
              <p className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: active.data.topActivity.color }}
                />
                {active.data.topActivity.name} — {formatDuration(active.data.topActivity.seconds)}
              </p>
            ) : (
              <p className="text-muted">Pole veel fookust.</p>
            )}
          </div>

          {active.data.activities.length > 0 && (
            <div>
              <p className="mb-1 text-muted">Activities</p>
              <ul className="space-y-1">
                {active.data.activities.map((activity) => (
                  <li key={activity.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activity.color }} />
                    {activity.name} — {formatDuration(activity.seconds)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
