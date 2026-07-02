"use client";

import { useState } from "react";
import { ListTodo, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { WeeklyChart } from "@/components/ui/WeeklyChart";
import { useAddTask, useDeleteTask, useTodayTasks, useUpdateTask } from "@/lib/queries/useTodayTasks";
import { useWeeklyTaskStats } from "@/lib/queries/useWeeklyTaskStats";

export function TasksWidget() {
  const [view, setView] = useState<"today" | "week">("today");

  const { data, isLoading, error } = useTodayTasks();
  const addTask = useAddTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const weekly = useWeeklyTaskStats();

  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const mutationError = addTask.error || updateTask.error || deleteTask.error;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    addTask.mutate({ title });
    setNewTitle("");
  }

  function startEdit(id: string, title: string) {
    setEditingId(id);
    setEditValue(title);
  }

  function commitEdit(id: string) {
    const title = editValue.trim();
    if (title) updateTask.mutate({ id, title });
    setEditingId(null);
  }

  return (
    <Card className="col-span-12 md:col-span-6 xl:col-span-4">
      <div className="mb-4 flex items-center justify-between">
        <WidgetTitle icon={ListTodo}>Today&apos;s Tasks</WidgetTitle>
        <div className="flex gap-1">
          <TabButton active={view === "today"} onClick={() => setView("today")}>
            Täna
          </TabButton>
          <TabButton active={view === "week"} onClick={() => setView("week")}>
            See nädal
          </TabButton>
        </div>
      </div>

      {view === "week" ? (
        weekly.isLoading || !weekly.data ? (
          <Skeleton className="h-32 w-full" />
        ) : weekly.error ? (
          <p className="text-sm text-destructive">Statistika laadimine ebaõnnestus.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted">
              Sel nädalal tehtud:{" "}
              <span className="font-mono font-semibold text-foreground">{weekly.data.totalDone}</span>
            </p>
            <WeeklyChart daily={weekly.data.daily} />
          </>
        )
      ) : isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">Taskide laadimine ebaõnnestus.</p>
      ) : (
        <>
          {!data || data.length === 0 ? (
            <p className="text-sm text-muted">Täna tasksid pole.</p>
          ) : (
            <ul className="space-y-2">
              {data.map((task) => (
                <li key={task.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => updateTask.mutate({ id: task.id, done: !task.done })}
                    className="h-4 w-4 cursor-pointer accent-accent"
                  />
                  {editingId === task.id ? (
                    <input
                      autoFocus
                      className="flex-1 border-b border-border bg-transparent text-sm text-foreground outline-none focus:border-accent"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(task.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit(task.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                  ) : (
                    <span
                      onClick={() => startEdit(task.id, task.title)}
                      className={`flex-1 cursor-text text-sm ${task.done ? "text-muted line-through" : "text-foreground"}`}
                    >
                      {task.title}
                    </span>
                  )}
                  <button
                    onClick={() => deleteTask.mutate({ id: task.id })}
                    className="cursor-pointer p-1 text-muted transition-colors duration-200 hover:text-destructive"
                    aria-label="Kustuta"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAdd} className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted/60 transition-colors duration-200 focus:border-accent focus:outline-none"
              placeholder="Uus task..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Button type="submit" disabled={addTask.isPending}>
              Lisa
            </Button>
          </form>

          {mutationError && <p className="mt-2 text-sm text-destructive">Toiming ebaõnnestus.</p>}
        </>
      )}
    </Card>
  );
}
