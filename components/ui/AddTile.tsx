"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

interface AddTileProps {
  placeholder: string;
  onAdd: (title: string) => void;
  disabled?: boolean;
  /** "row": kontrollnimekirja viimane rida (ChecklistRow), pluss linnukeste veerus ja nähtav silt. */
  layout?: "tile" | "row";
  label?: string;
}

export function AddTile({ placeholder, onAdd, disabled, layout = "tile", label }: AddTileProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const row = layout === "row";

  function commit() {
    const trimmed = value.trim();
    if (trimmed) onAdd(trimmed);
    setValue("");
    setEditing(false);
  }

  const plus = (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-dashed transition-colors duration-200 ${
        editing ? "border-accent/70 text-accent" : "border-muted/40 group-hover/add:border-accent/70"
      }`}
      aria-hidden
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
    </span>
  );

  if (editing) {
    const input = (
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
    );
    return row ? (
      <div className="flex items-center gap-3 rounded-xl border border-accent/50 bg-white/[0.04] px-3 py-2.5">
        {plus}
        {input}
      </div>
    ) : (
      <div className="flex min-h-[64px] flex-col justify-center gap-2 rounded-xl border border-accent/50 bg-white/[0.04] p-2.5">
        {input}
      </div>
    );
  }

  if (row) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group/add flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm leading-6 text-muted transition-colors duration-200 hover:bg-white/[0.04] hover:text-accent"
      >
        {plus}
        {label ?? placeholder}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 text-muted transition-colors duration-200 hover:border-accent/50 hover:text-accent"
      aria-label={placeholder}
    >
      <Plus className="h-4 w-4" aria-hidden />
    </button>
  );
}
