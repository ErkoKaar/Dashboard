"use client";

import { useEffect, useRef, useState } from "react";
import { StickyNote } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { useQuickNote, useSaveQuickNote } from "@/lib/queries/useQuickNotes";

const SAVE_DELAY = 800;

export function QuickNotesWidget() {
  const { data, isLoading, error } = useQuickNote();
  const saveNote = useSaveQuickNote();

  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const hasLoaded = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasLoaded.current && data !== undefined) {
      setValue(data);
      hasLoaded.current = true;
    }
  }, [data]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setValue(next);
    setStatus("saving");

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      saveNote.mutate(next, { onSuccess: () => setStatus("saved") });
    }, SAVE_DELAY);
  }

  return (
    <Card>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={StickyNote}>Quick Notes</WidgetTitle>
        <span className="font-mono text-xs text-muted">
          {status === "saving" ? "salvestamine..." : status === "saved" ? "salvestatud" : ""}
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="h-full min-h-[440px] w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">Märkmete laadimine ebaõnnestus.</p>
      ) : (
        <textarea
          value={value}
          onChange={handleChange}
          placeholder="Kirjuta oma märge siia..."
          className="min-h-[440px] w-full flex-1 resize-none rounded-lg border border-border/50 bg-background px-4 py-3 text-lg leading-relaxed text-foreground placeholder:text-muted/60 outline-none transition-colors duration-200 focus:border-accent"
        />
      )}

      {saveNote.error && <p className="mt-2 text-sm text-destructive">Salvestamine ebaõnnestus.</p>}
    </Card>
  );
}
