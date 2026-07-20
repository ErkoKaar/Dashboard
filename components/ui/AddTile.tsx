"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

interface AddTileProps {
  placeholder: string;
  onAdd: (title: string) => void;
  disabled?: boolean;
}

export function AddTile({ placeholder, onAdd, disabled }: AddTileProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  function commit() {
    const trimmed = value.trim();
    if (trimmed) onAdd(trimmed);
    setValue("");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex min-h-[64px] flex-col justify-center gap-2 rounded-lg border border-accent/50 bg-surface-hover/40 p-2.5">
        <input
          autoFocus
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted/60 outline-none"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue("");
              setEditing(false);
            }
          }}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/30 text-muted transition-colors duration-200 hover:border-accent/50 hover:text-accent"
      aria-label={placeholder}
    >
      <Plus className="h-4 w-4" aria-hidden />
    </button>
  );
}
