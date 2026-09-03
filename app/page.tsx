"use client";

import { useState } from "react";
import Image from "next/image";
import { FolderTree, ListChecks, LogOut, StickyNote, User } from "lucide-react";
import { ClockWidget } from "@/components/widgets/ClockWidget";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";
import { LoginForm } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import { useTodayTasks } from "@/lib/queries/useTodayTasks";
import { useTodayHabits } from "@/lib/queries/useTodayHabits";
import { useCalendarEvents } from "@/lib/queries/useCalendarEvents";
import { DashboardContext, WIDGET_REGISTRY } from "@/lib/widgets";
import { getGreeting } from "@/lib/date";
import profilePhoto from "@/app/images/CVpilt.jpeg";

function formatCountdown(target: Date, now: Date): string {
  const totalMinutes = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function DashboardPage() {
  const { taskSession, financeSession, loading, signOut } = useAuth();
  const { data: todayTasks } = useTodayTasks();
  const { data: todayHabits } = useTodayHabits();
  const { data: calendarEvents } = useCalendarEvents();

  const [dashboardContext, setDashboardContext] = useState<DashboardContext>("personal");

  const visibleWidgets = WIDGET_REGISTRY.filter((w) => w.context === dashboardContext);

  if (loading) return null;
  if (!taskSession || !financeSession) return <LoginForm />;

  const greeting = getGreeting();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const doneCount = todayTasks?.filter((t) => t.done).length ?? 0;
  const totalCount = todayTasks?.length ?? 0;
  const taskSummary =
    todayTasks === undefined ? null : totalCount > 0 ? `${doneCount}/${totalCount} tasks done` : "No tasks today";

  const habitsDoneCount = todayHabits?.filter((h) => h.done).length ?? 0;
  const habitsTotalCount = todayHabits?.length ?? 0;
  const habitSummary = habitsTotalCount > 0 ? `${habitsDoneCount}/${habitsTotalCount} habits done` : null;

  const now = new Date();
  const nextEvent = (calendarEvents ?? [])
    .filter((e) => !e.allDay && e.time)
    .map((e) => ({ event: e, start: new Date(`${e.date}T${e.time}`) }))
    .filter((e) => e.start.getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  const eventSummary = nextEvent ? `${nextEvent.event.title} in ${formatCountdown(nextEvent.start, now)}` : null;

  return (
    <main className="mx-auto max-w-[1600px] p-4 md:p-8">
      <header className="relative mb-10 border-b border-border/50 pb-6">
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden" aria-hidden>
          <span className="animate-scanline absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent" />
        </span>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 text-sm">
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface/60 p-1">
            <button
              onClick={() => setDashboardContext("personal")}
              aria-pressed={dashboardContext === "personal"}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                dashboardContext === "personal"
                  ? "bg-accent text-background"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <User className="h-3.5 w-3.5" aria-hidden />
              Personal
            </button>
            <button
              onClick={() => setDashboardContext("taskmanager")}
              aria-pressed={dashboardContext === "taskmanager"}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                dashboardContext === "taskmanager"
                  ? "bg-accent text-background"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <ListChecks className="h-3.5 w-3.5" aria-hidden />
              Taskmanager
            </button>
            <button
              onClick={() => setDashboardContext("notes")}
              aria-pressed={dashboardContext === "notes"}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                dashboardContext === "notes"
                  ? "bg-accent text-background"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <StickyNote className="h-3.5 w-3.5" aria-hidden />
              Quick Notes
            </button>
            <button
              onClick={() => setDashboardContext("files")}
              aria-pressed={dashboardContext === "files"}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                dashboardContext === "files"
                  ? "bg-accent text-background"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <FolderTree className="h-3.5 w-3.5" aria-hidden />
              File system
            </button>
          </div>

          <Button variant="ghost" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" aria-hidden />
            Logi välja
          </Button>
        </div>

        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-5">
            <Image
              src={profilePhoto}
              alt="Erko Kaar"
              width={112}
              height={112}
              priority
              className="h-20 w-20 shrink-0 rounded-full object-cover object-top shadow-[0_0_16px_-4px_rgba(16,161,180,0.35)] ring-1 ring-border sm:h-24 sm:w-24"
            />

            <div className="animate-reveal min-w-0">
              <h1 className="font-mono text-4xl font-bold leading-none tracking-tight text-foreground sm:text-6xl">
                {greeting}, Erko.
              </h1>
              <p className="mt-3 font-mono text-sm uppercase tracking-wide text-muted">
                {today}
                {taskSummary && ` · ${taskSummary}`}
                {habitSummary && ` · ${habitSummary}`}
                {eventSummary && ` · ${eventSummary}`}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <ClockWidget size="lg" />
            <WeatherWidget />
          </div>
        </div>
      </header>

      {visibleWidgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-24 text-center">
          <p className="text-sm text-muted">Töövaade on veel tühi.</p>
          <p className="text-xs text-muted/60">Lisa siia oma töövidinad, kui need valmis on.</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {visibleWidgets.map(({ id, Component, colSpan }, i) => (
            <div
              key={id}
              className={`animate-rise-in ${colSpan}`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Component />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
