"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/providers/AuthProvider";
import logo from "@/app/images/logo-1a-tume.jpg";

export function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [taskPassword, setTaskPassword] = useState("");
  const [financePassword, setFinancePassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await signIn(email, taskPassword, financePassword);
    setSubmitting(false);
    if (error) setError(error);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8">
        <div className="mb-6 flex flex-col items-center">
          <Image
            src={logo}
            alt="Dashboardi logo"
            width={64}
            height={64}
            priority
            className="rounded-2xl"
          />
          <h1 className="mt-4 text-xl font-semibold">Logi sisse</h1>
          <p className="mt-1 text-sm text-muted">
            Sisesta oma kontode andmed
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="TaskManager parool"
            type="password"
            autoComplete="current-password"
            value={taskPassword}
            onChange={(e) => setTaskPassword(e.target.value)}
            required
          />
          <Input
            label="FinanceTracker parool"
            type="password"
            autoComplete="current-password"
            value={financePassword}
            onChange={(e) => setFinancePassword(e.target.value)}
            required
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={submitting} className="h-11 w-full">
            {submitting && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            )}
            {submitting ? "Sisselogimine..." : "Logi sisse"}
          </Button>
        </form>
      </div>
    </main>
  );
}
