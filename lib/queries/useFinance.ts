import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFinanceClient } from "@/lib/supabase/financeClient";
import { getCurrentMonthRange } from "@/lib/date";

export interface FinanceCategory {
  id: string;
  name: string;
}

export function useFinanceCategories() {
  return useQuery({
    queryKey: ["finance-categories"],
    queryFn: async (): Promise<FinanceCategory[]> => {
      const { data, error } = await getFinanceClient().from("categories").select("id, name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFinanceIncomeCategories() {
  return useQuery({
    queryKey: ["finance-income-categories"],
    queryFn: async (): Promise<FinanceCategory[]> => {
      const { data, error } = await getFinanceClient().from("income_categories").select("id, name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount, description, category }: { amount: number; description: string; category: string }) => {
      const client = getFinanceClient();
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Pole FinanceTrackerisse sisse logitud");

      const { error } = await client
        .from("expenses")
        .insert({ amount, description, category, date: new Date().toISOString(), user_id: userId });

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance-balance"] }),
  });
}

export function useAddIncome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount, description, category }: { amount: number; description: string; category: string }) => {
      const client = getFinanceClient();
      const { data: sessionData } = await client.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Pole FinanceTrackerisse sisse logitud");

      const { error } = await client
        .from("incomes")
        .insert({ amount, description, category, date: new Date().toISOString(), user_id: userId });

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance-balance"] }),
  });
}

export interface FinanceBalance {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  bankBalance: number;
}

export function useFinanceBalance() {
  return useQuery({
    queryKey: ["finance-balance"],
    queryFn: async (): Promise<FinanceBalance> => {
      const client = getFinanceClient();
      const { start, end } = getCurrentMonthRange();
      const [monthExpenses, monthIncomes, bankConnections] = await Promise.all([
        client.from("expenses").select("amount").gte("date", start).lt("date", end),
        client.from("incomes").select("amount").gte("date", start).lt("date", end),
        // Enable Bankingust sünkitud saldo, mida FinanceTracker siin tabelis hoiab.
        client.from("bank_connections").select("balance"),
      ]);

      for (const res of [monthExpenses, monthIncomes, bankConnections]) {
        if (res.error) throw res.error;
      }

      const sum = (rows: { amount: number }[] | null) =>
        (rows ?? []).reduce((acc, row) => acc + row.amount, 0);

      const totalExpense = sum(monthExpenses.data);
      const totalIncome = sum(monthIncomes.data);

      return {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        bankBalance: (bankConnections.data ?? []).reduce(
          (acc, row) => acc + (row.balance ?? 0),
          0,
        ),
      };
    },
  });
}
