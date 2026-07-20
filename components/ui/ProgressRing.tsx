"use client";

import { CSSProperties, useEffect, useId, useRef, useState } from "react";
import { Check, ListTodo } from "lucide-react";
import { useCountUp } from "@/lib/useCountUp";

interface ProgressRingProps {
  done: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  "aria-label"?: string;
}

const BURST_COUNT = 13;
const BURST_COLORS = ["bg-positive", "bg-accent-bright", "bg-accent"];

function CompletionBurst() {
  const [particles] = useState(() =>
    Array.from({ length: BURST_COUNT }, (_, i) => {
      const angle = (360 / BURST_COUNT) * i + Math.random() * 20;
      const distance = 48 + Math.random() * 32;
      const rad = (angle * Math.PI) / 180;
      return {
        dx: Math.cos(rad) * distance,
        dy: Math.sin(rad) * distance,
        delay: Math.random() * 0.08,
        color: BURST_COLORS[i % BURST_COLORS.length],
      };
    }),
  );

  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {particles.map((p, i) => (
        <span
          key={i}
          className={`particle-burst absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full ${p.color}`}
          style={
            {
              "--particle-dx": `${p.dx}px`,
              "--particle-dy": `${p.dy}px`,
              animationDelay: `${p.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

export function ProgressRing({ done, total, size = 72, strokeWidth = 5, ...props }: ProgressRingProps) {
  const gradientId = useId();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? done / total : 0;
  const offset = circumference * (1 - progress);
  const isComplete = total > 0 && done === total;
  const animatedDone = useCountUp(done);

  const prevDone = useRef(done);
  const [burstKey, setBurstKey] = useState<number | null>(null);

  useEffect(() => {
    const increased = done > prevDone.current;
    prevDone.current = done;
    if (!increased) return;
    const key = Date.now();
    setBurstKey(key);
    const timeout = setTimeout(() => setBurstKey((current) => (current === key ? null : current)), 750);
    return () => clearTimeout(timeout);
  }, [done]);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={props["aria-label"] ?? `${done}/${total} tehtud`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-bright)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-hover)"
          strokeWidth={strokeWidth}
        />
        {total > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isComplete ? "var(--positive)" : `url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {total === 0 ? (
          <ListTodo className="h-5 w-5 text-muted/60" aria-hidden />
        ) : isComplete ? (
          <Check className="h-5 w-5 text-positive" strokeWidth={3} aria-hidden />
        ) : (
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {Math.round(animatedDone)}/{total}
          </span>
        )}
      </div>
      {burstKey !== null && <CompletionBurst key={burstKey} />}
    </div>
  );
}
