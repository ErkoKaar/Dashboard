import { ReactNode } from "react";

interface GalleryCardProps {
  done: boolean;
  children: ReactNode;
  className?: string;
}

export function GalleryCard({ done, children, className = "" }: GalleryCardProps) {
  return (
    <div
      className={`relative flex min-h-[64px] flex-col justify-between gap-2 rounded-lg p-2.5 transition-all duration-300 ${
        done
          ? "border-2 border-accent bg-accent/10 shadow-[0_0_12px_-1px_var(--accent),0_0_40px_-6px_var(--accent)]"
          : "border border-border/50 bg-surface-hover/70 shadow-[0_0_20px_-5px_var(--accent)] hover:border-accent/40"
      } ${className}`}
    >
      {children}
    </div>
  );
}
