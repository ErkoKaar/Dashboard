"use client";

import { useEffect, useState } from "react";

export function ClockWidget() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p className="w-[5ch] font-mono text-lg font-semibold tabular-nums text-foreground">
      {now
        ? now.toLocaleTimeString("et-EE", { hour: "2-digit", minute: "2-digit" })
        : " "}
    </p>
  );
}
