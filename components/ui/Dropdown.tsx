"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface DropdownOption {
  id: string;
  label: string;
  count?: number;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Dropdown({ options, value, onChange, className = "" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors duration-200 hover:border-accent/40 focus:border-accent focus:outline-none"
      >
        <span className="truncate">{selected?.label ?? "—"}</span>
        <span className="flex shrink-0 items-center gap-2">
          {!!selected?.count && (
            <span className="rounded-full bg-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-muted">
              {selected.count}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors duration-200 ${
                o.id === value
                  ? "bg-surface-hover text-foreground"
                  : "text-muted hover:bg-surface-hover/60 hover:text-foreground"
              }`}
            >
              <span className="truncate">{o.label}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                {!!o.count && <span className="font-mono text-[10px] text-muted">{o.count}</span>}
                {o.id === value && <Check className="h-3 w-3 text-accent" aria-hidden />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
