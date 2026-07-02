"use client";

import { useState } from "react";
import { ChessKnight } from "lucide-react";
import { Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { chartTooltipStyle } from "@/components/ui/chartTheme";
import { useChessStats, useChessTrend } from "@/lib/queries/useChess";

type Tab = "rating" | "trend" | "record";

const RECORD_COLORS = { win: "#34d399", loss: "#f87171", draw: "#8ca1ab" };

export function ChessWidget() {
  const [tab, setTab] = useState<Tab>("rating");
  const stats = useChessStats();
  const trend = useChessTrend();

  return (
    <Card className="col-span-12 md:col-span-6 xl:col-span-4">
      <div className="mb-4 flex items-center justify-between">
        <WidgetTitle icon={ChessKnight}>Chess</WidgetTitle>
        <div className="flex gap-1">
          <TabButton active={tab === "rating"} onClick={() => setTab("rating")}>
            Rating
          </TabButton>
          <TabButton active={tab === "trend"} onClick={() => setTab("trend")}>
            Trend
          </TabButton>
          <TabButton active={tab === "record"} onClick={() => setTab("record")}>
            W/L/D
          </TabButton>
        </div>
      </div>

      {tab === "rating" ? (
        stats.isLoading || !stats.data ? (
          <Skeleton className="h-24 w-full" />
        ) : stats.error ? (
          <p className="text-sm text-destructive">Chess.com andmete laadimine ebaõnnestus.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p>
              Praegune rating:{" "}
              <span className="font-mono font-semibold text-foreground">{stats.data.rating.current}</span>
            </p>
            <p>
              Parim rating:{" "}
              <span className="font-mono font-semibold text-foreground">{stats.data.rating.best}</span>
            </p>
          </div>
        )
      ) : tab === "trend" ? (
        trend.isLoading || !trend.data ? (
          <Skeleton className="h-32 w-full" />
        ) : trend.error ? (
          <p className="text-sm text-destructive">Chess.com andmete laadimine ebaõnnestus.</p>
        ) : (
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.data}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis domain={["auto", "auto"]} hide />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="rating" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      ) : stats.isLoading || !stats.data ? (
        <Skeleton className="h-32 w-full" />
      ) : stats.error ? (
        <p className="text-sm text-destructive">Chess.com andmete laadimine ebaõnnestus.</p>
      ) : (
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: "Võidud", value: stats.data.record.win },
                  { name: "Kaotused", value: stats.data.record.loss },
                  { name: "Viigid", value: stats.data.record.draw },
                ]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={50}
                stroke="var(--surface)"
              >
                <Cell fill={RECORD_COLORS.win} />
                <Cell fill={RECORD_COLORS.loss} />
                <Cell fill={RECORD_COLORS.draw} />
              </Pie>
              <Legend formatter={(value) => <span style={{ color: "var(--muted)" }}>{value}</span>} />
              <Tooltip contentStyle={chartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
