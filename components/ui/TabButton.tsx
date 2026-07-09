"use client";

import { ReactNode } from "react";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors duration-200 ${
        active
          ? "bg-surface-hover font-semibold text-foreground"
          : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
