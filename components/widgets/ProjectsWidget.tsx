"use client";

import { useState } from "react";
import { Check, ChevronDown, FolderKanban, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import {
  Criticality,
  Project,
  ProjectSection,
  useAddProject,
  useAddProjectTask,
  useCompleteProject,
  useCompleteProjectTask,
  useDeleteProject,
  useDeleteProjectTask,
  useProjectTasks,
  useProjects,
  useUpdateProjectCriticality,
  useUpdateProjectTaskCriticality,
} from "@/lib/queries/useProjects";

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

function ProjectRow({
  project,
  isOpen,
  onToggle,
}: {
  project: Project;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const tasks = useProjectTasks(project.id, isOpen);
  const addTask = useAddProjectTask();
  const completeTask = useCompleteProjectTask();
  const deleteTask = useDeleteProjectTask();
  const updateTaskCriticality = useUpdateProjectTaskCriticality();
  const updateProjectCriticality = useUpdateProjectCriticality();
  const completeProject = useCompleteProject();
  const deleteProject = useDeleteProject();

  const [newTaskTitle, setNewTaskTitle] = useState("");

  function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;
    addTask.mutate({ projectId: project.id, title });
    setNewTaskTitle("");
  }

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 py-2.5">
        <CriticalityDot
          criticality={project.criticality}
          onClick={() =>
            updateProjectCriticality.mutate({
              id: project.id,
              criticality: nextCriticality(project.criticality),
            })
          }
        />
        <button
          onClick={onToggle}
          className="flex flex-1 cursor-pointer items-center justify-between gap-2 text-left"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm text-foreground">{project.title}</span>
            {project.taskCount > 0 && (
              <span className="shrink-0 font-mono text-xs text-muted">{project.taskCount}</span>
            )}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>
        <button
          onClick={() => completeProject.mutate({ id: project.id })}
          className="cursor-pointer p-1 text-muted transition-colors duration-200 hover:text-positive"
          aria-label="Lõpeta projekt"
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          onClick={() => deleteProject.mutate({ id: project.id })}
          className="cursor-pointer p-1 text-muted transition-colors duration-200 hover:text-destructive"
          aria-label="Kustuta projekt"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {isOpen && (
        <div className="mb-3 ml-4 space-y-2">
          {tasks.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : tasks.error ? (
            <p className="text-xs text-destructive">Alamtaskide laadimine ebaõnnestus.</p>
          ) : tasks.data && tasks.data.length > 0 ? (
            <ul className="space-y-1.5">
              {tasks.data.map((task) => (
                <li key={task.id} className="flex items-center gap-2">
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
                  <span className="flex-1 text-sm text-muted">{task.title}</span>
                  <button
                    onClick={() => completeTask.mutate({ id: task.id, projectId: project.id })}
                    className="cursor-pointer p-1 text-muted transition-colors duration-200 hover:text-positive"
                    aria-label="Lõpeta alamtask"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    onClick={() => deleteTask.mutate({ id: task.id, projectId: project.id })}
                    className="cursor-pointer p-1 text-muted transition-colors duration-200 hover:text-destructive"
                    aria-label="Kustuta alamtask"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">Alamtaske pole.</p>
          )}

          <form onSubmit={handleAddTask} className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted/60 transition-colors duration-200 focus:border-accent focus:outline-none"
              placeholder="Uus alamtask..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
            />
            <Button
              type="submit"
              variant="ghost"
              className="px-2.5 py-1 text-xs"
              disabled={addTask.isPending}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function AddProjectForm({ section }: { section: ProjectSection }) {
  const addProject = useAddProject();
  const [title, setTitle] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    addProject.mutate({ title: trimmed, section });
    setTitle("");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
      <input
        className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted/60 transition-colors duration-200 focus:border-accent focus:outline-none"
        placeholder="Uus projekt..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Button type="submit" disabled={addProject.isPending}>
        Lisa
      </Button>
    </form>
  );
}

export function ProjectsWidget() {
  const [section, setSection] = useState<ProjectSection>("projects");
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const { data, isLoading, error } = useProjects();

  const projects = (data ?? []).filter((p) => p.section === section);

  return (
    <Card>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={FolderKanban}>Projects</WidgetTitle>
        <div className="flex gap-1">
          <TabButton active={section === "projects"} onClick={() => setSection("projects")}>
            Projects
          </TabButton>
          <TabButton active={section === "personal"} onClick={() => setSection("personal")}>
            Personal projects
          </TabButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : error ? (
        <p className="text-sm text-destructive">Projektide laadimine ebaõnnestus.</p>
      ) : (
        <>
          <div>
            {projects.length === 0 ? (
              <p className="py-2 text-sm text-muted">Projekte pole.</p>
            ) : (
              projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  isOpen={openProjectId === project.id}
                  onToggle={() => setOpenProjectId(openProjectId === project.id ? null : project.id)}
                />
              ))
            )}
          </div>
          <AddProjectForm section={section} />
        </>
      )}
      </div>
    </Card>
  );
}
