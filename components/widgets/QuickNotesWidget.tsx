"use client";

import { useEffect, useRef, useState } from "react";
import { StickyNote } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { useQuickNote, useSaveQuickNote } from "@/lib/queries/useQuickNotes";

const SAVE_DELAY = 800;

export function QuickNotesWidget() {
  const { data, isLoading, error } = useQuickNote();
  const { mutate: saveNote, error: saveError } = useSaveQuickNote();

  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Viimane salvestamata sisu, et tabi vahetamisel muudatused kaduma ei läheks.
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pendingRef.current !== null) saveNote(pendingRef.current);
    };
  }, [saveNote]);

  function scheduleSave(html: string) {
    setStatus("saving");
    pendingRef.current = html;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      pendingRef.current = null;
      saveNote(html, {
        onSuccess: () => setStatus("saved"),
        onError: () => setStatus("idle"),
      });
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
        <RichTextEditor content={data} onChange={scheduleSave} placeholder="Kirjuta oma märge siia..." />
      )}

      {saveError && <p className="mt-2 text-sm text-destructive">Salvestamine ebaõnnestus.</p>}
    </Card>
  );
}
