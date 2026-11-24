"use client";

import {
  ButtonHTMLAttributes,
  ComponentType,
  MouseEvent,
  SVGProps,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  CalendarSearch,
  GripVertical,
  ListChecks,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
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
import { useAddTask, useDeleteTask, useTodayTasks, useUpdateTask } from "@/lib/queries/useTodayTasks";
import {
  Criticality,
  useAddProjectTask,
  useAllProjectTasks,
  useDeleteProjectTask,
  useProjects,
  useToggleProjectTask,
  useUpdateProjectTaskCriticality,
  useUpdateProjectTaskDueDate,
  useUpdateProjectTaskTitle,
} from "@/lib/queries/useProjects";
import {
  LATER_KEY,
  moveInOrder,
  useTaskManagerOrder,
  useUpdateTaskManagerOrder,
  withLaterMarker,
} from "@/lib/queries/useTaskManagerOrder";
import {
  TaskManagerProject,
  useAddTaskManagerProject,
  useDeleteTaskManagerProject,
  useReorderTaskManagerProjects,
  useTaskManagerProjects,
} from "@/lib/queries/useTaskManagerProjects";
import { scoreBadge } from "@/lib/dailyScoreStatus";
import { nextDate, todayDate } from "@/lib/date";

type TaskSource = "today" | "personal" | "projects";

const CRITICALITY_CLASS: Record<Criticality, string> = {
  on_track: "bg-positive",
  warning: "bg-warning",
  critical: "bg-destructive",
};

const CRITICALITY_LABEL: Record<Criticality, string> = {
  on_track: "graafikus",
  warning: "hoiatus",
  critical: "kriitiline",
};

const CRITICALITY_ORDER: Criticality[] = ["on_track", "warning", "critical"];

function nextCriticality(current: Criticality): Criticality {
  const i = CRITICALITY_ORDER.indexOf(current);
  return CRITICALITY_ORDER[(i + 1) % CRITICALITY_ORDER.length];
}

interface TaskItem {
  key: string;
  source: TaskSource;
  title: string;
  done: boolean;
  /** Ainult projekti-taskil; päevataskil kriitilisust pole. */
  criticality?: Criticality;
  /** Päev, mil task ilmub Today's Tasks alla; ainult projekti-taskil. */
  dueDate: string | null;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
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

const DAY_FORMAT = new Intl.DateTimeFormat("et-EE", { day: "numeric", month: "short" });
const DAY_YEAR_FORMAT = new Intl.DateTimeFormat("et-EE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "2026-11-25" → "Täna", "Homme" või "25. nov"; teise aasta kuupäev koos aastaga. */
function formatDay(iso: string): string {
  const today = todayDate();
  if (iso === today) return "Täna";
  if (iso === nextDate(today)) return "Homme";

  const [year, month, day] = iso.split("-").map(Number);
  // Kohalik kuupäev — new Date("YYYY-MM-DD") oleks UTC ja nihkuks ajavööndiga.
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return iso;
  return (year === new Date().getFullYear() ? DAY_FORMAT : DAY_YEAR_FORMAT).format(date);
}

/** Nähtamatu kuupäevavälja klõps avab kalendri kogu välja ulatuses, mitte ainult ikoonil. */
function openPicker(e: MouseEvent<HTMLInputElement>) {
  try {
    e.currentTarget.showPicker();
  } catch {
    // Brauser ilma showPicker'ita avab kalendri oma vaikekäitumisega.
  }
}

interface DateFieldProps {
  /** ISO kuupäev või tühi string. */
  value: string;
  onChange: (value: string) => void;
  /** Nimi ekraanilugejale ja kohtspikrina; nähtavat silti pole. */
  label: string;
  /** Tühja välja ikoon; vaikimisi kalender. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Kui antud, tekib valitud kuupäeva kõrvale tühjendamise nupp. */
  clearLabel?: string;
  /** Valitud kuupäeva välimus. */
  activeClass?: string;
  /** Tühi väli ilmub alles rea hõljumisel või fookuses; puuteekraanil on õrnalt näha. */
  revealOnRowHover?: boolean;
}

/**
 * Kuupäev vaikse tekstina, tühjana kalendriikoon. Päris `<input type="date">` on
 * nähtamatult peal, nii et valija, klaviatuur ja ekraanilugeja töötavad nagu ikka.
 */
function DateField({
  value,
  onChange,
  label,
  icon: Icon = CalendarDays,
  clearLabel,
  activeClass = "text-muted hover:text-foreground",
  revealOnRowHover = false,
}: DateFieldProps) {
  const emptyClass = `text-muted hover:bg-surface-hover/60 hover:text-foreground ${
    revealOnRowHover
      ? "opacity-0 focus-within:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-40"
      : ""
  }`;

  return (
    <span
      className={`flex h-7 shrink-0 items-center rounded-lg font-mono text-xs transition-[color,background-color,opacity] duration-200 focus-within:ring-1 focus-within:ring-accent/70 ${
        value ? activeClass : emptyClass
      }`}
    >
      <span className="relative flex h-full items-center whitespace-nowrap px-1.5">
        {value ? formatDay(value) : <Icon className="h-4 w-4" aria-hidden />}
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={openPicker}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 [color-scheme:dark]"
          aria-label={label}
          title={label}
        />
      </span>
      {clearLabel && value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="-ml-0.5 flex h-full cursor-pointer items-center pr-1.5 opacity-60 transition-opacity duration-200 hover:opacity-100"
          aria-label={clearLabel}
          title={clearLabel}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </span>
  );
}

function DeleteButton({ onDelete, label = "Kustuta task" }: { onDelete: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onDelete}
      className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted opacity-0 transition-[color,opacity] duration-200 hover:text-destructive focus-visible:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-50"
      aria-label={label}
    >
      <X className="h-4 w-4" aria-hidden />
    </button>
  );
}

/** Lohistamissang; dnd-kiti `attributes` ja `listeners` antakse edasi propsidena. */
function DragHandle(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="-ml-1 shrink-0 cursor-grab touch-none p-0.5 text-muted opacity-30 transition-opacity duration-200 focus-visible:opacity-100 active:cursor-grabbing group-hover/row:opacity-100"
      aria-label="Lohista ümber"
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  );
}

interface SortableTaskRowProps {
  item: TaskItem;
  /** Rida on "Kaugemas tulevikus" all: tuhmim, kuni sellega tegeletakse. */
  later: boolean;
}

function SortableTaskRow({ item, later }: SortableTaskRowProps) {
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
      className={`group/row flex min-h-14 items-center gap-2 py-3 transition-[background-color,opacity] duration-200 hover:bg-surface-hover/25 sm:gap-3 ${
        isDragging
          ? "relative z-10 bg-surface opacity-90"
          : later
            ? "opacity-55 focus-within:opacity-100 hover:opacity-100"
            : ""
      }`}
    >
      <DragHandle {...attributes} {...listeners} />
      <CheckToggle checked={item.done} onChange={item.onToggle} aria-label="Märgi tehtud" />
      {editing ? (
        <input
          autoFocus
          className="-mb-px min-w-0 flex-1 border-b border-accent bg-transparent text-base leading-6 text-foreground outline-none"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditing(false);
          }}
          aria-label="Taski pealkiri"
        />
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className="min-w-0 flex-1 cursor-text text-left text-base leading-6 text-foreground"
        >
          {/* Telefonis kaks rida, et pealkiri ei kaoks kuupäeva ja nuppude taha. */}
          <span className="block break-words max-sm:line-clamp-2 sm:truncate">{item.title}</span>
        </button>
      )}
      {item.onSetDueDate && (
        <DateField
          value={item.dueDate ?? ""}
          onChange={(date) => item.onSetDueDate?.(date || null)}
          label="Taski kuupäev"
          revealOnRowHover
        />
      )}
      {/* Kindla laiusega pesa hoiab kuupäevad ja ristid joondus ka täpita ridadel. */}
      <span className="flex w-6 shrink-0 justify-center">
        {item.criticality && item.onCycleCriticality && (
          <button
            type="button"
            onClick={item.onCycleCriticality}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 hover:bg-surface-hover"
            aria-label={`Kriitilisus: ${CRITICALITY_LABEL[item.criticality]}. Klõpsa muutmiseks.`}
            title={`Kriitilisus: ${CRITICALITY_LABEL[item.criticality]}`}
          >
            <span
              className={`h-3 w-3 rounded-full ${CRITICALITY_CLASS[item.criticality]}`}
              aria-hidden
            />
          </button>
        )}
      </span>
      <DeleteButton onDelete={item.onDelete} />
    </li>
  );
}

