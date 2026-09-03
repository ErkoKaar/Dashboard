"use client";

import { ComponentType, SVGProps, useEffect, useMemo, useRef, useState } from "react";
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
import { Card } from "@/components/ui/Card";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import {
  FsNode,
  FsNodeType,
  useCreateFsNode,
  useDeleteFsNode,
  useFsNodes,
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

function compareNodes(a: FsNode, b: FsNode) {
  if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
  return a.name.localeCompare(b.name, "et", { sensitivity: "base" });
}

// Kaustad enne faile, mõlemad tähestiku järjekorras.
function buildChildrenMap(nodes: FsNode[]): ChildrenMap {
  const map: ChildrenMap = new Map();
  for (const node of nodes) {
    const key = parentKey(node.parent_id);
    const list = map.get(key);
    if (list) list.push(node);
    else map.set(key, [node]);
  }
  for (const list of map.values()) list.sort(compareNodes);
  return map;
}

function countDescendants(map: ChildrenMap, id: string): number {
  return (map.get(id) ?? []).reduce((sum, child) => sum + 1 + countDescendants(map, child.id), 0);
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

interface CreatingState {
  parentId: string | null;
  type: FsNodeType;
}

export function FileSystemWidget() {
  const { data: nodes, isLoading, error: loadError } = useFsNodes();
  const createNode = useCreateFsNode();
  const renameNode = useRenameFsNode();
  const deleteNode = useDeleteFsNode();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [creating, setCreating] = useState<CreatingState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const childrenMap = useMemo(() => buildChildrenMap(nodes ?? []), [nodes]);
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
    const input = { parentId: creating.parentId, name, type: creating.type };
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
          const isFolder = node.type === "folder";
          const isOpen = isFolder && expanded.has(node.id);
          const isSelected = node.id === selectedId;
          const Icon = isFolder ? (isOpen ? FolderOpen : Folder) : FileText;

          return (
            <li key={node.id}>
              <div
                className={`group/row flex items-center gap-1.5 rounded-md py-1 pr-1 transition-colors duration-200 ${
                  isSelected ? "bg-surface-hover text-foreground" : "text-muted hover:bg-surface-hover/50 hover:text-foreground"
                }`}
                style={{ paddingLeft: depth * INDENT_PX + 4 }}
              >
                {renamingId === node.id ? (
                  // Input ei tohi olla <button> sees, seetõttu eraldi haru.
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="w-3.5 shrink-0" />
                    <Icon className={`h-4 w-4 shrink-0 ${isFolder ? "text-accent" : ""}`} aria-hidden />
                    <NameInput
                      initial={node.name}
                      onCommit={(name) => commitRename(node, name)}
                      onCancel={() => setRenamingId(null)}
                    />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => (isFolder ? toggleFolder(node.id) : setSelectedId(node.id))}
                    onDoubleClick={() => startRename(node.id)}
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
                      <IconButton icon={FilePlus} label="Uus fail" onClick={() => startCreate(node.id, "file")} />
                      <IconButton icon={FolderPlus} label="Uus kaust" onClick={() => startCreate(node.id, "folder")} />
                    </>
                  )}
                  <IconButton icon={Pencil} label="Muuda nime" onClick={() => startRename(node.id)} />
                  <IconButton icon={Trash2} label="Kustuta" danger onClick={() => handleDelete(node)} />
                </span>
              </div>
              {isOpen && renderLevel(node.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  }

  const isEmpty = (nodes?.length ?? 0) === 0 && !creating;

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
            <div className="max-h-[560px] flex-1 overflow-y-auto">
              {isEmpty ? (
                <p className="px-1 py-6 text-center text-xs text-muted/60">Faile pole. Loo esimene fail või kaust.</p>
              ) : (
                renderLevel(null, 0)
              )}
            </div>
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
