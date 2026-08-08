"use client";

import { InputHTMLAttributes, useId } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ label, type, className = "", ...props }: InputProps) {
  const id = useId();

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-muted"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground placeholder:text-muted/60 transition-colors duration-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        {...props}
      />
    </div>
  );
}
