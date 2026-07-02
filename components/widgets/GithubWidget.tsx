"use client";

import { useState } from "react";
import { GitCommitHorizontal } from "lucide-react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { chartTooltipStyle } from "@/components/ui/chartTheme";
import { useGithubContributions } from "@/lib/queries/useGithubContributions";

type Tab = "calendar" | "types" | "languages";

export function GithubWidget() {
  const [tab, setTab] = useState<Tab>("calendar");
  const { data, isLoading, error } = useGithubContributions();

  return (
    <Card className="col-span-12 xl:col-span-8">
      <div className="mb-4 flex items-center justify-between">
        <WidgetTitle icon={GitCommitHorizontal}>GitHub Contributions</WidgetTitle>
        <div className="flex gap-1">
          <TabButton active={tab === "calendar"} onClick={() => setTab("calendar")}>
            Kalender
          </TabButton>
          <TabButton active={tab === "types"} onClick={() => setTab("types")}>
            Tüübid
          </TabButton>
          <TabButton active={tab === "languages"} onClick={() => setTab("languages")}>
            Keeled
          </TabButton>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : error || !data ? (
        <p className="text-sm text-destructive">GitHubi andmete laadimine ebaõnnestus.</p>
      ) : tab === "calendar" ? (
        <div className="space-y-4">
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.monthlyCommits.map((d) => ({
                  day: parseInt(d.date.slice(8, 10), 10),
                  count: d.count,
                }))}
              >
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: "var(--muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip labelFormatter={(day) => `Päev ${day}`} contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex gap-6 text-sm">
            <p>
              Praegune streak:{" "}
              <span className="font-mono font-semibold text-foreground">{data.streak.current}</span> päeva
            </p>
            <p>
              Pikim streak:{" "}
              <span className="font-mono font-semibold text-foreground">{data.streak.longest}</span> päeva
            </p>
          </div>
        </div>
      ) : tab === "types" ? (
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { type: "Commits", value: data.contributionTypes.commits },
                { type: "Issues", value: data.contributionTypes.issues },
                { type: "PRs", value: data.contributionTypes.pullRequests },
                { type: "Reviews", value: data.contributionTypes.reviews },
                { type: "Repos", value: data.contributionTypes.repositories },
              ]}
            >
              <XAxis
                dataKey="type"
                tick={{ fontSize: 12, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "var(--surface-hover)" }} />
              <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ul className="space-y-1 text-sm">
          {data.languages.map((lang) => (
            <li key={lang.name} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lang.color }} />
              {lang.name} — {lang.percent}%
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
