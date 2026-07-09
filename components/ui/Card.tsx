import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`relative flex h-[260px] flex-col overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all duration-300 hover:border-accent/40 hover:shadow-[0_0_28px_-10px_var(--accent)] ${className}`}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/10 blur-2xl"
        aria-hidden
      />
      {children}
    </div>
  );
}
