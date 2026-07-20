"use client";

import { CSSProperties, useState } from "react";

const PARTICLE_COUNT = 28;
const PARTICLE_COLORS = ["bg-accent", "bg-accent-bright", "bg-positive", "bg-positive-warm", "bg-warning"];

export function CelebrationOverlay({ active }: { active: boolean }) {
  const [particles] = useState(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = (360 / PARTICLE_COUNT) * i + Math.random() * 12;
      const distance = 60 + Math.random() * 140;
      const rad = (angle * Math.PI) / 180;
      return {
        dx: Math.cos(rad) * distance,
        dy: Math.sin(rad) * distance,
        delay: Math.random() * 0.3,
        size: 4 + Math.random() * 4,
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      };
    }),
  );

  if (!active) return null;

  return (
    <span className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" aria-hidden>
      <span className="animate-celebrate-flash absolute inset-0 rounded-xl bg-positive-warm/10" />
      {particles.map((p, i) => (
        <span
          key={i}
          className={`particle-burst absolute left-1/2 top-1/2 rounded-full ${p.color}`}
          style={
            {
              width: p.size,
              height: p.size,
              "--particle-dx": `${p.dx}px`,
              "--particle-dy": `${p.dy}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: "1.8s",
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
