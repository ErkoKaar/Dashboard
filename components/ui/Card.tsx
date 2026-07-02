import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-5 transition-colors duration-200 hover:border-muted/40 ${className}`}
    >
      {children}
    </div>
  );
}
