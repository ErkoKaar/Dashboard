import { useQuery } from "@tanstack/react-query";

export function useLatestEstHoopResult() {
  return useQuery({
    queryKey: ["latest-esthoop-result"],
    queryFn: async () => {
      // TODO: fetch latest result from EstHoop FastAPI GET endpoint (NEXT_PUBLIC_ESTHOOP_API_URL)
      return null;
    },
  });
}
