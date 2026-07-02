"use client";

import { Cloud } from "lucide-react";
import { useWeather } from "@/lib/queries/useWeather";

export function WeatherWidget() {
  const { data, isLoading, error } = useWeather();

  if (isLoading || error || !data) return null;

  return (
    <p className="flex items-center gap-2 text-sm text-muted" title="Tallinn">
      <Cloud className="h-4 w-4" aria-hidden />
      <span className="font-mono font-semibold tabular-nums text-foreground">
        {Math.round(data.temperature)}°C
      </span>
      <span className="hidden lg:inline">{data.description}</span>
    </p>
  );
}
