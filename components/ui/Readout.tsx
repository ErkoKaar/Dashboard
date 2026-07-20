"use client";

import { useCountUp } from "@/lib/useCountUp";

interface ReadoutProps {
  value: number;
  label: string;
  format?: (n: number) => string;
  size?: "md" | "lg";
  tone?: "default" | "positive" | "destructive";
}

const SIZE_CLASS: Record<NonNullable<ReadoutProps["size"]>, string> = {
  md: "text-3xl",
  lg: "text-4xl sm:text-5xl",
};

const TONE_CLASS: Record<NonNullable<ReadoutProps["tone"]>, string> = {
  default: "text-foreground",
  positive: "text-positive",
  destructive: "text-destructive",
};

export function Readout({ value, label, format, size = "md", tone = "default" }: ReadoutProps) {
  const animated = useCountUp(value);
  const display = format ? format(animated) : Math.round(animated).toString();

  return (
    <div>
      <p
        className={`font-mono font-bold tabular-nums tracking-tight ${SIZE_CLASS[size]} ${TONE_CLASS[tone]}`}
      >
        {display}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
