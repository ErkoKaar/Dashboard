"use client";

import { CSSProperties, useState } from "react";
import { Check } from "lucide-react";

interface CheckToggleProps {
  checked: boolean;
  onChange: () => void;
  "aria-label": string;
}

const PARTICLE_COUNT = 7;
const PARTICLE_COLORS = ["bg-accent", "bg-accent-bright", "bg-positive"];

function ParticleBurst() {
  const [particles] = useState(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = (360 / PARTICLE_COUNT) * i + Math.random() * 25;
      const distance = 12 + Math.random() * 10;
      const rad = (angle * Math.PI) / 180;
      return {
        dx: Math.cos(rad) * distance,
        dy: Math.sin(rad) * distance,
        delay: Math.random() * 0.06,
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      };
    }),
  );

  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {particles.map((p, i) => (
        <span
          key={i}
          className={`particle-burst absolute left-1/2 top-1/2 h-1 w-1 rounded-full ${p.color}`}
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

export function CheckToggle({ checked, onChange, ...props }: CheckToggleProps) {
  const [burstKey, setBurstKey] = useState<number | null>(null);

  function handleClick() {
    if (!checked) {
      const key = Date.now();
      setBurstKey(key);
      setTimeout(() => setBurstKey((current) => (current === key ? null : current)), 500);
    }
    onChange();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors duration-200 ${
        checked ? "border-accent bg-accent" : "border-border bg-transparent hover:border-muted"
      }`}
      {...props}
    >
      {checked && <Check className="h-3 w-3 text-background" strokeWidth={3} aria-hidden />}
      {burstKey !== null && <ParticleBurst key={burstKey} />}
    </button>
  );
}
