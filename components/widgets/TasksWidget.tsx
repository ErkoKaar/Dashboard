"use client";

import { useState } from "react";
import { ListTodo, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { ProgressRing } from "@/components/ui/ProgressRing";
import {
  ChecklistRow,
  ChecklistRowAction,
  ChecklistRowEditor,
  checklistTextClass,
} from "@/components/ui/ChecklistRow";
import { AddTile } from "@/components/ui/AddTile";
import { CelebrationOverlay } from "@/components/ui/CelebrationOverlay";
import {
  useAddTask,
  useDeleteTask,
  useToggleCalendarTask,
  useTodayTasks,
  useUpdateTask,
  TodayTask,
} from "@/lib/queries/useTodayTasks";
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
  const toggleCalendarTask = useToggleCalendarTask();
  const toggleProjectTask = useToggleProjectTask();
  const updateProjectTaskTitle = useUpdateProjectTaskTitle();
  const clearProjectTaskDueDate = useUpdateProjectTaskDueDate();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const mutationError =
    addTask.error ||
    updateTask.error ||
    deleteTask.error ||
    toggleCalendarTask.error ||
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
    } else if (task.origin === "calendar") {
      toggleCalendarTask.mutate({ eventId: task.id, title: task.title, done: !task.done });
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

          <ul className="flex flex-col gap-1">
            {(data ?? []).map((task) => {
              // Kalendri-taski kustutamine ja muutmine käib Google Calendaris.
              const editable = task.origin !== "calendar";
              const editing = editingId === task.id;
              return (
                <li key={task.id}>
                  <ChecklistRow
                    done={task.done}
                    active={editing}
                    leading={
                      <CheckToggle
                        checked={task.done}
                        onChange={() => toggle(task)}
                        aria-label={task.done ? "Märgi tegemata" : "Märgi tehtud"}
                      />
                    }
                    trailing={
                      editable &&
                      !editing && (
                        <ChecklistRowAction
                          label={task.origin === "task" ? "Kustuta" : "Eemalda tänasest"}
                          onClick={() => remove(task)}
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </ChecklistRowAction>
                      )
                    }
                  >
                    {editing ? (
                      <ChecklistRowEditor
                        value={editValue}
                        onChange={setEditValue}
                        onCommit={() => commitEdit(task)}
                        onCancel={() => setEditingId(null)}
                        aria-label="Taski nimi"
                      />
                    ) : editable ? (
                      <button
                        type="button"
                        onClick={() => startEdit(task.id, task.title)}
                        title="Muuda"
                        className={`w-full cursor-text text-left ${checklistTextClass(task.done)}`}
                      >
                        {task.title}
                      </button>
                    ) : (
                      <span className={checklistTextClass(task.done)}>{task.title}</span>
                    )}
                  </ChecklistRow>
                </li>
              );
            })}
            <li>
              <AddTile
                layout="row"
                label="Uus task"
                placeholder="Uus task..."
                onAdd={(title) => addTask.mutate({ title })}
                disabled={addTask.isPending}
              />
            </li>
          </ul>

          {mutationError && <p className="mt-2 text-sm text-destructive">Toiming ebaõnnestus.</p>}
        </>
      )}
    </Card>
  );
}
