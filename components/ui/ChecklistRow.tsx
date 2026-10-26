"use client";

import { ReactNode, useEffect, useLayoutEffect, useRef } from "react";

// Kontrollnimekirja rida (Today's Tasks, Habits): linnuke vasakul esimese rea kõrgusel, tekst murdub
// nii mitmele reale kui vaja. Rea kõrgus tuleb tekstist, mitte ruudustikust, nii et midagi ei lõigata.

/** Rea tekst: leading-6 = linnukese kõrgus; anywhere murrab ka tühikuta pika sõna. */
export function checklistTextClass(done: boolean): string {
  return `block text-sm leading-6 text-foreground [overflow-wrap:anywhere] ${done ? "font-semibold" : ""}`;
}

interface ChecklistRowProps {
  done: boolean;
  /** Muutmisel esile tõstetud, valmis tooni asemel. */
  active?: boolean;
  leading: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChecklistRow({ done, active, leading, trailing, children, className = "" }: ChecklistRowProps) {
  const tone = active
    ? "border-accent/60 bg-white/[0.06]"
    : done
      ? "border-accent/45 bg-accent/[0.13] shadow-[0_8px_24px_-16px_var(--accent)]"
      : "border-transparent bg-white/[0.025] hover:bg-white/[0.055]";
  return (
    <div
      className={`group/row tile-enter relative flex items-start gap-3 rounded-xl border px-3 py-2.5 ${tone} ${className}`}
    >
      <span className="flex h-6 shrink-0 items-center">{leading}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {trailing && <span className="flex h-6 shrink-0 items-center gap-1.5">{trailing}</span>}
    </div>
  );
}

/**
 * Rea tegevusnupp (nt X). Hiirega näha rea kohal või fookuses, puuteekraanil kogu aeg, sest seal
 * pole hoverit (puude võltshover ei peida seda). 36 px ala, aga rea kõrgust ei kasvata (-my).
 */
export function ChecklistRowAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="-my-1.5 -mr-1.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted transition-[opacity,color,background-color] duration-150 ease-[ease] hover:bg-white/[0.06] hover:text-destructive focus-visible:opacity-100 group-focus-within/row:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover/row:opacity-100"
    >
      {children}
    </button>
  );
}

interface ChecklistRowEditorProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  "aria-label": string;
}

/** Rea sees muutmine: lahter kasvab koos tekstiga, Enter salvestab, Escape loobub. */
export function ChecklistRowEditor({ value, onChange, onCommit, onCancel, ...props }: ChecklistRowEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // Kursor teksti lõppu: pikka kirjet muudetakse enamasti lõpust.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onCommit();
        }
        if (e.key === "Escape") onCancel();
      }}
      className="block w-full resize-none overflow-hidden bg-transparent text-sm leading-6 text-foreground outline-none [overflow-wrap:anywhere]"
      {...props}
    />
  );
}
