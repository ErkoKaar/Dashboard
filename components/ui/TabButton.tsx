"use client";

import { ReactNode } from "react";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}

export function TabButton({ active, onClick, children, className = "" }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`relative cursor-pointer px-2 py-1 text-center font-mono text-[10px] uppercase tracking-wide transition-colors duration-200 ${
        active ? "text-foreground" : "text-muted hover:text-foreground"
      } ${className}`}
    >
      {children}
      <span
        className={`absolute inset-x-2 -bottom-0.5 h-px origin-center bg-accent transition-transform duration-200 ${
          active ? "scale-x-100" : "scale-x-0"
        }`}
        aria-hidden
      />
    </button>
  );
}
