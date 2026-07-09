"use client";

import { Check } from "lucide-react";

interface CheckToggleProps {
  checked: boolean;
  onChange: () => void;
  "aria-label": string;
}

export function CheckToggle({ checked, onChange, ...props }: CheckToggleProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors duration-200 ${
        checked ? "border-accent bg-accent" : "border-border bg-transparent hover:border-muted"
      }`}
      {...props}
    >
      {checked && <Check className="h-3 w-3 text-background" strokeWidth={3} aria-hidden />}
    </button>
  );
}
