"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import {
  useAddExpense,
  useAddIncome,
  useFinanceBalance,
  useFinanceCategories,
  useFinanceIncomeCategories,
} from "@/lib/queries/useFinance";

type Tab = "expense" | "income" | "balance";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted/60 transition-colors duration-200 focus:border-accent focus:outline-none";

function ExpenseForm() {
  const { data: categories, isLoading: categoriesLoading } = useFinanceCategories();
  const addExpense = useAddExpense();

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (!amountNum || !description || !category) return;
    addExpense.mutate({ amount: amountNum, description, category });
    setAmount("");
    setDescription("");
    setCategory("");
  }

  if (categoriesLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        type="number"
        step="0.01"
        placeholder="Summa"
        className={fieldClass}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <input
        type="text"
        placeholder="Kirjeldus"
        className={fieldClass}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <select
        className={`${fieldClass} cursor-pointer`}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        <option value="">Vali kategooria</option>
        {categories?.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={addExpense.isPending} className="w-full">
        Lisa kulu
      </Button>
      {addExpense.error && <p className="text-sm text-destructive">Lisamine ebaõnnestus.</p>}
    </form>
  );
}

function IncomeForm() {
  const { data: categories, isLoading: categoriesLoading } = useFinanceIncomeCategories();
  const addIncome = useAddIncome();

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (!amountNum || !description || !category) return;
    addIncome.mutate({ amount: amountNum, description, category });
    setAmount("");
    setDescription("");
    setCategory("");
  }

  if (categoriesLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        type="number"
        step="0.01"
        placeholder="Summa"
        className={fieldClass}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <input
        type="text"
        placeholder="Kirjeldus"
        className={fieldClass}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <select
        className={`${fieldClass} cursor-pointer`}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        <option value="">Vali kategooria</option>
        {categories?.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={addIncome.isPending} className="w-full">
        Lisa tulu
      </Button>
      {addIncome.error && <p className="text-sm text-destructive">Lisamine ebaõnnestus.</p>}
    </form>
  );
}

function BalanceView() {
  const { data, isLoading, error } = useFinanceBalance();

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (error || !data) return <p className="text-sm text-destructive">Saldo laadimine ebaõnnestus.</p>;

  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-muted">See kuu</p>
      <p>
        Kogutulu:{" "}
        <span className="font-mono font-semibold text-foreground">{data.totalIncome.toFixed(2)} €</span>
      </p>
      <p>
        Kogukulu:{" "}
        <span className="font-mono font-semibold text-foreground">{data.totalExpense.toFixed(2)} €</span>
      </p>
      <p>
        Saldo:{" "}
        <span
          className={`font-mono font-semibold ${data.balance >= 0 ? "text-positive" : "text-destructive"}`}
        >
          {data.balance.toFixed(2)} €
        </span>
      </p>
    </div>
  );
}

export function FinanceWidget() {
  const [tab, setTab] = useState<Tab>("expense");

  return (
    <Card className="col-span-12 md:col-span-6 xl:col-span-4">
      <div className="mb-4 flex items-center justify-between">
        <WidgetTitle icon={Wallet}>Finance</WidgetTitle>
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

      {tab === "expense" ? <ExpenseForm /> : tab === "income" ? <IncomeForm /> : <BalanceView />}
    </Card>
  );
}
