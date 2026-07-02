"use client";

import { InputHTMLAttributes, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ label, type, className = "", ...props }: InputProps) {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword && showPassword ? "text" : type;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-muted"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={resolvedType}
          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground placeholder:text-muted/60 transition-colors duration-200 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Peida parool" : "Näita parooli"}
            className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-muted transition-colors duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
