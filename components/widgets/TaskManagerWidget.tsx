"use client";

import { useEffect, useRef, useState } from "react";
import { Check, GripVertical, ListChecks, Plus, X } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { Button } from "@/components/ui/Button";
import { Dropdown, DropdownOption } from "@/components/ui/Dropdown";
import { useAddTask, useDeleteTask, useTodayTasks, useUpdateTask } from "@/lib/queries/useTodayTasks";
import {
  Criticality,
  useAddProjectTask,
  useAllProjectTasks,
  useDeleteProjectTask,
  useMoveTaskToProject,
  useProjects,
  useToggleProjectTask,
  useUpdateProjectTaskCriticality,
  useUpdateProjectTaskDueDate,
  useUpdateProjectTaskProject,
  useUpdateProjectTaskTitle,
} from "@/lib/queries/useProjects";
import { useTaskManagerOrder, useUpdateTaskManagerOrder } from "@/lib/queries/useTaskManagerOrder";
import { scoreBadge } from "@/lib/dailyScoreStatus";

type FilterKey = "today" | "personal" | "projects";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "today", label: "Today's tasks" },
  { key: "personal", label: "Personal projects" },
  { key: "projects", label: "Projects" },
];

const CRITICALITY_CLASS: Record<Criticality, string> = {
  on_track: "bg-positive",
  warning: "bg-warning",
  critical: "bg-destructive",
};

const CRITICALITY_ORDER: Criticality[] = ["on_track", "warning", "critical"];

function nextCriticality(current: Criticality): Criticality {
  const i = CRITICALITY_ORDER.indexOf(current);
  return CRITICALITY_ORDER[(i + 1) % CRITICALITY_ORDER.length];
}

interface ProjectOption {
  id: string;
  label: string;
}

interface TaskItem {
  key: string;
  source: FilterKey;
  projectId?: string;
  title: string;
  done: boolean;
  label: string;
  criticality?: Criticality;
  /** Päev, mil task ilmub Today's Tasks alla; ainult projekti-taskil. */
  dueDate: string | null;
  projectOptions: ProjectOption[];
  projectValue: string;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onChangeProject: (id: string) => void;
  onCycleCriticality?: () => void;
  /** Puudub päevataskil — tema kuupäev on tasks-tabeli rida ise. */
  onSetDueDate?: (date: string | null) => void;
}

/**
 * Vaikimisi järjekord, kui rida pole lohistatud: Today read enne projektitaske,
 * siis kuupäev varasemast hilisemani, kuupäevata read lõppu.
 */
