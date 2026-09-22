"use client";

import { useState } from "react";
import { ListTodo, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { GalleryGrid } from "@/components/ui/GalleryGrid";
import { GalleryCard } from "@/components/ui/GalleryCard";
import { AddTile } from "@/components/ui/AddTile";
import { CelebrationOverlay } from "@/components/ui/CelebrationOverlay";
import { useAddTask, useDeleteTask, useTodayTasks, useUpdateTask, TodayTask } from "@/lib/queries/useTodayTasks";
import {
  useToggleProjectTask,
  useUpdateProjectTaskDueDate,
  useUpdateProjectTaskTitle,
} from "@/lib/queries/useProjects";
import { dailyScoreStatus, scoreBadge } from "@/lib/dailyScoreStatus";
import { useCelebrateOnComplete } from "@/lib/useCelebrateOnComplete";

export function TasksWidget() {
  const { data, isLoading, error } = useTodayTasks();
  const addTask = useAddTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const toggleProjectTask = useToggleProjectTask();
  const updateProjectTaskTitle = useUpdateProjectTaskTitle();
  const clearProjectTaskDueDate = useUpdateProjectTaskDueDate();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const mutationError =
    addTask.error ||
    updateTask.error ||
    deleteTask.error ||
    toggleProjectTask.error ||
    updateProjectTaskTitle.error ||
    clearProjectTaskDueDate.error;

  function startEdit(id: string, title: string) {
    setEditingId(id);
    setEditValue(title);
  }

  // Projekti-task on siin sama rida mis projektis, mitte koopia — linnuke ja
  // nimemuutus lähevad project_tasks'i, X aga ainult tühjendab kuupäeva.
  function toggle(task: TodayTask) {
    if (task.origin === "task") {
      updateTask.mutate({ id: task.id, done: !task.done });
    } else if (task.projectId) {
      toggleProjectTask.mutate({
        id: task.id,
        projectId: task.projectId,
        title: task.title,
        done: !task.done,
      });
    }
  }

  function commitEdit(task: TodayTask) {
    const title = editValue.trim();
    setEditingId(null);
    if (!title || title === task.title) return;

    if (task.origin === "task") {
      updateTask.mutate({ id: task.id, title });
    } else if (task.projectId) {
      updateProjectTaskTitle.mutate({ id: task.id, projectId: task.projectId, title });
    }
  }

  function remove(task: TodayTask) {
    if (task.origin === "task") {
      deleteTask.mutate({ id: task.id });
    } else if (task.projectId) {
      clearProjectTaskDueDate.mutate({ id: task.id, projectId: task.projectId, dueDate: null });
    }
  }

  const done = data?.filter((t) => t.done).length ?? 0;
  const total = data?.length ?? 0;
  const celebrating = useCelebrateOnComplete(done, total);

  return (
    <Card>
      <CelebrationOverlay active={celebrating} />
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={ListTodo} href="https://taskzen-phi.vercel.app/tasks">
          Today&apos;s Tasks
        </WidgetTitle>
        <span className="font-mono text-xs text-muted">{scoreBadge(done, total)}</span>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">Taskide laadimine ebaõnnestus.</p>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3 border-b border-border/40 pb-4">
            <ProgressRing done={done} total={total} size={96} strokeWidth={7} />
            <div>
              <p className="text-base font-semibold text-foreground">Daily score</p>
              <p className="text-xs text-muted">resets 00:00</p>
              <p className="mt-1.5 text-sm font-medium text-accent">{dailyScoreStatus(done, total)}</p>
            </div>
          </div>

          <GalleryGrid>
            {(data ?? []).map((task) => (
              <GalleryCard key={task.id} done={task.done}>
                <div className="flex items-start justify-between gap-1.5">
                  <CheckToggle
                    checked={task.done}
                    onChange={() => toggle(task)}
                    aria-label={task.done ? "Märgi tegemata" : "Märgi tehtud"}
                  />
                  <button
                    onClick={() => remove(task)}
                    className="cursor-pointer p-0.5 text-muted transition-colors duration-200 hover:text-destructive"
                    aria-label={task.origin === "task" ? "Kustuta" : "Eemalda tänasest"}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                {editingId === task.id ? (
                  <input
                    autoFocus
                    className="border-b border-border bg-transparent text-sm text-foreground outline-none focus:border-accent"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEdit(task)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit(task);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <span
                    onClick={() => startEdit(task.id, task.title)}
                    className={`line-clamp-2 cursor-text text-sm ${
                      task.done ? "font-semibold text-foreground" : "text-foreground"
                    }`}
                  >
                    {task.title}
                  </span>
                )}
              </GalleryCard>
            ))}
            <AddTile placeholder="Uus task..." onAdd={(title) => addTask.mutate({ title })} disabled={addTask.isPending} />
          </GalleryGrid>

          {mutationError && <p className="mt-2 text-sm text-destructive">Toiming ebaõnnestus.</p>}
        </>
      )}
    </Card>
  );
}
