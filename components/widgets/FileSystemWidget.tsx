"use client";

import { ComponentType, ReactNode, SVGProps, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderTree,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Card } from "@/components/ui/Card";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import {
  FsNode,
  FsNodeMove,
  FsNodeType,
  useCreateFsNode,
  useDeleteFsNode,
  useFsNodes,
  useMoveFsNodes,
  useRenameFsNode,
  useSaveFsFileContent,
} from "@/lib/queries/useFileSystem";

const SAVE_DELAY = 800;
const ROOT_KEY = "__root__";
const INDENT_PX = 16;

type ChildrenMap = Map<string, FsNode[]>;

function parentKey(parentId: string | null) {
  return parentId ?? ROOT_KEY;
}

// Käsitsi järjekord (position) ees; võrdse positsiooni korral (nt vanad read, kõik 0)
// kaustad enne faile ja tähestiku järjekorras.
function compareNodes(a: FsNode, b: FsNode) {
  if (a.position !== b.position) return a.position - b.position;
  if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
  return a.name.localeCompare(b.name, "et", { sensitivity: "base" });
}

function buildChildrenMap(nodes: FsNode[]): ChildrenMap {
  const map: ChildrenMap = new Map();
  for (const node of nodes) {
    const key = parentKey(node.parent_id);
    const list = map.get(key);
    if (list) list.push(node);
    else map.set(key, [node]);
  }
  map.forEach((list) => list.sort(compareNodes));
  return map;
}

function countDescendants(map: ChildrenMap, id: string): number {
  return (map.get(id) ?? []).reduce((sum, child) => sum + 1 + countDescendants(map, child.id), 0);
}

function nextPosition(map: ChildrenMap, parentId: string | null) {
  const siblings = map.get(parentKey(parentId)) ?? [];
  return siblings.length === 0 ? 0 : Math.max(...siblings.map((n) => n.position)) + 1;
}

// Kas `candidateId` on `ancestorId` ise või selle alamkaust (mistahes sügavusel).
function isSelfOrDescendant(byId: Map<string, FsNode>, candidateId: string | null, ancestorId: string) {
  let current = candidateId;
  while (current) {
    if (current === ancestorId) return true;
    current = byId.get(current)?.parent_id ?? null;
  }
  return false;
}

type DropMode = "before" | "after" | "into";

interface DropTarget {
  id: string; // sõlme id või ROOT_KEY (mode "into")
  mode: DropMode;
}

type MoveResolution = { moves: FsNodeMove[]; expandFolderId: string | null } | { error: string } | null;

// Arvutab, mis uuendused lohistamine kaasa toob. null = kehtetu või muutusteta sihtkoht.
function resolveMove(
  dragged: FsNode,
  target: DropTarget,
  childrenMap: ChildrenMap,
  byId: Map<string, FsNode>,
): MoveResolution {
  let newParentId: string | null;
  let insertIndex: number;

  if (target.id === ROOT_KEY) {
    newParentId = null;
    insertIndex = Number.MAX_SAFE_INTEGER;
  } else {
    const over = byId.get(target.id);
    if (!over || over.id === dragged.id) return null;
    if (target.mode === "into") {
      if (over.type !== "folder") return null;
      newParentId = over.id;
      insertIndex = Number.MAX_SAFE_INTEGER;
    } else {
      newParentId = over.parent_id;
      const siblings = (childrenMap.get(parentKey(newParentId)) ?? []).filter((n) => n.id !== dragged.id);
      insertIndex = siblings.findIndex((n) => n.id === over.id) + (target.mode === "after" ? 1 : 0);
    }
  }

  // Kausta ei saa tõsta iseenda ega oma alamkausta sisse.
  if (dragged.type === "folder" && isSelfOrDescendant(byId, newParentId, dragged.id)) return null;

  const siblings = (childrenMap.get(parentKey(newParentId)) ?? []).filter((n) => n.id !== dragged.id);
  if (newParentId !== dragged.parent_id && siblings.some((n) => n.name === dragged.name)) {
    return { error: `Sihtkaustas on juba "${dragged.name}".` };
  }

  const ordered = [...siblings];
  ordered.splice(Math.min(insertIndex, ordered.length), 0, dragged);
  const moves = ordered
    .map((n, i) => ({ id: n.id, parent_id: newParentId, position: i }))
    .filter((m) => {
      const current = byId.get(m.id)!;
      return current.parent_id !== m.parent_id || current.position !== m.position;
    });

  if (moves.length === 0) return null;
  return { moves, expandFolderId: newParentId };
}

