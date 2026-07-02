"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { WeeklyChart } from "@/components/ui/WeeklyChart";
import { useTodayHabits, useToggleHabit } from "@/lib/queries/useTodayHabits";
import { useWeeklyHabitStats } from "@/lib/queries/useWeeklyHabitStats";

export function HabitsWidget() {
  const [view, setView] = useState<"today" | "week">("today");

  const { data, isLoading, error } = useTodayHabits();
  const toggleHabit = useToggleHabit();
  const weekly = useWeeklyHabitStats();

  return (
    <Card className="col-span-12 md:col-span-6 xl:col-span-4">
      <div className="mb-4 flex items-center justify-between">
        <WidgetTitle icon={Repeat}>Habits</WidgetTitle>
        <div className="flex gap-1">
          <TabButton active={view === "today"} onClick={() => setView("today")}>
            Täna
          </TabButton>
          <TabButton active={view === "week"} onClick={() => setView("week")}>
            See nädal
          </TabButton>
        </div>
      </div>

      {view === "week" ? (
        weekly.isLoading || !weekly.data ? (
          <Skeleton className="h-32 w-full" />
        ) : weekly.error ? (
          <p className="text-sm text-destructive">Statistika laadimine ebaõnnestus.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted">
              Sel nädalal tehtud:{" "}
              <span className="font-mono font-semibold text-foreground">{weekly.data.totalDone}</span>
            </p>
            <WeeklyChart daily={weekly.data.daily} />
          </>
        )
      ) : isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">Habitite laadimine ebaõnnestus.</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted">Aktiivseid habiteid pole.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {data.map((habit) => (
              <li key={habit.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={habit.done}
                  onChange={() => toggleHabit.mutate({ habitId: habit.id, done: !habit.done })}
                  className="h-4 w-4 cursor-pointer accent-accent"
                />
                <span className={`text-sm ${habit.done ? "text-muted line-through" : "text-foreground"}`}>
                  {habit.name}
                </span>
              </li>
            ))}
          </ul>
          {toggleHabit.error && <p className="mt-2 text-sm text-destructive">Toiming ebaõnnestus.</p>}
        </>
      )}
    </Card>
  );
}
