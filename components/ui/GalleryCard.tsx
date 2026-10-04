import { ReactNode } from "react";

interface GalleryCardProps {
  done: boolean;
  children: ReactNode;
  className?: string;
}

export function GalleryCard({ done, children, className = "" }: GalleryCardProps) {
  return (
    <div
      className={`tile-enter relative flex min-h-[64px] flex-col justify-between gap-2 rounded-xl p-2.5 ${
        done
          ? "border border-accent/70 bg-accent/15 shadow-[0_10px_28px_-14px_var(--accent)]"
          : "border border-white/[0.07] bg-white/[0.04] hover:border-white/15 hover:bg-white/[0.07]"
      } ${className}`}
    >
      {children}
    </div>
  );
}
