"use client";

import { Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDashboardSummary } from "@/lib/queries/useDashboardSummary";

export function SummaryWidget() {
  const { summary, isToday, isLoading, error } = useDashboardSummary();

  return (
    <div className="flex w-full flex-col gap-3 overflow-hidden rounded-xl border border-accent/20 bg-gradient-to-r from-accent/10 via-surface to-surface p-6 md:flex-row md:items-center md:gap-6">
      <div className="flex shrink-0 items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-foreground md:w-44">
        <Sparkles className="h-4 w-4 text-accent" aria-hidden />
        Päeva kokkuvõte
      </div>
      <div className="flex-1">
        {isLoading ? (
          <Skeleton className="h-6 w-full" />
        ) : error ? (
          <p className="text-sm text-destructive">Kokkuvõtte laadimine ebaõnnestus.</p>
        ) : !summary ? (
          <p className="text-sm text-muted">Kokkuvõte genereeritakse kell 20.</p>
        ) : (
          <p className="font-serif text-xl italic leading-relaxed text-foreground">
            {summary.summary}
          </p>
        )}
      </div>
      {summary && (
        <p className="shrink-0 text-xs text-muted md:text-right">
          {isToday ? "Täna" : `Eile, ${summary.date}`}
        </p>
      )}
    </div>
  );
}
