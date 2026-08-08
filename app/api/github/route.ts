import { NextResponse } from "next/server";

const QUERY = `
  query($monthFrom: DateTime!, $monthTo: DateTime!) {
    viewer {
      yearly: contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalRepositoryContributions
      }
      monthly: contributionsCollection(from: $monthFrom, to: $monthTo) {
        commitContributionsByRepository(maxRepositories: 25) {
          repository { name }
          contributions(first: 100) { nodes { occurredAt commitCount } }
        }
      }
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false, orderBy: {field: UPDATED_AT, direction: DESC}) {
        nodes {
          languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
            edges { size node { name color } }
          }
        }
      }
    }
  }
`;

interface GithubGraphQLResponse {
  data?: {
    viewer: {
      yearly: {
        contributionCalendar: {
          totalContributions: number;
          weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
        };
        totalCommitContributions: number;
        totalIssueContributions: number;
        totalPullRequestContributions: number;
        totalPullRequestReviewContributions: number;
        totalRepositoryContributions: number;
      };
      monthly: {
        commitContributionsByRepository: {
          repository: { name: string };
          contributions: {
            nodes: { occurredAt: string; commitCount: number }[];
          };
        }[];
      };
      repositories: {
        nodes: {
          languages: {
            edges: { size: number; node: { name: string; color: string | null } }[];
          } | null;
        }[];
      };
    };
  };
  errors?: { message: string }[];
}

function calculateStreaks(days: { date: string; count: number }[]) {
  let longest = 0;
  let running = 0;
  for (const day of days) {
    if (day.count > 0) {
      running++;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) {
      current++;
    } else if (days[i].date === today) {
      continue;
    } else {
      break;
    }
  }

  return { current, longest };
}

type CommitsByRepository = {
  repository: { name: string };
  contributions: { nodes: { occurredAt: string; commitCount: number }[] };
}[];

function buildMonthlyCommits(
  commitContributionsByRepository: CommitsByRepository,
  year: number,
  month: number,
): { date: string; count: number }[] {
  const byDate = new Map<string, number>();
  for (const repo of commitContributionsByRepository) {
    for (const node of repo.contributions.nodes) {
      const date = node.occurredAt.slice(0, 10);
      byDate.set(date, (byDate.get(date) ?? 0) + node.commitCount);
    }
  }

  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Array.from({ length: lastDay }, (_, i) => {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
    return { date, count: byDate.get(date) ?? 0 };
  });
}

function buildTodayCommitsByRepo(
  commitContributionsByRepository: CommitsByRepository,
  today: string,
): { repo: string; count: number }[] {
  const byRepo = new Map<string, number>();
  for (const repo of commitContributionsByRepository) {
    const count = repo.contributions.nodes
      .filter((node) => node.occurredAt.slice(0, 10) === today)
      .reduce((sum, node) => sum + node.commitCount, 0);
    if (count > 0) byRepo.set(repo.repository.name, (byRepo.get(repo.repository.name) ?? 0) + count);
  }
  return Array.from(byRepo.entries()).map(([repo, count]) => ({ repo, count }));
}

export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "GITHUB_TOKEN puudub" }, { status: 500 });
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const monthFrom = new Date(Date.UTC(year, month, 1)).toISOString();
  const monthTo = now.toISOString();

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: QUERY, variables: { monthFrom, monthTo } }),
    cache: "no-store",
  });

  const json: GithubGraphQLResponse = await res.json();

  if (!res.ok || json.errors || !json.data) {
    return NextResponse.json(
      { error: json.errors?.[0]?.message ?? "GitHub API viga" },
      { status: 502 },
    );
  }

  const { yearly, monthly, repositories } = json.data.viewer;
  const { contributionCalendar } = yearly;

  const calendar = contributionCalendar.weeks.flatMap((week) =>
    week.contributionDays.map((day) => ({ date: day.date, count: day.contributionCount })),
  );

  const streak = calculateStreaks(calendar);
  const monthlyCommits = buildMonthlyCommits(monthly.commitContributionsByRepository, year, month);
  const todayCommitsByRepo = buildTodayCommitsByRepo(monthly.commitContributionsByRepository, now.toISOString().slice(0, 10));

  const languageBytes = new Map<string, { color: string; bytes: number }>();
  for (const repo of repositories.nodes) {
    for (const edge of repo.languages?.edges ?? []) {
      const existing = languageBytes.get(edge.node.name);
      if (existing) {
        existing.bytes += edge.size;
      } else {
        languageBytes.set(edge.node.name, { color: edge.node.color ?? "#999999", bytes: edge.size });
      }
    }
  }

  const totalBytes = Array.from(languageBytes.values()).reduce((sum, l) => sum + l.bytes, 0);
  const languages = Array.from(languageBytes.entries())
    .map(([name, { color, bytes }]) => ({
      name,
      color,
      percent: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 8);

  return NextResponse.json({
    calendar,
    monthlyCommits,
    todayCommitsByRepo,
    totalContributions: contributionCalendar.totalContributions,
    streak,
    contributionTypes: {
      commits: yearly.totalCommitContributions,
      issues: yearly.totalIssueContributions,
      pullRequests: yearly.totalPullRequestContributions,
      reviews: yearly.totalPullRequestReviewContributions,
      repositories: yearly.totalRepositoryContributions,
    },
    languages,
  });
}
