"use client";

import { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableWidgetProps {
  id: string;
  editMode: boolean;
  className: string;
  children: ReactNode;
}

export function SortableWidget({ id, editMode, className, children }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editMode,
  });

  return (
    <div
      ref={setNodeRef}
      {...(editMode ? attributes : {})}
      {...(editMode ? listeners : {})}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${className} ${editMode && !isDragging ? "jiggle" : ""} ${
        editMode ? "cursor-grab touch-none active:cursor-grabbing" : ""
      } ${isDragging ? "z-10 opacity-90" : ""}`}
    >
      {children}
    </div>
  );
}
