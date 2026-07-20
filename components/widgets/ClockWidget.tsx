"use client";

import { useEffect, useState } from "react";

interface ClockWidgetProps {
  size?: "sm" | "lg";
}

const sizeClasses: Record<NonNullable<ClockWidgetProps["size"]>, string> = {
  sm: "text-lg",
  lg: "text-4xl leading-none sm:text-5xl",
};

export function ClockWidget({ size = "sm" }: ClockWidgetProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p
      className={`w-[5ch] font-mono font-bold tracking-tight tabular-nums text-foreground ${sizeClasses[size]}`}
    >
      {now
        ? now.toLocaleTimeString("et-EE", { hour: "2-digit", minute: "2-digit" })
        : " "}
    </p>
  );
}
