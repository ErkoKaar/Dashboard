import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTasksClient } from "@/lib/supabase/tasksClient";

export type FsNodeType = "file" | "folder";

export interface FsNode {
  id: string;
  parent_id: string | null;
  name: string;
  type: FsNodeType;
  content: string | null;
  updated_at: string;
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
        .select("id, parent_id, name, type, content, updated_at")
        .order("name");

      if (error) throw error;
      return (data ?? []) as FsNode[];
    },
  });
}

export function useCreateFsNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { parentId: string | null; name: string; type: FsNodeType }): Promise<FsNode> => {
      const userId = await requireUserId();
      const { data, error } = await getTasksClient()
        .from("fs_nodes")
        .insert({
          user_id: userId,
          parent_id: input.parentId,
          name: input.name,
          type: input.type,
          content: input.type === "file" ? "" : null,
        })
        .select("id, parent_id, name, type, content, updated_at")
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
