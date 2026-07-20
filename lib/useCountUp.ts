"use client";

import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(0);
  const isFirst = useRef(true);
  const settledFrom = useRef(0);

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const from = isFirst.current ? 0 : settledFrom.current;
    isFirst.current = false;

    if (reduceMotion || from === target) {
      setValue(target);
      settledFrom.current = target;
      return;
    }

    const start = performance.now();
    let raf: number;

    function tick(now: number) {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        settledFrom.current = target;
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}
