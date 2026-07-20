"use client";

import { useEffect, useRef, useState } from "react";

export function useCelebrateOnComplete(
  done: number,
  total: number,
  key: string | number = "default",
  durationMs = 2600,
): boolean {
  const wasComplete = useRef(false);
  const prevKey = useRef(key);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    const isComplete = total > 0 && done === total;
    const keyChanged = prevKey.current !== key;
    prevKey.current = key;

    // Switching to a different dataset (eg. another project) shouldn't
    // celebrate just because that dataset happens to already be complete.
    if (keyChanged) {
      wasComplete.current = isComplete;
      return;
    }

    const justCompleted = isComplete && !wasComplete.current;
    wasComplete.current = isComplete;
    if (!justCompleted) return;

    setCelebrating(true);
    const timeout = setTimeout(() => setCelebrating(false), durationMs);
    return () => clearTimeout(timeout);
  }, [done, total, key, durationMs]);

  return celebrating;
}
