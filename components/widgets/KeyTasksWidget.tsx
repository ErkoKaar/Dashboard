"use client";

import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { GalleryGrid } from "@/components/ui/GalleryGrid";
import { GalleryCard } from "@/components/ui/GalleryCard";
import { useKeyTasks, useToggleProjectTask } from "@/lib/queries/useProjects";
import { scoreBadge } from "@/lib/dailyScoreStatus";

export function KeyTasksWidget() {
  const { data, isLoading, error } = useKeyTasks();
  const toggleTask = useToggleProjectTask();

  const done = data?.filter((t) => t.completed_at !== null).length ?? 0;
  const total = data?.length ?? 0;

  return (
    <Card>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={AlertTriangle} href="https://taskzen-phi.vercel.app/tasks/projects">
          Key Tasks
        </WidgetTitle>
        {total > 0 && <span className="font-mono text-xs text-muted">{scoreBadge(done, total)}</span>}
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">Kriitiliste taskide laadimine ebaõnnestus.</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted">Kriitilisi taske pole.</p>
      ) : (
        <GalleryGrid>
          {data.map((task) => {
            const taskDone = task.completed_at !== null;
            return (
              <GalleryCard key={task.id} done={taskDone}>
                <CheckToggle
                  checked={taskDone}
                  onChange={() =>
                    toggleTask.mutate({
                      id: task.id,
                      projectId: task.project_id,
                      title: task.title,
                      done: !taskDone,
                    })
                  }
                  aria-label={taskDone ? "Märgi tegemata" : "Märgi tehtud"}
                />
                <span
                  className={`line-clamp-2 text-sm ${
                    taskDone ? "font-semibold text-foreground" : "text-foreground"
                  }`}
                >
                  {task.title}
                </span>
                <span className="truncate text-[10px] uppercase tracking-wide text-muted">
                  {task.projectTitle}
                </span>
              </GalleryCard>
            );
          })}
        </GalleryGrid>
      )}
    </Card>
  );
}
