"use client";

import { PointerEvent, ReactNode, useRef } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  const glareRef = useRef<HTMLSpanElement>(null);

  // Transform otse elemendile, mitte CSS-muutujaga — muidu arvutaks iga liigutus kõigi laste stiilid ümber.
  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || !glareRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    glareRef.current.style.transform = `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px)`;
  }

  return (
    <div
      onPointerMove={handlePointerMove}
      className={`glass group relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-2xl p-5 ${className}`}
    >
      <span
        ref={glareRef}
        className="glass-glare pointer-events-none absolute -left-48 -top-48 -z-10 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.07),transparent_65%)]"
        aria-hidden
      />
      {children}
    </div>
  );
}
