"use client";

import { FormEvent, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LucideIcon,
  Landmark,
  Lock,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Unlock,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { SegmentedMeter } from "@/components/ui/SegmentedMeter";
import { useFinanceBalance } from "@/lib/queries/useFinance";

// Parooli kontrollib /api/finance-pin route server-only FINANCE_WIDGET_PIN env'i
// vastu — parool ei satu kliendi bundle'isse. Kui env puudub, lukku ei kuvata.
const UNLOCK_STORAGE_KEY = "finance-widget-unlocked";

const TONE_CLASS = {
  positive: "text-positive",
  destructive: "text-destructive",
  accent: "text-accent-bright",
} as const;

type Tone = keyof typeof TONE_CLASS;

function formatEuro(value: number): string {
  const abs = Math.abs(value).toFixed(2);
  return value < 0 ? `−€${abs}` : `€${abs}`;
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  valueTone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: Tone;
  valueTone?: Tone;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-4 w-4 shrink-0 ${TONE_CLASS[tone]}`} aria-hidden />
        <span className="truncate text-xs text-muted">{label}</span>
      </div>
      <p
        className={`mt-2 font-mono text-xl font-bold tabular-nums ${
          valueTone ? TONE_CLASS[valueTone] : "text-foreground"
        }`}
      >
        {formatEuro(value)}
      </p>
    </div>
  );
}

function MaskedTile({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: Tone }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-4 w-4 shrink-0 ${TONE_CLASS[tone]} opacity-50`} aria-hidden />
        <span className="truncate text-xs text-muted">{label}</span>
      </div>
      <p className="mt-2 font-mono text-xl font-bold tracking-wider text-muted/40">€••••</p>
    </div>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/finance-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });
      const json = await res.json();
      if (json.ok) {
        onUnlock();
      } else {
        setWrong(true);
        setValue("");
      }
    } catch {
      setWrong(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-border/60 bg-background/60 p-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <Lock className="h-4 w-4 text-muted" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Pangasaldo
          </span>
        </div>
        <p className="mt-2 font-mono text-5xl font-bold tracking-wider text-muted/40">€••••</p>
        <form onSubmit={handleSubmit} className="mt-5 flex w-full max-w-[240px] items-center gap-2">
          <input
            type="password"
            autoComplete="off"
            placeholder="Parool"
            aria-label="Parool"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-center text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-muted/60 focus:border-accent"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setWrong(false);
            }}
          />
          <Button type="submit" disabled={pending} className="shrink-0 px-3 py-2" aria-label="Ava">
            <Unlock className="h-4 w-4" aria-hidden />
          </Button>
        </form>
        <p className={`mt-2 h-4 text-xs ${wrong ? "text-destructive" : "text-transparent"}`}>
          Vale parool.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MaskedTile icon={TrendingUp} label="Tulud" tone="positive" />
        <MaskedTile icon={TrendingDown} label="Kulud" tone="destructive" />
        <MaskedTile icon={PiggyBank} label="Saldo" tone="positive" />
      </div>

      <div>
        <SegmentedMeter segments={[{ value: 1, color: "var(--surface-hover)" }]} />
        <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wide text-muted/60">
          <span>tulud €••••</span>
          <span>kulud €••••</span>
        </div>
      </div>
    </div>
  );
}

function FinanceStats() {
  const { data, isLoading, error } = useFinanceBalance();

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (error || !data)
    return <p className="text-sm text-destructive">Saldo laadimine ebaõnnestus.</p>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-accent/30 bg-background/60 p-4 text-center shadow-[0_0_16px_-4px_var(--accent)]">
        <div className="flex items-center justify-center gap-2">
          <Landmark className="h-4 w-4 text-accent-bright" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Pangasaldo
          </span>
        </div>
        <p className="mt-2 font-mono text-5xl font-bold tabular-nums text-foreground">
          {formatEuro(data.bankBalance)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile icon={TrendingUp} label="Tulud" value={data.totalIncome} tone="positive" />
        <StatTile icon={TrendingDown} label="Kulud" value={data.totalExpense} tone="destructive" />
        <StatTile
          icon={PiggyBank}
          label="Saldo"
          value={data.balance}
          tone={data.balance >= 0 ? "positive" : "destructive"}
          valueTone={data.balance >= 0 ? "positive" : "destructive"}
        />
      </div>

      <div>
        <SegmentedMeter
          segments={[
            { value: data.totalIncome, color: "var(--positive)" },
            { value: data.totalExpense, color: "var(--destructive)" },
          ]}
        />
        <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wide text-muted">
          <span>tulud {formatEuro(data.totalIncome)}</span>
          <span>kulud {formatEuro(data.totalExpense)}</span>
        </div>
      </div>
    </div>
  );
}

export function FinanceWidget() {
  const [unlocked, setUnlocked] = useState(false);

  const { data: pinStatus } = useQuery({
    queryKey: ["finance-pin-status"],
    queryFn: async (): Promise<{ enabled: boolean }> => {
      const res = await fetch("/api/finance-pin");
      if (!res.ok) throw new Error("PIN-oleku päring ebaõnnestus");
      return res.json();
    },
    staleTime: Infinity,
  });
  // Kuni serveri vastust pole, eelda et lukk on peal (privaatsus enne mugavust).
  const pinEnabled = pinStatus?.enabled ?? true;

  useEffect(() => {
    try {
      if (sessionStorage.getItem(UNLOCK_STORAGE_KEY) === "1") setUnlocked(true);
    } catch {
      // sessionStorage pole saadaval — jääb lukku
    }
  }, []);

  function unlock() {
    setUnlocked(true);
    try {
      sessionStorage.setItem(UNLOCK_STORAGE_KEY, "1");
    } catch {
      // ignoreeri — lukk avaneb selle lehe eluajaks
    }
  }

  function lock() {
    setUnlocked(false);
    try {
      sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
    } catch {
      // ignoreeri
    }
  }

  const monthName = new Date().toLocaleDateString("et-EE", { month: "long" });

  return (
    <Card>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={Wallet} href="https://finance-tracker-sooty-five-85.vercel.app">
          Finance
        </WidgetTitle>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted">
            {monthName}
          </span>
          {pinEnabled && unlocked && (
            <button
              type="button"
              onClick={lock}
              className="cursor-pointer p-0.5 text-muted transition-colors duration-200 hover:text-foreground"
              aria-label="Lukusta"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {unlocked || !pinEnabled ? <FinanceStats /> : <LockScreen onUnlock={unlock} />}
    </Card>
  );
}
