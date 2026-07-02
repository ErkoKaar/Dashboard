"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartTooltipStyle } from "@/components/ui/chartTheme";

interface WeeklyChartProps {
  daily: { day: string; done: number; total: number }[];
}

export function WeeklyChart({ daily }: WeeklyChartProps) {
  const data = daily.map((d) => ({
    day: d.day,
    rate: d.total > 0 ? Math.round((d.done / d.total) * 100) : 0,
  }));

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis domain={[0, 100]} hide />
          <Tooltip
            formatter={(value) => `${value}%`}
            contentStyle={chartTooltipStyle}
            cursor={{ fill: "var(--surface-hover)" }}
          />
          <Bar dataKey="rate" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
