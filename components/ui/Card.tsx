import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

const CORNER_BASE = "pointer-events-none absolute h-3.5 w-3.5 border-accent/70";

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`group relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-xl border-2 border-accent/15 bg-surface/55 p-5 backdrop-blur-md transition-transform duration-300 hover:scale-[1.02] ${className}`}
    >
      <span className={`${CORNER_BASE} left-0.5 top-0.5 rounded-tl-md border-l border-t`} aria-hidden />
      <span className={`${CORNER_BASE} right-0.5 top-0.5 rounded-tr-md border-r border-t`} aria-hidden />
      <span className={`${CORNER_BASE} bottom-0.5 left-0.5 rounded-bl-md border-b border-l`} aria-hidden />
      <span className={`${CORNER_BASE} bottom-0.5 right-0.5 rounded-br-md border-b border-r`} aria-hidden />
      {children}
    </div>
  );
}
