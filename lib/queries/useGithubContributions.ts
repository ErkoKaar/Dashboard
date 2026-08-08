import { useQuery } from "@tanstack/react-query";

export interface GithubContributions {
  calendar: { date: string; count: number }[];
  monthlyCommits: { date: string; count: number }[];
  todayCommitsByRepo: { repo: string; count: number }[];
  totalContributions: number;
  streak: { current: number; longest: number };
  contributionTypes: {
    commits: number;
    issues: number;
    pullRequests: number;
    reviews: number;
    repositories: number;
  };
  languages: { name: string; color: string; percent: number }[];
}

export function useGithubContributions() {
  return useQuery({
    queryKey: ["github-contributions"],
    queryFn: async (): Promise<GithubContributions> => {
      const res = await fetch("/api/github");
      if (!res.ok) throw new Error("GitHub andmete laadimine ebaõnnestus");
      return res.json();
    },
  });
}
