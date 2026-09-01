"use client";

import { useEffect, useState } from "react";
import { FolderKanban, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { GalleryGrid } from "@/components/ui/GalleryGrid";
import { GalleryCard } from "@/components/ui/GalleryCard";
import { AddTile } from "@/components/ui/AddTile";
import { Dropdown, DropdownOption } from "@/components/ui/Dropdown";
import {
  Criticality,
  KeyTask,
  Project,
  ProjectSection,
  ProjectTask,
  useAddProjectTask,
  useDeleteProjectTask,
  useKeyTasks,
  useProjectTasks,
  useProjects,
  useToggleProjectTask,
  useUpdateProjectCriticality,
  useUpdateProjectTaskCriticality,
} from "@/lib/queries/useProjects";
import { scoreBadge } from "@/lib/dailyScoreStatus";
import { useCelebrateOnComplete } from "@/lib/useCelebrateOnComplete";
import { CelebrationOverlay } from "@/components/ui/CelebrationOverlay";

const KEY_TASKS_ID = "__key_tasks__";

const CRITICALITY_ORDER: Criticality[] = ["on_track", "warning", "critical"];
const CRITICALITY_CLASS: Record<Criticality, string> = {
  on_track: "bg-positive",
  warning: "bg-warning",
  critical: "bg-destructive",
};

function nextCriticality(current: Criticality): Criticality {
  const i = CRITICALITY_ORDER.indexOf(current);
  return CRITICALITY_ORDER[(i + 1) % CRITICALITY_ORDER.length];
}

function CriticalityDot({ criticality, onClick }: { criticality: Criticality; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-2.5 w-2.5 shrink-0 cursor-pointer rounded-full ${CRITICALITY_CLASS[criticality]}`}
      aria-label={`Kriitilisus: ${criticality} (klõpsa muutmiseks)`}
    />
  );
}

function ProjectDetail({
  project,
  options,
  onSelect,
  tasks,
}: {
  project: Project;
  options: DropdownOption[];
  onSelect: (id: string) => void;
  tasks: { data?: ProjectTask[]; isLoading: boolean; error: Error | null };
}) {
  const addTask = useAddProjectTask();
  const toggleTask = useToggleProjectTask();
  const deleteTask = useDeleteProjectTask();
  const updateTaskCriticality = useUpdateProjectTaskCriticality();
  const updateProjectCriticality = useUpdateProjectCriticality();

  const done = tasks.data?.filter((t) => t.completed_at !== null).length ?? 0;
  const total = tasks.data?.length ?? 0;

  return (
    <>
      <div className="my-4 flex items-center gap-3 border-b border-border/40 pb-4">
        <ProgressRing done={done} total={total} size={96} strokeWidth={7} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CriticalityDot
              criticality={project.criticality}
              onClick={() =>
                updateProjectCriticality.mutate({
                  id: project.id,
                  criticality: nextCriticality(project.criticality),
                })
              }
            />
            <Dropdown className="flex-1" options={options} value={project.id} onChange={onSelect} />
          </div>
          <p className="mt-1.5 text-xs text-muted">{total} subtasks</p>
        </div>
      </div>

      {tasks.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : tasks.error ? (
        <p className="text-xs text-destructive">Alamtaskide laadimine ebaõnnestus.</p>
      ) : (
        <GalleryGrid>
          {(tasks.data ?? []).map((task) => {
            const taskDone = task.completed_at !== null;
            return (
              <GalleryCard key={task.id} done={taskDone}>
                <div className="flex items-start justify-between gap-1.5">
                  <CheckToggle
                    checked={taskDone}
                    onChange={() =>
                      toggleTask.mutate({
                        id: task.id,
                        projectId: project.id,
                        title: task.title,
                        done: !taskDone,
                      })
                    }
                    aria-label={taskDone ? "Märgi tegemata" : "Märgi tehtud"}
                  />
                  <div className="flex items-center gap-1.5">
                    <CriticalityDot
                      criticality={task.criticality}
                      onClick={() =>
                        updateTaskCriticality.mutate({
                          id: task.id,
                          projectId: project.id,
                          criticality: nextCriticality(task.criticality),
                        })
                      }
                    />
                    <button
                      onClick={() => deleteTask.mutate({ id: task.id, projectId: project.id })}
                      className="cursor-pointer p-0.5 text-muted transition-colors duration-200 hover:text-destructive"
                      aria-label="Kustuta alamtask"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
                <span
                  className={`line-clamp-2 text-sm ${
                    taskDone ? "font-semibold text-foreground" : "text-foreground"
                  }`}
                >
                  {task.title}
                </span>
              </GalleryCard>
            );
          })}
          <AddTile
            placeholder="Uus alamtask..."
            onAdd={(title) => addTask.mutate({ projectId: project.id, title })}
            disabled={addTask.isPending}
          />
        </GalleryGrid>
      )}
    </>
  );
}

function KeyTasksPanel({
  options,
  onSelect,
  tasks,
}: {
  options: DropdownOption[];
  onSelect: (id: string) => void;
  tasks: { data?: KeyTask[]; isLoading: boolean; error: Error | null };
}) {
  const toggleTask = useToggleProjectTask();

  const done = tasks.data?.filter((t) => t.completed_at !== null).length ?? 0;
  const total = tasks.data?.length ?? 0;

  return (
    <>
      <div className="my-4 flex items-center gap-3 border-b border-border/40 pb-4">
        <ProgressRing done={done} total={total} size={96} strokeWidth={7} />
        <div className="min-w-0 flex-1">
          <Dropdown options={options} value={KEY_TASKS_ID} onChange={onSelect} />
          <p className="mt-1.5 text-xs text-muted">{total} subtasks</p>
        </div>
      </div>

      {tasks.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : tasks.error ? (
        <p className="text-xs text-destructive">Kriitiliste taskide laadimine ebaõnnestus.</p>
      ) : total === 0 ? (
        <p className="py-2 text-sm text-muted">Kriitilisi taske pole.</p>
      ) : (
        <GalleryGrid>
          {(tasks.data ?? []).map((task) => {
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
    </>
  );
}

interface ProjectsWidgetProps {
  section?: ProjectSection;
  title?: string;
}

export function ProjectsWidget({ section = "personal", title = "Personal Projects" }: ProjectsWidgetProps) {
  const showKeyTasks = section === "personal";
  const [selectedId, setSelectedId] = useState<string | null>(showKeyTasks ? KEY_TASKS_ID : null);
  const { data, isLoading, error } = useProjects();
  const keyTasks = useKeyTasks(section, showKeyTasks);

  const projects = (data ?? []).filter((p) => p.section === section);

  useEffect(() => {
    if (selectedId === KEY_TASKS_ID) return;
    if (projects.length === 0) {
      if (selectedId !== null) setSelectedId(null);
    } else if (!projects.some((p) => p.id === selectedId)) {
      setSelectedId(projects[0].id);
    }
  }, [projects, selectedId]);

  const isKeyTasks = selectedId === KEY_TASKS_ID;
  const selected = isKeyTasks ? null : (projects.find((p) => p.id === selectedId) ?? null);
  const tasks = useProjectTasks(selected?.id ?? "", !!selected);

  const options: DropdownOption[] = [
    ...(showKeyTasks
      ? [
          {
            id: KEY_TASKS_ID,
            label: "Key Tasks",
            count: keyTasks.data?.filter((t) => t.completed_at === null).length,
          },
        ]
      : []),
    ...projects.map((p) => ({ id: p.id, label: p.title, count: p.taskCount })),
  ];

  const activeTasks = isKeyTasks ? keyTasks.data : tasks.data;
  const done = activeTasks?.filter((t) => t.completed_at !== null).length ?? 0;
  const total = activeTasks?.length ?? 0;
  const celebrating = useCelebrateOnComplete(done, total, selectedId ?? "");

  return (
    <Card>
      <CelebrationOverlay active={celebrating} />
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={FolderKanban} href="https://taskzen-phi.vercel.app/tasks/projects">
          {title}
        </WidgetTitle>
        {(selected || isKeyTasks) && (
          <span className="font-mono text-xs text-muted">{scoreBadge(done, total)}</span>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">Projektide laadimine ebaõnnestus.</p>
      ) : projects.length === 0 ? (
        <p className="py-2 text-sm text-muted">Projekte pole.</p>
      ) : isKeyTasks ? (
        <KeyTasksPanel options={options} onSelect={setSelectedId} tasks={keyTasks} />
      ) : (
        selected && (
          <ProjectDetail
            key={selected.id}
            project={selected}
            options={options}
            onSelect={setSelectedId}
            tasks={tasks}
          />
        )
      )}
    </Card>
  );
}
