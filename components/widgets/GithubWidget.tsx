"use client";

import { useState } from "react";
import {
  CircleDot,
  FolderGit2,
  GitCommit,
  GitCommitHorizontal,
  GitPullRequest,
  GitPullRequestArrow,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { chartTooltipStyle } from "@/components/ui/chartTheme";
import { useGithubContributions } from "@/lib/queries/useGithubContributions";

type Tab = "calendar" | "types" | "languages";

export function GithubWidget() {
  const [tab, setTab] = useState<Tab>("languages");
  const { data, isLoading, error } = useGithubContributions();

  return (
    <Card>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={GitCommitHorizontal} href="https://github.com/ErkoKaar">
          GitHub Contributions
        </WidgetTitle>
        <div className="flex gap-1">
          <TabButton active={tab === "languages"} onClick={() => setTab("languages")}>
            Keeled
          </TabButton>
          <TabButton active={tab === "calendar"} onClick={() => setTab("calendar")}>
            Kalender
          </TabButton>
          <TabButton active={tab === "types"} onClick={() => setTab("types")}>
            Tüübid
          </TabButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : error || !data ? (
        <p className="text-sm text-destructive">GitHubi andmete laadimine ebaõnnestus.</p>
      ) : tab === "calendar" ? (
        <div className="space-y-4">
          <div className="flex gap-8">
            <div>
              <p className="font-mono text-3xl font-semibold text-foreground">{data.streak.current}</p>
              <p className="text-xs text-muted">praegune streak (päeva)</p>
            </div>
            <div>
              <p className="font-mono text-3xl font-semibold text-foreground">{data.streak.longest}</p>
              <p className="text-xs text-muted">pikim streak (päeva)</p>
            </div>
          </div>

          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.monthlyCommits.map((d) => ({
                  day: parseInt(d.date.slice(8, 10), 10),
                  count: d.count,
                }))}
              >
                <defs>
                  <linearGradient id="githubCommitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: "var(--muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip labelFormatter={(day) => `Päev ${day}`} contentStyle={chartTooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#githubCommitGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : tab === "types" ? (
        <ul className="space-y-3">
          {[
            { icon: GitCommit, label: "Commits", value: data.contributionTypes.commits },
            { icon: CircleDot, label: "Issues", value: data.contributionTypes.issues },
            { icon: GitPullRequest, label: "PRs", value: data.contributionTypes.pullRequests },
            { icon: GitPullRequestArrow, label: "Reviews", value: data.contributionTypes.reviews },
            { icon: FolderGit2, label: "Repos", value: data.contributionTypes.repositories },
          ].map(({ icon: Icon, label, value }) => (
            <li key={label} className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-hover">
                <Icon className="h-4 w-4 text-accent" aria-hidden />
              </div>
              <span className="flex-1 text-sm text-foreground">{label}</span>
              <span className="font-mono text-sm font-semibold text-foreground">{value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3 text-sm">
          {data.languages.map((lang) => (
            <li key={lang.name}>
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lang.color }} />
                  {lang.name}
                </span>
                <span className="font-mono text-muted">{lang.percent}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-hover">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${lang.percent}%`, backgroundColor: lang.color }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      </div>
    </Card>
  );
}
