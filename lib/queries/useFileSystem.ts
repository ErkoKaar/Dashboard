import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";

export type FsNodeType = "file" | "folder";

export interface FsNode {
  id: string;
  parent_id: string | null;
  name: string;
  type: FsNodeType;
  content: string | null;
  position: number;
  updated_at: string;
}

export interface FsNodeMove {
  id: string;
  parent_id: string | null;
  position: number;
}

const FS_KEY = ["fs-nodes"];

// Postgres unique_violation — sama nimega sõlm samas kaustas.
const UNIQUE_VIOLATION = "23505";

export class DuplicateNameError extends Error {
  constructor() {
    super("Sama nimega fail või kaust on selles kaustas juba olemas.");
    this.name = "DuplicateNameError";
  }
}

function translateError(error: { code?: string; message: string }): Error {
  if (error.code === UNIQUE_VIOLATION) return new DuplicateNameError();
  return new Error(error.message);
}

async function requireUserId() {
  const { data } = await getTasksClient().auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("Pole sisse logitud");
  return userId;
}

export function useFsNodes() {
  return useQuery({
    queryKey: FS_KEY,
    queryFn: async (): Promise<FsNode[]> => {
      const { data, error } = await getTasksClient()
        .from("fs_nodes")
        .select("id, parent_id, name, type, content, position, updated_at")
        .order("position")
        .order("name");

      if (error) throw error;
      return (data ?? []) as FsNode[];
    },
  });
}

export function useCreateFsNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      parentId: string | null;
      name: string;
      type: FsNodeType;
      position: number;
    }): Promise<FsNode> => {
      const userId = await requireUserId();
      const { data, error } = await getTasksClient()
        .from("fs_nodes")
        .insert({
          user_id: userId,
          parent_id: input.parentId,
          name: input.name,
          type: input.type,
          content: input.type === "file" ? "" : null,
          position: input.position,
        })
        .select("id, parent_id, name, type, content, position, updated_at")
        .single();

      if (error) throw translateError(error);
      return data as FsNode;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FS_KEY }),
  });
}

export function useRenameFsNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { error } = await getTasksClient()
        .from("fs_nodes")
        .update({ name: input.name, updated_at: new Date().toISOString() })
        .eq("id", input.id);

      if (error) throw translateError(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FS_KEY }),
  });
}

export function useDeleteFsNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Alamad kustuvad andmebaasis cascade'iga.
      const { error } = await getTasksClient().from("fs_nodes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FS_KEY }),
  });
}

// Lohistamine: uuendab korraga mitme sõlme kausta ja järjekorda.
export function useMoveFsNodes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (moves: FsNodeMove[]) => {
      const client = getTasksClient();
      const now = new Date().toISOString();
      const results = await Promise.all(
        moves.map((m) =>
          client
            .from("fs_nodes")
            .update({ parent_id: m.parent_id, position: m.position, updated_at: now })
            .eq("id", m.id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw translateError(failed.error);
    },
    // Optimistlik uuendus, et lohistatud rida ei hüppaks enne serveri vastust tagasi.
    onMutate: async (moves) => {
      await queryClient.cancelQueries({ queryKey: FS_KEY });
      const previous = queryClient.getQueryData<FsNode[]>(FS_KEY);
      if (previous) {
        const byId = new Map(moves.map((m) => [m.id, m]));
        queryClient.setQueryData<FsNode[]>(
          FS_KEY,
          previous.map((n) => {
            const move = byId.get(n.id);
            return move ? { ...n, parent_id: move.parent_id, position: move.position } : n;
          }),
        );
      }
      return { previous };
    },
    onError: (_err, _moves, context) => {
      if (context?.previous) queryClient.setQueryData(FS_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: FS_KEY }),
  });
}

export function useSaveFsFileContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; content: string }) => {
      const { error } = await getTasksClient()
        .from("fs_nodes")
        .update({ content: input.content, updated_at: new Date().toISOString() })
        .eq("id", input.id);

      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FS_KEY }),
  });
}

const SAVE_DELAY = 800;
// Oma salvestatud sisud: nende järgi eristatakse oma salvestust teises aknas tehtud muudatusest.
const OWN_SAVES_KEPT = 20;

export type FsSaveStatus = "idle" | "saving" | "saved";

/**
 * Faili sisu automaatne salvestus (File system ja dokumendivaade): 800 ms pärast viimast muudatust,
 * faili vahetamisel kohe. Sama faili saab muuta kahes aknas (dashboard ja /doc/<id>): kui serverist tuleb
 * sisu, mida see editor ise ei salvestanud, annab editorKey uue väärtuse ja editor laeb uue sisu. Oma
 * salvestamata muudatuse ajal seda ei tehta, siis jääb peale viimasena salvestatu.
 */
export function useAutosaveFsFile(file: FsNode) {
  const { mutate: saveContent, error } = useSaveFsFileContent();
  const [status, setStatus] = useState<FsSaveStatus>("idle");
  const [editorKey, setEditorKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Viimane salvestamata sisu, et faili vahetamisel muudatused kaduma ei läheks.
  const pendingRef = useRef<string | null>(null);
  const ownSavesRef = useRef<string[]>([file.content ?? ""]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pendingRef.current !== null) saveContent({ id: file.id, content: pendingRef.current });
    };
  }, [file.id, saveContent]);

  useEffect(() => {
    const content = file.content ?? "";
    if (pendingRef.current !== null || ownSavesRef.current.includes(content)) return;
    ownSavesRef.current = [content];
    setEditorKey((key) => key + 1);
  }, [file.content]);

  // Akna sulgemisel ei jõua pooleli salvestus alati kohale: brauser küsib enne üle.
  useEffect(() => {
    if (status !== "saving") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  const scheduleSave = useCallback(
    (html: string) => {
      setStatus("saving");
      pendingRef.current = html;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        pendingRef.current = null;
        ownSavesRef.current = [...ownSavesRef.current, html].slice(-OWN_SAVES_KEPT);
        saveContent(
          { id: file.id, content: html },
          // Vahepeal alanud uus muudatus jääb olekusse "saving" (ja hoiatus akna sulgemisel alles).
          {
            onSuccess: () => setStatus(pendingRef.current === null ? "saved" : "saving"),
            onError: () => setStatus(pendingRef.current === null ? "idle" : "saving"),
          },
        );
      }, SAVE_DELAY);
    },
    [file.id, saveContent],
  );

  return { status, error, scheduleSave, editorKey };
}