interface IconButtonProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function IconButton({ icon: Icon, label, onClick, danger = false }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`shrink-0 cursor-pointer rounded p-1 text-muted transition-colors duration-200 hover:bg-surface-hover ${
        danger ? "hover:text-destructive" : "hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

interface NameInputProps {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

// Inline nime sisestus (uus sõlm või ümbernimetamine). Enter salvestab, Esc tühistab,
// blur salvestab. Guard tagab, et commit/cancel käivitub ainult korra.
function NameInput({ initial, onCommit, onCancel }: NameInputProps) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);

  function commit() {
    if (done.current) return;
    done.current = true;
    const name = value.trim();
    if (name) onCommit(name);
    else onCancel();
  }

  function cancel() {
    if (done.current) return;
    done.current = true;
    onCancel();
  }

  return (
    <input
      autoFocus
      value={value}
      maxLength={255}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") cancel();
      }}
      className="min-w-0 flex-1 border-b border-border bg-transparent text-sm text-foreground outline-none focus:border-accent"
    />
  );
}

interface FileEditorProps {
  file: FsNode;
}

function FileEditor({ file }: FileEditorProps) {
  const { mutate: saveContent, error: saveError } = useSaveFsFileContent();
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Viimane salvestamata sisu, et faili vahetamisel muudatused kaduma ei läheks.
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pendingRef.current !== null) saveContent({ id: file.id, content: pendingRef.current });
    };
  }, [file.id, saveContent]);

  function scheduleSave(html: string) {
    setStatus("saving");
    pendingRef.current = html;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      pendingRef.current = null;
      saveContent(
        { id: file.id, content: html },
        {
          onSuccess: () => setStatus("saved"),
          onError: () => setStatus("idle"),
        },
      );
    }, SAVE_DELAY);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
          <FileText className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          <span className="truncate">{file.name}</span>
        </span>
        <span className="shrink-0 font-mono text-xs text-muted">
          {status === "saving" ? "salvestamine..." : status === "saved" ? "salvestatud" : ""}
        </span>
      </div>

      <RichTextEditor content={file.content} onChange={scheduleSave} placeholder="Kirjuta faili sisu siia..." />

      {saveError && <p className="mt-2 text-sm text-destructive">Salvestamine ebaõnnestus.</p>}
    </div>
  );
}

interface TreeRowProps {
  node: FsNode;
  depth: number;
  isOpen: boolean;
  isSelected: boolean;
  isRenaming: boolean;
  dropMode: DropMode | null;
  onActivate: () => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onCreate: (type: FsNodeType) => void;
  onDelete: () => void;
}

function TreeRow({
  node,
  depth,
  isOpen,
  isSelected,
  isRenaming,
  dropMode,
  onActivate,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onCreate,
  onDelete,
}: TreeRowProps) {
  const { setNodeRef: setDragRef, listeners, isDragging } = useDraggable({ id: node.id });
  const { setNodeRef: setDropRef } = useDroppable({ id: node.id });
  const isFolder = node.type === "folder";
  const Icon = isFolder ? (isOpen ? FolderOpen : Folder) : FileText;
  const indent = depth * INDENT_PX + 4;

  return (
    <div
      ref={(el) => {
        setDragRef(el);
        setDropRef(el);
      }}
      data-fs-row={node.id}
      // Nime muutmise ajal ei tohi teksti valimine lohistamist käivitada.
      {...(isRenaming ? {} : listeners)}
      className={`group/row relative flex items-center gap-1.5 rounded-md py-1 pr-1 transition-colors duration-200 ${
        isSelected ? "bg-surface-hover text-foreground" : "text-muted hover:bg-surface-hover/50 hover:text-foreground"
      } ${isDragging ? "opacity-40" : ""} ${dropMode === "into" ? "bg-accent/10 ring-1 ring-accent" : ""}`}
      style={{ paddingLeft: indent }}
    >
      {(dropMode === "before" || dropMode === "after") && (
        <span
          className={`pointer-events-none absolute right-1 h-0.5 rounded-full bg-accent ${
            dropMode === "before" ? "-top-px" : "-bottom-px"
          }`}
          style={{ left: indent }}
          aria-hidden
        />
      )}
      {isRenaming ? (
        // Input ei tohi olla <button> sees, seetõttu eraldi haru.
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="w-3.5 shrink-0" />
          <Icon className={`h-4 w-4 shrink-0 ${isFolder ? "text-accent" : ""}`} aria-hidden />
          <NameInput initial={node.name} onCommit={onCommitRename} onCancel={onCancelRename} />
        </span>
      ) : (
        <button
          type="button"
          onClick={onActivate}
          onDoubleClick={onStartRename}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left text-sm"
        >
          {isFolder ? (
            <ChevronRight
              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
              aria-hidden
            />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <Icon className={`h-4 w-4 shrink-0 ${isFolder ? "text-accent" : ""}`} aria-hidden />
          <span className="truncate">{node.name}</span>
        </button>
      )}
      <span className="flex shrink-0 items-center opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover/row:opacity-100">
        {isFolder && (
          <>
            <IconButton icon={FilePlus} label="Uus fail" onClick={() => onCreate("file")} />
            <IconButton icon={FolderPlus} label="Uus kaust" onClick={() => onCreate("folder")} />
          </>
        )}
        <IconButton icon={Pencil} label="Muuda nime" onClick={onStartRename} />
        <IconButton icon={Trash2} label="Kustuta" danger onClick={onDelete} />
      </span>
    </div>
  );
}

// Lohistamise ajal puu all nähtav tsoon, kuhu kukutades läheb sõlm juurtasemele.
function RootDropZone({ active }: { active: boolean }) {
  const { setNodeRef } = useDroppable({ id: ROOT_KEY });
  return (
    <div
      ref={setNodeRef}
      className={`mt-2 rounded-md border border-dashed px-2 py-2 text-center text-xs transition-colors duration-200 ${
        active ? "border-accent bg-accent/10 text-accent" : "border-border text-muted/60"
      }`}
    >
      Tõsta juurkausta
    </div>
  );
}

function DragPreview({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-accent/40 bg-surface px-2 py-1 text-sm text-foreground shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]">
      {children}
    </div>
  );
}

interface CreatingState {
  parentId: string | null;
  type: FsNodeType;
}

export function FileSystemWidget() {
  const { data: nodes, isLoading, error: loadError } = useFsNodes();
  const createNode = useCreateFsNode();
  const renameNode = useRenameFsNode();
  const deleteNode = useDeleteFsNode();
  const moveNodes = useMoveFsNodes();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [creating, setCreating] = useState<CreatingState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  // Ref-peeglid, sest onDragEnd loeb neid väljaspool React'i renderdustsüklit.
  const dropTargetRef = useRef<DropTarget | null>(null);
  const pointerYRef = useRef(0);

  const childrenMap = useMemo(() => buildChildrenMap(nodes ?? []), [nodes]);
  const byId = useMemo(() => new Map((nodes ?? []).map((n) => [n.id, n] as const)), [nodes]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: PointerEvent) => {
      pointerYRef.current = e.clientY;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [dragId]);

  function updateDropTarget(target: DropTarget | null) {
    dropTargetRef.current = target;
    setDropTarget(target);
  }

  function handleDragStart(event: DragStartEvent) {
    setActionError(null);
    setCreating(null);
    setRenamingId(null);
    if (event.activatorEvent instanceof PointerEvent) pointerYRef.current = event.activatorEvent.clientY;
    setDragId(String(event.active.id));
    updateDropTarget(null);
  }

  function handleDragMove(event: DragMoveEvent) {
    const dragged = byId.get(String(event.active.id));
    const overId = event.over ? String(event.over.id) : null;
    if (!dragged || !overId) return updateDropTarget(null);

    let target: DropTarget;
    if (overId === ROOT_KEY) {
      target = { id: ROOT_KEY, mode: "into" };
    } else {
      const el = document.querySelector<HTMLElement>(`[data-fs-row="${overId}"]`);
      const over = byId.get(overId);
      if (!el || !over) return updateDropTarget(null);
      const rect = el.getBoundingClientRect();
      const ratio = rect.height > 0 ? (pointerYRef.current - rect.top) / rect.height : 0.5;
      // Kaust: ülemine veerand = enne, alumine veerand = pärast, keskel = sisse. Fail: pooleks.
      const mode: DropMode =
        over.type === "folder"
          ? ratio < 0.25
            ? "before"
            : ratio > 0.75
              ? "after"
              : "into"
          : ratio < 0.5
            ? "before"
            : "after";
      target = { id: overId, mode };
    }

    const resolution = resolveMove(dragged, target, childrenMap, byId);
    updateDropTarget(resolution && !("error" in resolution) ? target : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const dragged = byId.get(String(event.active.id));
    const target = dropTargetRef.current;
    setDragId(null);
    updateDropTarget(null);
    if (!dragged || !target) return;

    const resolution = resolveMove(dragged, target, childrenMap, byId);
    if (!resolution) return;
    if ("error" in resolution) return setActionError(resolution.error);

    if (resolution.expandFolderId) {
      const folderId = resolution.expandFolderId;
      setExpanded((prev) => new Set(prev).add(folderId));
    }
    moveNodes.mutate(resolution.moves, { onError: (e) => setActionError(e.message) });
  }

  function handleDragCancel() {
    setDragId(null);
    updateDropTarget(null);
  }
  // Kui valitud fail (või selle kaust) kustutati, kaob see nodes'ist ja editor tühjeneb ise.
  const selectedFile = nodes?.find((n) => n.id === selectedId && n.type === "file") ?? null;

  function toggleFolder(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startCreate(parentId: string | null, type: FsNodeType) {
    setActionError(null);
    setRenamingId(null);
    if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
    setCreating({ parentId, type });
  }

  function commitCreate(name: string) {
    if (!creating) return;
    const input = {
      parentId: creating.parentId,
      name,
      type: creating.type,
      position: nextPosition(childrenMap, creating.parentId),
    };
    setCreating(null);
    createNode.mutate(input, {
      onSuccess: (node) => {
        if (node.type === "file") setSelectedId(node.id);
      },
      onError: (e) => setActionError(e.message),
    });
  }

  function startRename(id: string) {
    setActionError(null);
    setCreating(null);
    setRenamingId(id);
  }

  function commitRename(node: FsNode, name: string) {
    setRenamingId(null);
    if (name === node.name) return;
    renameNode.mutate({ id: node.id, name }, { onError: (e) => setActionError(e.message) });
  }

  function handleDelete(node: FsNode) {
    setActionError(null);
    const count = node.type === "folder" ? countDescendants(childrenMap, node.id) : 0;
    const message =
      node.type === "folder"
        ? `Kustutada kaust "${node.name}"${count > 0 ? ` koos ${count} alamelemendiga` : ""}?`
        : `Kustutada fail "${node.name}"?`;
    if (!window.confirm(message)) return;
    deleteNode.mutate(node.id, { onError: (e) => setActionError(e.message) });
  }

  function renderLevel(parentId: string | null, depth: number) {
    const children = childrenMap.get(parentKey(parentId)) ?? [];
    const isCreatingHere = creating?.parentId === parentId;
    if (children.length === 0 && !isCreatingHere) return null;

    return (
      <ul>
        {isCreatingHere && creating && (
          <li className="flex items-center gap-1.5 py-1 pr-1" style={{ paddingLeft: depth * INDENT_PX + 4 }}>
            <span className="w-3.5 shrink-0" />
            {creating.type === "folder" ? (
              <Folder className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            )}
            <NameInput initial="" onCommit={commitCreate} onCancel={() => setCreating(null)} />
          </li>
        )}
        {children.map((node) => {
          const isOpen = node.type === "folder" && expanded.has(node.id);
          return (
            <li key={node.id}>
              <TreeRow
                node={node}
                depth={depth}
                isOpen={isOpen}
                isSelected={node.id === selectedId}
                isRenaming={renamingId === node.id}
                dropMode={dropTarget?.id === node.id ? dropTarget.mode : null}
                onActivate={() => (node.type === "folder" ? toggleFolder(node.id) : setSelectedId(node.id))}
                onStartRename={() => startRename(node.id)}
                onCommitRename={(name) => commitRename(node, name)}
                onCancelRename={() => setRenamingId(null)}
                onCreate={(type) => startCreate(node.id, type)}
                onDelete={() => handleDelete(node)}
              />
              {isOpen && renderLevel(node.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  }

  const isEmpty = (nodes?.length ?? 0) === 0 && !creating;
  const draggedNode = dragId ? (byId.get(dragId) ?? null) : null;

  return (
    <Card>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={FolderTree}>File system</WidgetTitle>
      </div>

      {isLoading ? (
        <Skeleton className="h-full min-h-[480px] w-full" />
      ) : loadError ? (
        <p className="text-sm text-destructive">Failide laadimine ebaõnnestus.</p>
      ) : (
        <div className="grid flex-1 grid-cols-12 gap-4 md:gap-6">
          <div className="col-span-12 flex min-h-0 flex-col md:col-span-4 md:border-r md:border-border/50 md:pr-4 lg:col-span-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted">Failid</span>
              <span className="flex items-center">
                <IconButton icon={FilePlus} label="Uus fail juurkausta" onClick={() => startCreate(null, "file")} />
                <IconButton icon={FolderPlus} label="Uus kaust juurkausta" onClick={() => startCreate(null, "folder")} />
              </span>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <div className="max-h-[560px] flex-1 overflow-y-auto">
                {isEmpty ? (
                  <p className="px-1 py-6 text-center text-xs text-muted/60">Faile pole. Loo esimene fail või kaust.</p>
                ) : (
                  renderLevel(null, 0)
                )}
                {dragId && <RootDropZone active={dropTarget?.id === ROOT_KEY} />}
              </div>
              <DragOverlay dropAnimation={null}>
                {draggedNode && (
                  <DragPreview>
                    {draggedNode.type === "folder" ? (
                      <Folder className="h-4 w-4 text-accent" aria-hidden />
                    ) : (
                      <FileText className="h-4 w-4 text-muted" aria-hidden />
                    )}
                    <span className="truncate">{draggedNode.name}</span>
                  </DragPreview>
                )}
              </DragOverlay>
            </DndContext>
            {actionError && <p className="mt-2 text-xs text-destructive">{actionError}</p>}
          </div>

          <div className="col-span-12 flex min-h-0 flex-col md:col-span-8 lg:col-span-9">
            {selectedFile ? (
              <FileEditor key={selectedFile.id} file={selectedFile} />
            ) : (
              <div className="flex min-h-[440px] flex-1 items-center justify-center rounded-lg border border-dashed border-border">
                <p className="text-sm text-muted">Vali vasakult fail või loo uus.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
