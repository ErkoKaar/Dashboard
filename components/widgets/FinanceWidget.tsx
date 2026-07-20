"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { Readout } from "@/components/ui/Readout";
import { SegmentedMeter } from "@/components/ui/SegmentedMeter";
import {
  FinanceCategory,
  useAddExpense,
  useAddIncome,
  useFinanceBalance,
  useFinanceCategories,
  useFinanceIncomeCategories,
} from "@/lib/queries/useFinance";

type Tab = "expense" | "income" | "balance";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted/60 transition-colors duration-200 focus:border-accent focus:outline-none";

function TransactionForm({
  categories,
  categoriesLoading,
  onSubmit,
  submitLabel,
  isPending,
  hasError,
}: {
  categories: FinanceCategory[] | undefined;
  categoriesLoading: boolean;
  onSubmit: (data: { amount: number; description: string; category: string }) => void;
  submitLabel: string;
  isPending: boolean;
  hasError: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (!amountNum || !description || !category) return;
    onSubmit({ amount: amountNum, description, category });
    setAmount("");
    setDescription("");
    setCategory("");
  }

  if (categoriesLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-lg text-muted">
          €
        </span>
        <input
          type="number"
          step="0.01"
          placeholder="0.00"
          className="w-full rounded-lg border border-border bg-background py-3 pl-8 pr-3 font-mono text-2xl font-semibold text-foreground placeholder:text-muted/40 transition-colors duration-200 focus:border-accent focus:outline-none"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <input
        type="text"
        placeholder="Kirjeldus"
        className={fieldClass}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        {categories?.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.name)}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors duration-200 ${
              category === c.name
                ? "border-accent bg-accent font-semibold text-background"
                : "border-border text-muted hover:border-muted hover:text-foreground"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <Button type="submit" disabled={isPending} className="w-full">
        {submitLabel}
      </Button>
      {hasError && <p className="text-sm text-destructive">Lisamine ebaõnnestus.</p>}
    </form>
  );
}

function ExpenseForm() {
  const { data: categories, isLoading: categoriesLoading } = useFinanceCategories();
  const addExpense = useAddExpense();

  return (
    <TransactionForm
      categories={categories}
      categoriesLoading={categoriesLoading}
      onSubmit={(data) => addExpense.mutate(data)}
      submitLabel="Lisa kulu"
      isPending={addExpense.isPending}
      hasError={!!addExpense.error}
    />
  );
}

function IncomeForm() {
  const { data: categories, isLoading: categoriesLoading } = useFinanceIncomeCategories();
  const addIncome = useAddIncome();

  return (
    <TransactionForm
      categories={categories}
      categoriesLoading={categoriesLoading}
      onSubmit={(data) => addIncome.mutate(data)}
      submitLabel="Lisa tulu"
      isPending={addIncome.isPending}
      hasError={!!addIncome.error}
    />
  );
}

function BalanceView() {
  const { data, isLoading, error } = useFinanceBalance();

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (error || !data) return <p className="text-sm text-destructive">Saldo laadimine ebaõnnestus.</p>;

  return (
    <div className="space-y-4 text-center">
      <div className="flex flex-col items-center">
        <Readout
          value={data.balance}
          label="Saldo see kuu"
          tone={data.balance >= 0 ? "positive" : "destructive"}
          size="lg"
          format={(n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)} €`}
        />
      </div>

      <div className="flex justify-center gap-8">
        <div>
          <p className="font-mono text-lg font-semibold tabular-nums text-positive">
            {data.totalIncome.toFixed(2)} €
          </p>
          <p className="text-xs text-muted">tulu</p>
        </div>
        <div>
          <p className="font-mono text-lg font-semibold tabular-nums text-destructive">
            {data.totalExpense.toFixed(2)} €
          </p>
          <p className="text-xs text-muted">kulu</p>
        </div>
      </div>

      <SegmentedMeter
        segments={[
          { value: data.totalIncome, color: "var(--positive)" },
          { value: data.totalExpense, color: "var(--destructive)" },
        ]}
      />
    </div>
  );
}

export function FinanceWidget() {
  const [tab, setTab] = useState<Tab>("expense");

  return (
    <Card>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={Wallet} href="https://isiklikfinancetracker.netlify.app">
          Finance
        </WidgetTitle>
        <div className="flex gap-1">
          <TabButton active={tab === "expense"} onClick={() => setTab("expense")}>
            Lisa kulu
          </TabButton>
          <TabButton active={tab === "income"} onClick={() => setTab("income")}>
            Lisa tulu
          </TabButton>
          <TabButton active={tab === "balance"} onClick={() => setTab("balance")}>
            Saldo
          </TabButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "expense" ? <ExpenseForm /> : tab === "income" ? <IncomeForm /> : <BalanceView />}
      </div>
    </Card>
  );
}
