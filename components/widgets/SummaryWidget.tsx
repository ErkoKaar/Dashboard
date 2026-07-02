"use client";

import { Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDashboardSummary } from "@/lib/queries/useDashboardSummary";

export function SummaryWidget() {
  const { summary, isToday, isLoading, error } = useDashboardSummary();

  return (
    <div className="rounded-xl border-l-2 border-accent bg-surface/60 p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted">
        <Sparkles className="h-4 w-4 text-accent" aria-hidden />
        Päeva kokkuvõte
      </div>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">Kokkuvõtte laadimine ebaõnnestus.</p>
      ) : !summary ? (
        <p className="text-sm text-muted">Kokkuvõte genereeritakse kell 20.</p>
      ) : (
        <div>
          <p className="text-sm italic leading-relaxed text-foreground">
            &ldquo;{summary.summary}&rdquo;
          </p>
          <p className="mt-3 text-xs text-muted">
            {isToday ? "Täna" : `Eile, ${summary.date}`}
          </p>
        </div>
      )}
    </div>
  );
}
