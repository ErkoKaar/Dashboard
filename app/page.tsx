"use client";

import { useState } from "react";
import Image from "next/image";
import { Briefcase, LogOut, User } from "lucide-react";
import { ClockWidget } from "@/components/widgets/ClockWidget";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";
import { LoginForm } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import { useTodayTasks } from "@/lib/queries/useTodayTasks";
import { DashboardContext, WIDGET_REGISTRY } from "@/lib/widgets";
import { getGreeting } from "@/lib/date";
import profilePhoto from "@/app/images/CVpilt.jpeg";

export default function DashboardPage() {
  const { taskSession, financeSession, loading, signOut } = useAuth();
  const { data: todayTasks } = useTodayTasks();

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

  return (
    <main className="mx-auto max-w-[1600px] p-4 md:p-8">
      <header className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="relative grid grid-cols-1 gap-6 p-6 md:p-8 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-10">
          <Image
            src={profilePhoto}
            alt="Erko Kaar"
            width={96}
            height={96}
            priority
            className="h-20 w-20 shrink-0 rounded-full object-cover object-top shadow-[0_0_24px_-2px_var(--accent)] ring-1 ring-border sm:h-24 sm:w-24"
          />

          <div className="min-w-0">
            <h1 className="font-serif text-4xl italic leading-none text-foreground sm:text-5xl">
              {greeting}, Erko.
            </h1>
            <p className="mt-3 font-mono text-sm uppercase tracking-wide text-muted">
              {today}
              {taskSummary && ` · ${taskSummary}`}
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 lg:items-end">
            <ClockWidget size="lg" />
            <WeatherWidget />
          </div>
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-6 py-3 md:px-8">
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 p-1">
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
              onClick={() => setDashboardContext("work")}
              aria-pressed={dashboardContext === "work"}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                dashboardContext === "work"
                  ? "bg-accent text-background"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" aria-hidden />
              Work
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" aria-hidden />
              Logi välja
            </Button>
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
          {visibleWidgets.map(({ id, Component, colSpan }) => (
            <div key={id} className={colSpan}>
              <Component />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
