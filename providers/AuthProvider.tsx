"use client";

import { Session } from "@supabase/supabase-js";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { getTasksClient } from "@/lib/supabase/tasksClient";
import { getFinanceClient } from "@/lib/supabase/financeClient";

interface AuthContextValue {
  taskSession: Session | null;
  financeSession: Session | null;
  loading: boolean;
  signIn: (email: string, taskPassword: string, financePassword: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [taskSession, setTaskSession] = useState<Session | null>(null);
  const [financeSession, setFinanceSession] = useState<Session | null>(null);
  const [taskLoaded, setTaskLoaded] = useState(false);
  const [financeLoaded, setFinanceLoaded] = useState(false);

  useEffect(() => {
    const taskClient = getTasksClient();
    const financeClient = getFinanceClient();

    taskClient.auth.getSession().then(({ data }) => {
      setTaskSession(data.session);
      setTaskLoaded(true);
    });
    financeClient.auth.getSession().then(({ data }) => {
      setFinanceSession(data.session);
      setFinanceLoaded(true);
    });

    const { data: taskListener } = taskClient.auth.onAuthStateChange((_event, newSession) => {
      setTaskSession(newSession);
    });
    const { data: financeListener } = financeClient.auth.onAuthStateChange((_event, newSession) => {
      setFinanceSession(newSession);
    });

    return () => {
      taskListener.subscription.unsubscribe();
      financeListener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, taskPassword: string, financePassword: string) {
    const [taskResult, financeResult] = await Promise.all([
      getTasksClient().auth.signInWithPassword({ email, password: taskPassword }),
      getFinanceClient().auth.signInWithPassword({ email, password: financePassword }),
    ]);

    return { error: taskResult.error?.message ?? financeResult.error?.message ?? null };
  }

  async function signOut() {
    await Promise.all([getTasksClient().auth.signOut(), getFinanceClient().auth.signOut()]);
  }

  return (
    <AuthContext.Provider
      value={{ taskSession, financeSession, loading: !taskLoaded || !financeLoaded, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
