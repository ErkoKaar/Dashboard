"use client";

import Image from "next/image";
import { LogOut } from "lucide-react";
import { GithubWidget } from "@/components/widgets/GithubWidget";
import { FinanceWidget } from "@/components/widgets/FinanceWidget";
import { TasksWidget } from "@/components/widgets/TasksWidget";
import { HabitsWidget } from "@/components/widgets/HabitsWidget";
import { FocusLoopWidget } from "@/components/widgets/FocusLoopWidget";
import { ClockWidget } from "@/components/widgets/ClockWidget";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";
import { ChessWidget } from "@/components/widgets/ChessWidget";
import { CalendarWidget } from "@/components/widgets/CalendarWidget";
import { SummaryWidget } from "@/components/widgets/SummaryWidget";
import { LoginForm } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import logo from "@/app/images/logo-1a-tume.jpg";

export default function DashboardPage() {
  const { taskSession, financeSession, loading, signOut } = useAuth();

  if (loading) return null;
  if (!taskSession || !financeSession) return <LoginForm />;

  const today = new Date().toLocaleDateString("et-EE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <main className="mx-auto max-w-[1600px] p-4 md:p-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src={logo}
            alt="Dashboardi logo"
            width={40}
            height={40}
            priority
            className="rounded-xl"
          />
          <div>
            <h1 className="text-xl font-semibold leading-tight">Dashboard</h1>
            <p className="text-sm capitalize text-muted">{today}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden items-center gap-4 sm:flex">
            <WeatherWidget />
            <ClockWidget />
          </div>
          <div className="hidden h-6 w-px bg-border sm:block" />
          <Button variant="ghost" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" aria-hidden />
            Logi välja
          </Button>
        </div>
      </header>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="grid flex-1 grid-cols-12 gap-4">
          <GithubWidget />
          <FinanceWidget />
          <TasksWidget />
          <HabitsWidget />
          <FocusLoopWidget />
          <ChessWidget />
          <CalendarWidget />
        </div>
        <aside className="w-full xl:sticky xl:top-8 xl:w-80 xl:shrink-0">
          <SummaryWidget />
        </aside>
      </div>
    </main>
  );
}
