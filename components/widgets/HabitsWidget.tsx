"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, Repeat } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { ChecklistRow, checklistTextClass } from "@/components/ui/ChecklistRow";
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

          <ul className="flex flex-col gap-1">
            {data.map((habit) => (
              <li key={habit.id}>
                {habit.children.length > 0 ? (
                  <ParentHabit
                    habit={habit}
                    expanded={expanded.has(habit.id)}
                    onToggleExpand={() => toggleExpand(habit.id)}
                    onToggleChild={(child) =>
                      toggleHabit.mutate({ habitId: child.id, done: !child.done })
                    }
                  />
                ) : (
                  <HabitRow
                    habit={habit}
                    onToggle={() => toggleHabit.mutate({ habitId: habit.id, done: !habit.done })}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {toggleHabit.error && <p className="mt-2 text-sm text-destructive">Toiming ebaõnnestus.</p>}
    </Card>
  );
}

function HabitRow({ habit, onToggle }: { habit: TodayHabit; onToggle: () => void }) {
  return (
    <ChecklistRow
      done={habit.done}
      leading={
        <CheckToggle
          checked={habit.done}
          onChange={onToggle}
          aria-label={habit.done ? "Märgi tegemata" : "Märgi tehtud"}
        />
      }
    >
      <span className={checklistTextClass(habit.done)}>{habit.name}</span>
    </ChecklistRow>
  );
}

/** Ülemise habiti seis: valmis on täidetud ring linnukesega, muidu kaar tehtud alamhabitide osaga. */
function ParentProgress({ done, total }: { done: number; total: number }) {
  if (total > 0 && done === total) {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent" aria-hidden>
        <Check className="h-3.5 w-3.5 text-background" strokeWidth={3} />
      </span>
    );
  }
  const circumference = 2 * Math.PI * 10;
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" strokeWidth="2" className="stroke-muted/60" />
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - (total > 0 ? done / total : 0))}
        className="stroke-accent transition-[stroke-dashoffset] duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
        opacity={done > 0 ? 1 : 0}
      />
    </svg>
  );
}

interface ParentHabitProps {
  habit: TodayHabit;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleChild: (child: TodayHabit) => void;
}

// Alamhabitidega habit: rida avab alamhabitid enda alla (accordion), taandega ja juhtjoonega, mis
// algab ülemise rea ringi alt. Kogu rida on avamisnupp; ring ja loendur on ainult näit.
function ParentHabit({ habit, expanded, onToggleExpand, onToggleChild }: ParentHabitProps) {
  const panelId = useId();
  const doneChildren = habit.children.filter((c) => c.done).length;

  return (
    <div>
      <ChecklistRow
        done={habit.done}
        leading={<ParentProgress done={doneChildren} total={habit.children.length} />}
        trailing={
          <>
            <span className="font-mono text-xs text-muted" aria-hidden>
              {doneChildren}/{habit.children.length}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
          </>
        }
      >
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-controls={panelId}
          className={`w-full cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-accent/60 ${checklistTextClass(habit.done)}`}
        >
          {habit.name}
          <span className="sr-only">
            , {doneChildren}/{habit.children.length} tehtud
          </span>
        </button>
      </ChecklistRow>

      {/* 0fr → 1fr: paneel avaneb sisu kõrguseni ilma seda mõõtmata. inert: suletud alamhabitid ei saa
          fookust. Vähendatud liikumisel kõrgus muutub kohe, sisu ilmub ainult hajutusega. */}
      <div
        id={panelId}
        inert={!expanded}
        className={`grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <ul
          className={`ml-6 flex min-h-0 flex-col gap-1 overflow-hidden border-l border-white/10 pl-2 transition-opacity duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${
            expanded ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Vahe ülemisest reast on li-l, mitte ul-il: ul-i polsterdus jääks suletuna näha. */}
          {habit.children.map((child) => (
            <li key={child.id} className="first:pt-1 last:pb-1">
              <HabitRow habit={child} onToggle={() => onToggleChild(child)} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
