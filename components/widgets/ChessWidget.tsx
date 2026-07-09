"use client";

import { useState } from "react";
import { ChessKnight } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { useChessStats, useChessTrend } from "@/lib/queries/useChess";
import { getCurrentWeekDates } from "@/lib/date";

type Tab = "rating" | "record";

const RECORD_COLORS = { win: "#34d399", loss: "#f87171", draw: "#8ca1ab" };

function RatingTab() {
  const stats = useChessStats();
  const trend = useChessTrend();

  if (stats.isLoading || !stats.data) return <Skeleton className="h-24 w-full" />;
  if (stats.error) return <p className="text-sm text-destructive">Chess.com andmete laadimine ebaõnnestus.</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-4xl font-semibold text-foreground">{stats.data.rating.current}</p>
        <p className="text-xs text-muted">praegune rating · parim {stats.data.rating.best}</p>
      </div>
      {trend.data && trend.data.length > 1 && (
        <div className="h-16 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend.data}>
              <YAxis domain={["auto", "auto"]} hide />
              <Line type="monotone" dataKey="rating" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function RecordBar({ win, loss, draw }: { win: number; loss: number; draw: number }) {
  const total = win + loss + draw;
  const winPct = total > 0 ? (win / total) * 100 : 0;
  const lossPct = total > 0 ? (loss / total) * 100 : 0;
  const drawPct = total > 0 ? (draw / total) * 100 : 0;

  return (
    <div>
      <p className="mb-1.5 font-mono text-sm font-semibold">
        <span style={{ color: RECORD_COLORS.win }}>{win}W</span>
        <span className="text-muted"> · </span>
        <span style={{ color: RECORD_COLORS.loss }}>{loss}L</span>
        <span className="text-muted"> · </span>
        <span style={{ color: RECORD_COLORS.draw }}>{draw}D</span>
      </p>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
        {total > 0 && (
          <>
            <div style={{ width: `${winPct}%`, backgroundColor: RECORD_COLORS.win }} />
            <div style={{ width: `${lossPct}%`, backgroundColor: RECORD_COLORS.loss }} />
            <div style={{ width: `${drawPct}%`, backgroundColor: RECORD_COLORS.draw }} />
          </>
        )}
      </div>
    </div>
  );
}

function RecordTab() {
  const stats = useChessStats();
  const trend = useChessTrend();

  if (stats.isLoading || !stats.data) return <Skeleton className="h-32 w-full" />;
  if (stats.error) return <p className="text-sm text-destructive">Chess.com andmete laadimine ebaõnnestus.</p>;

  const weekDates = new Set(getCurrentWeekDates().map((d) => d.date));
  const weeklyGames = (trend.data ?? []).filter((g) => weekDates.has(g.date));
  const weekly = {
    win: weeklyGames.filter((g) => g.result === "win").length,
    loss: weeklyGames.filter((g) => g.result === "loss").length,
    draw: weeklyGames.filter((g) => g.result === "draw").length,
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs text-muted">See nädal</p>
        <RecordBar win={weekly.win} loss={weekly.loss} draw={weekly.draw} />
      </div>
      <div>
        <p className="mb-2 text-xs text-muted">Kõik ajad</p>
        <RecordBar
          win={stats.data.record.win}
          loss={stats.data.record.loss}
          draw={stats.data.record.draw}
        />
      </div>
    </div>
  );
}

export function ChessWidget() {
  const [tab, setTab] = useState<Tab>("rating");

  return (
    <Card>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <WidgetTitle icon={ChessKnight}>Chess</WidgetTitle>
        <div className="flex gap-1">
          <TabButton active={tab === "rating"} onClick={() => setTab("rating")}>
            Rating
          </TabButton>
          <TabButton active={tab === "record"} onClick={() => setTab("record")}>
            W/L/D
          </TabButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "rating" ? <RatingTab /> : <RecordTab />}
      </div>
    </Card>
  );
}
