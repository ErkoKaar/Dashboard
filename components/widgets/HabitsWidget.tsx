"use client";

import { Repeat } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { GalleryGrid } from "@/components/ui/GalleryGrid";
import { GalleryCard } from "@/components/ui/GalleryCard";
import { CelebrationOverlay } from "@/components/ui/CelebrationOverlay";
import { useTodayHabits, useToggleHabit } from "@/lib/queries/useTodayHabits";
import { dailyScoreStatus, scoreBadge } from "@/lib/dailyScoreStatus";
import { useCelebrateOnComplete } from "@/lib/useCelebrateOnComplete";

export function HabitsWidget() {
  const { data, isLoading, error } = useTodayHabits();
  const toggleHabit = useToggleHabit();

  const done = data?.filter((h) => h.done).length ?? 0;
  const total = data?.length ?? 0;
  const celebrating = useCelebrateOnComplete(done, total);

  return (
    <Card>
      <CelebrationOverlay active={celebrating} />
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={Repeat} href="https://taskzen-phi.vercel.app/tasks/habits">
          Habits
        </WidgetTitle>
        <span className="font-mono text-xs text-muted">{scoreBadge(done, total)}</span>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">Habitite laadimine ebaõnnestus.</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted">Aktiivseid habiteid pole.</p>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3 border-b border-border/40 pb-4">
            <ProgressRing done={done} total={total} size={96} strokeWidth={7} />
            <div>
              <p className="text-base font-semibold text-foreground">Daily score</p>
              <p className="text-xs text-muted">resets 00:00</p>
              <p className="mt-1.5 text-sm font-medium text-accent">{dailyScoreStatus(done, total)}</p>
            </div>
          </div>

          <GalleryGrid>
            {data.map((habit) => (
              <GalleryCard key={habit.id} done={habit.done}>
                <CheckToggle
                  checked={habit.done}
                  onChange={() => toggleHabit.mutate({ habitId: habit.id, done: !habit.done })}
                  aria-label={habit.done ? "Märgi tegemata" : "Märgi tehtud"}
                />
                <span
                  className={`line-clamp-2 text-sm ${
                    habit.done ? "font-semibold text-foreground" : "text-foreground"
                  }`}
                >
                  {habit.name}
                </span>
              </GalleryCard>
            ))}
          </GalleryGrid>
        </>
      )}

      {toggleHabit.error && <p className="mt-2 text-sm text-destructive">Toiming ebaõnnestus.</p>}
    </Card>
  );
}