function defaultCompare(a: TaskItem, b: TaskItem): number {
  const aToday = a.source === "today" ? 0 : 1;
  const bToday = b.source === "today" ? 0 : 1;
  if (aToday !== bToday) return aToday - bToday;

  if (a.dueDate === b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

const DATE_INPUT_CLASS =
  "shrink-0 rounded-lg border border-border/60 bg-transparent px-2 py-1 font-mono text-xs text-muted outline-none transition-colors duration-200 [color-scheme:dark] hover:text-foreground focus:border-accent";

// max-h-48 + ääred; kaardil on overflow-hidden, nii et alumiste ridade menüü
// tuleb avada ülespoole, muidu jääb see kaardi serva taha kinni.
const PROJECT_MENU_HEIGHT = 200;

/** Projektisilt, mis avab klõpsates projektide nimekirja. */
function ProjectPill({ item }: { item: TaskItem }) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggleMenu() {
    if (!open) {
      const pill = ref.current?.getBoundingClientRect();
      const list = ref.current?.closest("ul")?.getBoundingClientRect();
      setOpenUp(!!pill && !!list && list.bottom - pill.bottom < PROJECT_MENU_HEIGHT);
    }
    setOpen((v) => !v);
  }

  return (
    <span
      ref={ref}
      className={`relative flex shrink-0 items-center gap-2 rounded-full border border-border/60 px-2.5 py-1 ${
        item.done ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        onClick={toggleMenu}
        className="cursor-pointer text-xs uppercase tracking-wide text-muted transition-colors duration-200 hover:text-foreground"
        aria-label={`Projekt: ${item.label} (klõpsa vahetamiseks)`}
      >
        {item.label}
      </button>
      {item.criticality &&
        (item.onCycleCriticality ? (
          <button
            type="button"
            onClick={item.onCycleCriticality}
            className={`h-3 w-3 shrink-0 cursor-pointer rounded-full ${CRITICALITY_CLASS[item.criticality]}`}
            aria-label={`Kriitilisus: ${item.criticality} (klõpsa muutmiseks)`}
          />
        ) : (
          <span
            className={`h-3 w-3 rounded-full ${CRITICALITY_CLASS[item.criticality]}`}
            aria-label={`Kriitilisus: ${item.criticality}`}
          />
        ))}

      {open && (
        <div
          className={`absolute right-0 z-20 max-h-48 w-44 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] ${
            openUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]"
          }`}
        >
          {item.projectOptions.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setOpen(false);
                if (o.id !== item.projectValue) item.onChangeProject(o.id);
              }}
              className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors duration-200 ${
                o.id === item.projectValue
                  ? "bg-surface-hover text-foreground"
                  : "text-muted hover:bg-surface-hover/60 hover:text-foreground"
              }`}
            >
              <span className="truncate">{o.label}</span>
              {o.id === item.projectValue && (
                <Check className="h-3 w-3 shrink-0 text-accent" aria-hidden />
              )}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function SortableTaskRow({ item }: { item: TaskItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  function startEdit() {
    setEditValue(item.title);
    setEditing(true);
  }

  function commitEdit() {
    const title = editValue.trim();
    if (title && title !== item.title) item.onRename(title);
    setEditing(false);
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group/row flex items-center gap-3 py-2.5 transition-colors duration-200 hover:bg-surface-hover/25 ${
        isDragging ? "relative z-10 bg-surface opacity-90" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="-ml-1 shrink-0 cursor-grab touch-none p-0.5 text-muted opacity-40 transition-opacity duration-200 focus-visible:opacity-100 active:cursor-grabbing group-hover/row:opacity-100"
        aria-label="Lohista ümber"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <CheckToggle
        checked={item.done}
        onChange={item.onToggle}
        aria-label={item.done ? "Märgi tegemata" : "Märgi tehtud"}
      />
      {editing ? (
        <input
          autoFocus
          className="min-w-0 flex-1 border-b border-border bg-transparent text-sm text-foreground outline-none focus:border-accent"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <span
          onClick={startEdit}
          className={`min-w-0 flex-1 cursor-text truncate text-sm ${
            item.done ? "text-muted line-through" : "text-foreground"
          }`}
        >
          {item.title}
        </span>
      )}
      {item.done && item.source !== "today" && (
        <span className="shrink-0 rounded-full border border-border/60 px-2.5 py-1 text-xs uppercase tracking-wide text-muted opacity-50">
          Today
        </span>
      )}
      {item.onSetDueDate && (
        <input
          type="date"
          value={item.dueDate ?? ""}
          onChange={(e) => item.onSetDueDate?.(e.target.value || null)}
          className={`${DATE_INPUT_CLASS} ${item.done ? "opacity-50" : ""}`}
          aria-label="Taski kuupäev"
        />
      )}
      <ProjectPill item={item} />
      <button
        type="button"
        onClick={item.onDelete}
        className="shrink-0 p-0.5 text-muted opacity-40 transition-all duration-200 hover:text-destructive focus-visible:opacity-100 group-hover/row:opacity-100"
        aria-label="Kustuta task"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </li>
  );
}

export function TaskManagerWidget() {
  const [active, setActive] = useState<Record<FilterKey, boolean>>({
    today: true,
    personal: true,
    projects: true,
  });
  // Projektid, mille taskid on eraldi peidetud (vaikimisi kõik nähtavad).
  const [hiddenProjects, setHiddenProjects] = useState<Set<string>>(new Set());
  // "all" = filter väljas, checkboxid otsustavad. Muidu näidatakse ainult seda projekti.
  const [onlyProject, setOnlyProject] = useState("all");
  // Tühi = praegune käitumine (päevataskid tänasest). Täidetuna selle päeva taskid.
  const [filterDate, setFilterDate] = useState("");

  function toggleProject(id: string) {
    setHiddenProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const todayTasks = useTodayTasks(filterDate || undefined);
  const personalTasks = useAllProjectTasks("personal");
  const projectTasks = useAllProjectTasks("projects");
  const orderQuery = useTaskManagerOrder();
  const { data: allProjects } = useProjects();
  const updateTask = useUpdateTask();
  const toggleTask = useToggleProjectTask();
  const updateOrder = useUpdateTaskManagerOrder();
  const addTodayTask = useAddTask();
  const addProjectTask = useAddProjectTask();
  const deleteTodayTask = useDeleteTask();
  const deleteProjectTask = useDeleteProjectTask();
  const updateProjectTaskTitle = useUpdateProjectTaskTitle();
  const updateProjectTaskCriticality = useUpdateProjectTaskCriticality();
  const updateProjectTaskDueDate = useUpdateProjectTaskDueDate();
  const updateProjectTaskProject = useUpdateProjectTaskProject();
  const moveTaskToProject = useMoveTaskToProject();

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("today");

  const categoryOptions: DropdownOption[] = [
    { id: "today", label: "Today's tasks" },
    ...(allProjects ?? []).map((p) => ({ id: p.id, label: p.title })),
  ];
  const addPending = addTodayTask.isPending || addProjectTask.isPending;

  function submitNewTask() {
    const title = newTitle.trim();
    if (!title || addPending) return;
    if (newCategory === "today") {
      addTodayTask.mutate({ title });
    } else {
      if (!allProjects?.some((p) => p.id === newCategory)) return;
      addProjectTask.mutate({ projectId: newCategory, title });
    }
    setNewTitle("");
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Ühe projekti valik tühistab checkboxid — siis loevad ainult projektiallikad.
  const filterByProject = onlyProject !== "all";
  const sourceOn = (key: FilterKey) => (filterByProject ? key !== "today" : active[key]);

  const noneActive = !filterByProject && FILTERS.every((f) => !active[f.key]);
  const isLoading =
    orderQuery.isLoading ||
    (sourceOn("today") && todayTasks.isLoading) ||
    (sourceOn("personal") && personalTasks.isLoading) ||
    (sourceOn("projects") && projectTasks.isLoading);
  const hasError =
    (sourceOn("today") && todayTasks.error) ||
    (sourceOn("personal") && personalTasks.error) ||
    (sourceOn("projects") && projectTasks.error);

  const projectOptions: ProjectOption[] = (allProjects ?? []).map((p) => ({
    id: p.id,
    label: p.title,
  }));
  // Päevataski saab tõsta projekti alla; tagasi mitte, nii et "Today" on ainult praegune väärtus.
  const todayProjectOptions: ProjectOption[] = [{ id: "today", label: "Today" }, ...projectOptions];

  // Tehtud projekti-taskide peegelread tasks-tabelis (project_task_id) jäetakse
  // siin vahele — projekti enda rida kannab juba TODAY silti.
  const projectTaskIds = new Set(
    [...(personalTasks.data ?? []), ...(projectTasks.data ?? [])].map((t) => t.id),
  );

  const allItems: TaskItem[] = [];
  for (const task of todayTasks.data ?? []) {
    // Dateeritud projekti-task on nimekirjas juba oma projekti realt.
    if (task.origin === "project_task") continue;
    if (task.project_task_id && projectTaskIds.has(task.project_task_id)) continue;
    allItems.push({
      key: `today-${task.id}`,
      source: "today",
      title: task.title,
      done: task.done,
      label: "Today",
      dueDate: null,
      projectOptions: todayProjectOptions,
      projectValue: "today",
      onToggle: () => updateTask.mutate({ id: task.id, done: !task.done }),
      onRename: (title) => updateTask.mutate({ id: task.id, title }),
      onDelete: () => deleteTodayTask.mutate({ id: task.id }),
      onChangeProject: (projectId) =>
        moveTaskToProject.mutate({ taskId: task.id, projectId, title: task.title }),
    });
  }
  for (const [source, query] of [
    ["personal", personalTasks],
    ["projects", projectTasks],
  ] as const) {
    for (const task of query.data ?? []) {
      const taskDone = task.completed_at !== null;
      allItems.push({
        key: `${source}-${task.id}`,
        source,
        projectId: task.project_id,
        title: task.title,
        done: taskDone,
        label: task.projectTitle,
        criticality: task.criticality,
        dueDate: task.due_date,
        projectOptions,
        projectValue: task.project_id,
        onToggle: () =>
          toggleTask.mutate({
            id: task.id,
            projectId: task.project_id,
            title: task.title,
            done: !taskDone,
          }),
        onRename: (title) =>
          updateProjectTaskTitle.mutate({ id: task.id, projectId: task.project_id, title }),
        onDelete: () => deleteProjectTask.mutate({ id: task.id, projectId: task.project_id }),
        onCycleCriticality: () =>
          updateProjectTaskCriticality.mutate({
            id: task.id,
            projectId: task.project_id,
            criticality: nextCriticality(task.criticality),
          }),
        onChangeProject: (newProjectId) =>
          updateProjectTaskProject.mutate({
            id: task.id,
            projectId: task.project_id,
            newProjectId,
          }),
        onSetDueDate: (dueDate) =>
          updateProjectTaskDueDate.mutate({ id: task.id, projectId: task.project_id, dueDate }),
      });
    }
  }

  const savedOrder = orderQuery.data ?? [];
  const position = new Map(savedOrder.map((key, i) => [key, i]));
  allItems.sort((a, b) => {
    // Tehtud tõusevad ette ka siis, kui rida on varem lohistatud.
    if (a.done !== b.done) return Number(b.done) - Number(a.done);
    // Lohistatud read hoiavad oma kohta; ülejäänud langevad vaikejärjekorda.
    const pa = position.get(a.key) ?? Infinity;
    const pb = position.get(b.key) ?? Infinity;
    if (pa !== pb) return pa - pb;
    return defaultCompare(a, b);
  });

  // Tehtuks märgitud task kuulub lisaks ka "Today's tasks" kategooriasse.
  const visibleItems = allItems.filter((item) => {
    // Päevataskid on juba selle kuupäeva kohta päritud; projekti-taskid filtreerime siin.
    if (filterDate && item.source !== "today" && item.dueDate !== filterDate) return false;
    if (filterByProject) return item.projectId === onlyProject;

    const ownVisible =
      active[item.source] && (!item.projectId || !hiddenProjects.has(item.projectId));
    return ownVisible || (item.done && active.today);
  });
  const doneCount = visibleItems.filter((i) => i.done).length;
  const openCountBySource = (source: FilterKey) =>
    allItems.filter((i) => i.source === source && !i.done).length;

  function handleDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;

    const visibleKeys = visibleItems.map((i) => i.key);
    const from = visibleKeys.indexOf(String(dragged.id));
    const to = visibleKeys.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    // Uus täisjärjekord: nähtavad read uues järjekorras, peidetud read jäävad oma kohale.
    const movedVisible = arrayMove(visibleKeys, from, to);
    const visibleSet = new Set(visibleKeys);
    let vi = 0;
    const fullOrder = allItems.map((item) =>
      visibleSet.has(item.key) ? movedVisible[vi++] : item.key,
    );
    updateOrder.mutate(fullOrder);
  }

  return (
    <Card>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={ListChecks} href="https://taskzen-phi.vercel.app/tasks">
          Taskmanager
        </WidgetTitle>
        {visibleItems.length > 0 && (
          <span className="font-mono text-xs text-muted">
            {scoreBadge(doneCount, visibleItems.length)}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 md:flex-row">
        <aside className="shrink-0 border-b border-border/40 pb-5 md:w-56 md:border-b-0 md:border-r md:pb-0 md:pr-6">
          <div className="mb-4 min-w-0">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
              Projekt
            </p>
            <Dropdown
              options={[
                { id: "all", label: "Kõik allikad" },
                ...(allProjects ?? []).map((p) => ({
                  id: p.id,
                  label: p.title,
                  count: p.taskCount,
                })),
              ]}
              value={onlyProject}
              onChange={setOnlyProject}
            />
          </div>

          <div className="mb-4 min-w-0">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
              Kuupäev
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={`${DATE_INPUT_CLASS} min-w-0 flex-1 py-2`}
                aria-label="Näita selle kuupäeva taske"
              />
              {filterDate && (
                <button
                  type="button"
                  onClick={() => setFilterDate("")}
                  className="shrink-0 cursor-pointer p-1 text-muted transition-colors duration-200 hover:text-foreground"
                  aria-label="Tühjenda kuupäev"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
          </div>

          {/* Ühe projekti valikul ei mõjuta checkboxid enam midagi. */}
          <div className={`min-w-0 ${filterByProject ? "pointer-events-none opacity-40" : ""}`}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
              Sources
            </p>
            <div className="flex flex-col gap-0.5">
              {FILTERS.map((f) => (
                <div key={f.key} className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setActive((prev) => ({ ...prev, [f.key]: !prev[f.key] }))}
                    aria-pressed={active[f.key]}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-200 ${
                      active[f.key]
                        ? "bg-surface-hover/60 text-foreground"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-200 ${
                        active[f.key] ? "border-accent bg-accent text-background" : "border-border"
                      }`}
                      aria-hidden
                    >
                      {active[f.key] && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-left">{f.label}</span>
                    <span className="font-mono text-xs tabular-nums text-muted">
                      {openCountBySource(f.key)}
                    </span>
                  </button>
                  {f.key !== "today" && active[f.key] && (
                    <div className="ml-4 flex flex-col gap-0.5 border-l border-border/40 pl-2.5">
                      {(allProjects ?? [])
                        .filter((p) => p.section === f.key)
                        .map((p) => {
                          const projectVisible = !hiddenProjects.has(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggleProject(p.id)}
                              aria-pressed={projectVisible}
                              className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors duration-200 ${
                                projectVisible
                                  ? "text-foreground"
                                  : "text-muted hover:text-foreground"
                              }`}
                            >
                              <span
                                className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors duration-200 ${
                                  projectVisible
                                    ? "border-accent bg-accent text-background"
                                    : "border-border"
                                }`}
                                aria-hidden
                              >
                                {projectVisible && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-left">{p.title}</span>
                              <span className="font-mono text-[10px] tabular-nums text-muted">
                                {p.taskCount}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {savedOrder.length > 0 && (
            <button
              type="button"
              onClick={() => updateOrder.mutate([])}
              className="mt-4 w-full cursor-pointer rounded-lg border border-border/60 px-2.5 py-2 text-xs text-muted transition-colors duration-200 hover:border-accent/40 hover:text-foreground"
            >
              Taasta vaikimisi järjekord
            </button>
          )}
        </aside>

        <div className="min-w-0 max-w-4xl flex-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitNewTask();
            }}
            className="mb-3 flex items-center gap-2 border-b border-border/40 pb-3"
          >
            <input
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-muted/60 focus:border-accent"
              placeholder="Uus task..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Dropdown
              className="w-48 shrink-0"
              options={categoryOptions}
              value={newCategory}
              onChange={setNewCategory}
            />
            <Button
              type="submit"
              className="shrink-0 px-3 py-2"
              disabled={addPending || !newTitle.trim()}
              aria-label="Lisa task"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </Button>
          </form>

          {noneActive ? (
            <p className="py-2 text-sm text-muted">Vali allikas, et taske näha.</p>
          ) : isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : hasError ? (
            <p className="text-sm text-destructive">Taskide laadimine ebaõnnestus.</p>
          ) : visibleItems.length === 0 ? (
            <p className="py-2 text-sm text-muted">Taske pole.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={visibleItems.map((i) => i.key)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="divide-y divide-border/40">
                  {visibleItems.map((item) => (
                    <SortableTaskRow key={item.key} item={item} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </Card>
  );
}