function DoneTaskRow({ item }: { item: TaskItem }) {
  return (
    <li className="group/row flex items-center gap-3 py-2.5">
      <CheckToggle checked onChange={item.onToggle} aria-label="Märgi tegemata" />
      <span
        className="min-w-0 flex-1 truncate text-sm text-muted line-through decoration-muted/50"
        title={item.title}
      >
        {item.title}
      </span>
      <DeleteButton onDelete={item.onDelete} />
    </li>
  );
}

/**
 * Pealkirjarida taskide nimekirja sees: read selle all on "Kaugemas tulevikus".
 * Ise ei lohistu, aga on lohistamise sihtkoht, nii et taski saab üle piiri tõsta.
 */
function LaterDivider({ count }: { count: number }) {
  const { setNodeRef, transform, transition } = useSortable({
    id: LATER_KEY,
    disabled: { draggable: true },
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="pb-3 pt-9"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">Kaugemas tulevikus</h3>
        {count > 0 && <span className="font-mono text-xs text-muted">{count}</span>}
      </div>
      {count === 0 && (
        <p className="pt-1 text-sm text-muted">Lohista siia taskid, millega praegu ei tegele.</p>
      )}
    </li>
  );
}

function SortableProjectRow({
  project,
  onDelete,
}: {
  project: TaskManagerProject;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group/row flex min-h-11 items-center gap-2 py-2 ${
        isDragging ? "relative z-10 bg-surface opacity-90" : ""
      }`}
    >
      <DragHandle {...attributes} {...listeners} />
      <span
        className="min-w-0 flex-1 truncate text-base font-bold leading-6 text-foreground"
        title={project.title}
      >
        {project.title}
      </span>
      <DeleteButton onDelete={onDelete} label="Eemalda projekt" />
    </li>
  );
}

/** Vaba nimekiri projektidest, millega praegu tegeletakse; TaskZeni projektidest sõltumatu. */
function ActiveProjects() {
  const projectsQuery = useTaskManagerProjects();
  const addProject = useAddTaskManagerProject();
  const deleteProject = useDeleteTaskManagerProject();
  const reorderProjects = useReorderTaskManagerProjects();

  const [title, setTitle] = useState("");
  const [addFailed, setAddFailed] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const projects = projectsQuery.data ?? [];

  function submitProject() {
    const name = title.trim();
    if (!name) {
      titleRef.current?.focus();
      return;
    }
    if (addProject.isPending) return;

    addProject.mutate(
      // Uus projekt läheb nimekirja lõppu.
      { title: name, position: Math.max(-1, ...projects.map((p) => p.position)) + 1 },
      {
        onSuccess: () => setAddFailed(false),
        // Nimi tagasi väljale, kui sinna pole vahepeal uut kirjutatud.
        onError: () => {
          setAddFailed(true);
          setTitle((current) => current || name);
        },
      },
    );
    setTitle("");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;

    const from = projects.findIndex((p) => p.id === dragged.id);
    const to = projects.findIndex((p) => p.id === over.id);
    if (from === -1 || to === -1) return;
    reorderProjects.mutate(arrayMove(projects, from, to));
  }

  return (
    <section aria-label="Käimasolevad projektid">
      <div className="flex h-10 items-center justify-between gap-3 border-b border-border/40 lg:h-14">
        <h3 className="text-sm font-medium text-foreground">Käimasolevad projektid</h3>
        {projects.length > 0 && (
          <span className="font-mono text-xs text-muted">{projects.length}</span>
        )}
      </div>

      {projectsQuery.isLoading ? (
        <Skeleton className="mt-3 h-16 w-full" />
      ) : projectsQuery.error ? (
        <p className="py-4 text-sm text-destructive">
          Projekte ei saanud laadida. Laadi leht uuesti.
        </p>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={projects.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="divide-y divide-border/40">
                {projects.map((project) => (
                  <SortableProjectRow
                    key={project.id}
                    project={project}
                    onDelete={() => deleteProject.mutate(project.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitProject();
            }}
            className={`group/add flex h-11 items-center gap-2 border-b border-b-transparent transition-colors duration-200 focus-within:border-b-accent ${
              projects.length > 0 ? "border-t border-t-border/40" : ""
            }`}
          >
            <button
              type="submit"
              className="-ml-1 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center text-muted transition-colors duration-200 hover:text-accent-bright group-focus-within/add:text-accent-bright"
              aria-label="Lisa projekt"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
            <input
              ref={titleRef}
              className="min-w-0 flex-1 bg-transparent text-base leading-6 text-foreground outline-none placeholder:text-muted/60"
              placeholder="Lisa projekt"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              enterKeyHint="done"
              aria-label="Uue projekti nimi"
            />
          </form>

          {addFailed && (
            <p className="pt-2 text-sm text-destructive" role="alert">
              Projekti ei saanud lisada. Proovi uuesti.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Vasakul kõik lahtised taskid ühes nimekirjas; pealkirjarea "Kaugemas tulevikus" alla
 * lohistatud taskid on edasi lükatud. Paremal käimasolevad projektid ja tehtud taskid.
 * Kategooriaid siin ei valita: uus task läheb alati Business-projekti.
 */
export function TaskManagerWidget() {
  // Tühi = päevataskid tänasest ja kõik projekti-taskid. Täidetuna ainult selle päeva taskid.
  const [filterDate, setFilterDate] = useState("");

  const todayTasks = useTodayTasks(filterDate || undefined);
  const personalTasks = useAllProjectTasks("personal");
  const projectTasks = useAllProjectTasks("projects");
  const orderQuery = useTaskManagerOrder();
  const projectsQuery = useProjects();
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

  const [newTitle, setNewTitle] = useState("");
  // Tühi = Businessi task jääb kuupäevata; Today varuvariandis läheb task tänasesse.
  const [newDate, setNewDate] = useState("");
  const [addFailed, setAddFailed] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Kui Business-projekti pole (ümber nimetatud, kustutatud), läheb task Today alla,
  // et lisamine vaikselt ei ebaõnnestuks.
  const businessId = projectsQuery.data?.find(
    (p) => p.title.trim().toLowerCase() === "business",
  )?.id;
  const addPending = addTodayTask.isPending || addProjectTask.isPending;

  function submitNewTask() {
    const title = newTitle.trim();
    if (!title) {
      titleRef.current?.focus();
      return;
    }
    // Projektide laadimise ajal pole teada, kas Business on olemas; pealkiri jääb väljale ootama.
    if (addPending || projectsQuery.isLoading) return;

    const callbacks = {
      onSuccess: () => setAddFailed(false),
      // Pealkiri tagasi väljale, kui sinna pole vahepeal uut kirjutatud.
      onError: () => {
        setAddFailed(true);
        setNewTitle((current) => current || title);
      },
    };
    if (businessId) {
      addProjectTask.mutate({ projectId: businessId, title, dueDate: newDate || null }, callbacks);
    } else {
      addTodayTask.mutate({ title, date: newDate || undefined }, callbacks);
    }
    // Kuupäev jääb püsima — mitu taski samale päevale on tavaline.
    setNewTitle("");
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const isLoading =
    orderQuery.isLoading ||
    todayTasks.isLoading ||
    personalTasks.isLoading ||
    projectTasks.isLoading;
  const hasError = Boolean(todayTasks.error || personalTasks.error || projectTasks.error);
  const ready = !isLoading && !hasError;

  // Tehtud projekti-taskide peegelread tasks-tabelis (project_task_id) jäetakse
  // siin vahele — projekti enda rida on juba nimekirjas.
  const projectTaskIds = new Set(
    [...(personalTasks.data ?? []), ...(projectTasks.data ?? [])].map((t) => t.id),
  );

  const allItems: TaskItem[] = [];
  for (const task of todayTasks.data ?? []) {
    // Dateeritud projekti-task on nimekirjas juba oma projekti realt.
    if (task.origin === "project_task") continue;
    // Kalendri-taskil pole tasks-rida, mida siinsed tegevused (nimi, kustutamine) muudaksid.
    if (task.origin === "calendar") continue;
    if (task.project_task_id && projectTaskIds.has(task.project_task_id)) continue;
    allItems.push({
      key: `today-${task.id}`,
      source: "today",
      title: task.title,
      done: task.done,
      dueDate: null,
      onToggle: () => updateTask.mutate({ id: task.id, done: !task.done }),
      onRename: (title) => updateTask.mutate({ id: task.id, title }),
      onDelete: () => deleteTodayTask.mutate({ id: task.id }),
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
        title: task.title,
        done: taskDone,
        criticality: task.criticality,
        dueDate: task.due_date,
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
        onSetDueDate: (dueDate) =>
          updateProjectTaskDueDate.mutate({ id: task.id, projectId: task.project_id, dueDate }),
      });
    }
  }

  // Lohistatud read hoiavad oma kohta; lohistamata (uued) langevad vaikejärjekorras
  // "Kaugemas tulevikus" piiri ette.
  const savedOrder = orderQuery.data ?? [];
  const savedKeys = new Set(savedOrder);
  const fullOrder = withLaterMarker(
    savedOrder,
    allItems
      .filter((item) => !savedKeys.has(item.key))
      .sort(defaultCompare)
      .map((item) => item.key),
  );
  const position = new Map(fullOrder.map((key, i) => [key, i]));
  const laterAt = position.get(LATER_KEY) ?? fullOrder.length;
  allItems.sort((a, b) => (position.get(a.key) ?? 0) - (position.get(b.key) ?? 0));
  const isLater = (item: TaskItem) => (position.get(item.key) ?? 0) > laterAt;

  // Päevataskid on juba selle kuupäeva kohta päritud; projekti-taskid filtreerime siin.
  const visibleItems = allItems.filter(
    (item) => !filterDate || item.source === "today" || item.dueDate === filterDate,
  );
  const openItems = visibleItems.filter((i) => !i.done);
  const doneItems = visibleItems.filter((i) => i.done);
  const activeItems = openItems.filter((i) => !isLater(i));
  const laterItems = openItems.filter(isLater);
  const listKeys = [...activeItems.map((i) => i.key), LATER_KEY, ...laterItems.map((i) => i.key)];
  // Edasi lükatud taskid skoori ei lähe: nendega praegu ei tegeleta.
  const scoreTotal = doneItems.length + activeItems.length;

  // Filtrita on kõik näidatavad taskid laaditud, nii et tundmatu võti on kustutatud task
  // ja langeb salvestamisel välja. Kuupäevafiltriga on teiste päevade päevataskid
  // laadimata; nende koht ja pool piirist peavad alles jääma.
  const knownKeys = new Set(allItems.map((i) => i.key));
  const keptOrder = filterDate
    ? fullOrder
    : fullOrder.filter((key) => key === LATER_KEY || knownKeys.has(key));

  // Lähtestada on midagi ainult siis, kui piiri ees on lohistatud ridu.
  const savedLaterAt = savedOrder.indexOf(LATER_KEY);
  const hasCustomOrder = savedLaterAt === -1 ? savedOrder.length > 0 : savedLaterAt > 0;

  function handleDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;

    const from = listKeys.indexOf(String(dragged.id));
    const to = listKeys.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    updateOrder.mutate(moveInOrder(keptOrder, listKeys, from, to));
  }

  /** Vaikejärjekord tagasi; edasi lükatud taskid jäävad "Kaugemas tulevikus" alla. */
  function resetOrder() {
    const later = [
      ...allItems
        .filter(isLater)
        .sort(defaultCompare)
        .map((i) => i.key),
      ...keptOrder.slice(keptOrder.indexOf(LATER_KEY) + 1).filter((key) => !knownKeys.has(key)),
    ];
    updateOrder.mutate(later.length > 0 ? [LATER_KEY, ...later] : []);
  }

  return (
    <Card>
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
        <WidgetTitle icon={ListChecks} href="https://taskzen-phi.vercel.app/tasks">
          Taskmanager
        </WidgetTitle>
        <div className="-my-1 flex items-center gap-1">
          {hasCustomOrder && (
            <button
              type="button"
              onClick={resetOrder}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors duration-200 hover:bg-surface-hover/60 hover:text-foreground"
              aria-label="Taasta vaikimisi järjekord"
              title="Taasta vaikimisi järjekord"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </button>
          )}
          <DateField
            value={filterDate}
            onChange={setFilterDate}
            label="Näita ühe päeva taske"
            icon={CalendarSearch}
            clearLabel="Näita kõiki taske"
            activeClass="bg-accent/15 text-accent-bright"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-8 lg:flex-row lg:gap-10">
        <section className="min-w-0 flex-1" aria-label="Lahtised taskid">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitNewTask();
            }}
            className="group/add flex h-14 items-center gap-2 border-b border-border/60 transition-colors duration-200 focus-within:border-accent sm:gap-3"
          >
            {/* Tühi pesa lohistamissanga kohal, et pluss oleks linnukestega ühel joonel. */}
            <span className="-ml-1 w-5 shrink-0" aria-hidden />
            <button
              type="submit"
              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-muted/50 text-muted transition-colors duration-200 hover:border-accent hover:text-accent-bright group-focus-within/add:border-accent group-focus-within/add:text-accent-bright"
              aria-label="Lisa task"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            </button>
            <input
              ref={titleRef}
              className="min-w-0 flex-1 bg-transparent font-display text-xl font-medium tracking-[-0.01em] text-foreground outline-none placeholder:text-muted/50 sm:text-2xl"
              placeholder="Uus task"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              enterKeyHint="done"
              aria-label="Uue taski pealkiri"
            />
            <DateField
              value={newDate}
              onChange={setNewDate}
              label="Uue taski kuupäev"
              clearLabel="Eemalda uue taski kuupäev"
              activeClass="text-foreground"
            />
            {/* Sama laiusega kui ridade täpp ja rist, et kuupäevad jääksid ühte veergu. */}
            <span className="hidden w-6 shrink-0 sm:block" aria-hidden />
            <span className="hidden w-6 shrink-0 sm:block" aria-hidden />
          </form>

          {addFailed && (
            <p className="pt-2 text-sm text-destructive" role="alert">
              Taski ei saanud lisada. Proovi uuesti.
            </p>
          )}

          {isLoading ? (
            <Skeleton className="mt-4 h-40 w-full" />
          ) : hasError ? (
            <p className="py-5 text-sm text-destructive">
              Taske ei saanud laadida. Laadi leht uuesti.
            </p>
          ) : (
            <>
              {activeItems.length === 0 && (
                <p className="py-5 text-sm text-muted">
                  {filterDate
                    ? doneItems.length > 0
                      ? "Selle päeva taskid on tehtud."
                      : laterItems.length > 0
                        ? "Sellel päeval pole töös ühtegi taski."
                        : "Sellel päeval taske pole."
                    : doneItems.length > 0
                      ? "Kõik on tehtud."
                      : laterItems.length > 0
                        ? "Töös pole ühtegi taski."
                        : "Nimekiri on tühi. Kirjuta esimene task ülal olevale reale."}
                  {filterDate && (
                    <button
                      type="button"
                      onClick={() => setFilterDate("")}
                      className="ml-2 cursor-pointer text-accent-bright underline-offset-4 hover:underline"
                    >
                      Näita kõiki taske
                    </button>
                  )}
                </p>
              )}
              {/* Piir on näha alati, kui on midagi lohistada: see on ka tühjana sihtkoht. */}
              {openItems.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={listKeys} strategy={verticalListSortingStrategy}>
                    <ul className="divide-y divide-border/40">
                      {activeItems.map((item) => (
                        <SortableTaskRow key={item.key} item={item} later={false} />
                      ))}
                      <LaterDivider count={laterItems.length} />
                      {laterItems.map((item) => (
                        <SortableTaskRow key={item.key} item={item} later />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}
            </>
          )}
        </section>

        <aside className="shrink-0 border-t border-border/40 pt-4 lg:w-80 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0 xl:w-96">
          <ActiveProjects />

          <section aria-label="Tehtud taskid" className="mt-8">
            <div className="flex h-10 items-center justify-between gap-3 border-b border-border/40">
              <h3 className="text-sm font-medium text-foreground">Tehtud</h3>
              {ready && scoreTotal > 0 && (
                <span className="font-mono text-xs text-muted">
                  {scoreBadge(doneItems.length, scoreTotal)}
                </span>
              )}
            </div>
            {ready &&
              (doneItems.length === 0 ? (
                <p className="py-4 text-sm text-muted">Märgi task tehtuks ja see ilmub siia.</p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {doneItems.map((item) => (
                    <DoneTaskRow key={item.key} item={item} />
                  ))}
                </ul>
              ))}
          </section>
        </aside>
      </div>
    </Card>
  );
}
