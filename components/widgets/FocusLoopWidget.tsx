"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { FocusStats, useTodayFocusStats, useWeeklyFocusStats } from "@/lib/queries/useFocusStats";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function FocusStatsView({ data }: { data: FocusStats }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-3xl font-semibold text-foreground">
          {formatDuration(data.totalSeconds)}
        </p>
        <p className="text-xs text-muted">kokku fookust</p>
      </div>

      {data.activities.length > 0 ? (
        <div>
          <div className="mb-2 flex h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
            {data.activities.map((activity) => (
              <div
                key={activity.name}
                style={{
                  width: `${data.totalSeconds > 0 ? (activity.seconds / data.totalSeconds) * 100 : 0}%`,
                  backgroundColor: activity.color,
                }}
              />
            ))}
          </div>
          <ul className="space-y-1.5">
            {data.activities.map((activity, i) => (
              <li key={activity.name} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-foreground" />
                <span className={`flex-1 truncate ${i === 0 ? "font-semibold" : ""} text-foreground`}>
                  {activity.name}
                </span>
                <span className="font-mono text-muted">{formatDuration(activity.seconds)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted">Pole veel fookust.</p>
      )}
    </div>
  );
}

export function FocusLoopWidget() {
  const [view, setView] = useState<"today" | "week">("today");

  const todayStats = useTodayFocusStats();
  const weeklyStats = useWeeklyFocusStats();
  const active = view === "today" ? todayStats : weeklyStats;

  return (
    <Card>
      <div className="mb-4 flex shrink-0 items-center justify-between">
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {active.isLoading || !active.data ? (
          <Skeleton className="h-24 w-full" />
        ) : active.error ? (
          <p className="text-sm text-destructive">FocusLoopi laadimine ebaõnnestus.</p>
        ) : (
          <FocusStatsView data={active.data} />
        )}
      </div>
    </Card>
  );
}
