"use client";

import { useState } from "react";
import { Check, ChevronDown, Repeat } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { GalleryGrid } from "@/components/ui/GalleryGrid";
import { GalleryCard } from "@/components/ui/GalleryCard";
import { CelebrationOverlay } from "@/components/ui/CelebrationOverlay";
import { useTodayHabits, useToggleHabit, type TodayHabit } from "@/lib/queries/useTodayHabits";
import { dailyScoreStatus, scoreBadge } from "@/lib/dailyScoreStatus";
import { useCelebrateOnComplete } from "@/lib/useCelebrateOnComplete";

export function HabitsWidget() {
  const { data, isLoading, error } = useTodayHabits();
  const toggleHabit = useToggleHabit();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Score counts top-level habits only: a parent counts as one, done when all
  // its children are done.
  const done = (data ?? []).filter((h) => h.done).length;
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
            {data.map((habit) =>
              habit.children.length > 0 ? (
                <ParentHabitCard
                  key={habit.id}
                  habit={habit}
                  expanded={expanded.has(habit.id)}
                  onToggleExpand={() => toggleExpand(habit.id)}
                  onToggleChild={(child) =>
                    toggleHabit.mutate({ habitId: child.id, done: !child.done })
                  }
                />
              ) : (
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
              ),
            )}
          </GalleryGrid>
        </>
      )}

      {toggleHabit.error && <p className="mt-2 text-sm text-destructive">Toiming ebaõnnestus.</p>}
    </Card>
  );
}

interface ParentHabitCardProps {
  habit: TodayHabit;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleChild: (child: TodayHabit) => void;
}

function ParentHabitCard({ habit, expanded, onToggleExpand, onToggleChild }: ParentHabitCardProps) {
  const doneChildren = habit.children.filter((c) => c.done).length;

  return (
    <GalleryCard done={habit.done} className={expanded ? "col-span-full" : ""}>
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 text-left"
      >
        {/* Read-only derived state — a parent can't be checked manually. */}
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
            habit.done ? "border-accent bg-accent" : "border-muted/60 bg-transparent"
          }`}
          aria-hidden
        >
          {habit.done && <Check className="h-3.5 w-3.5 text-background" strokeWidth={3} />}
        </span>
        <span
          className={`line-clamp-2 flex-1 text-sm ${
            habit.done ? "font-semibold text-foreground" : "text-foreground"
          }`}
        >
          {habit.name}
        </span>
        <span className="shrink-0 font-mono text-xs text-muted">
          {doneChildren}/{habit.children.length}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="mt-3 flex items-center gap-3 border-t border-border/40 pt-3">
          <ProgressRing
            done={doneChildren}
            total={habit.children.length}
            size={72}
            strokeWidth={5}
            aria-label={`${habit.name}: ${doneChildren}/${habit.children.length} tehtud`}
          />
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
            {habit.children.map((child) => (
              <GalleryCard key={child.id} done={child.done}>
                <CheckToggle
                  checked={child.done}
                  onChange={() => onToggleChild(child)}
                  aria-label={child.done ? "Märgi tegemata" : "Märgi tehtud"}
                />
                <span
                  className={`line-clamp-2 text-sm ${
                    child.done ? "font-semibold text-foreground" : "text-foreground"
                  }`}
                >
                  {child.name}
                </span>
              </GalleryCard>
            ))}
          </div>
        </div>
      )}
    </GalleryCard>
  );
}
