"use client";

import { useState } from "react";
import { ChessKnight } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabButton } from "@/components/ui/TabButton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { Readout } from "@/components/ui/Readout";
import { SegmentedMeter } from "@/components/ui/SegmentedMeter";
import { useChessStats, useChessTrend } from "@/lib/queries/useChess";
import { getCurrentWeekDates } from "@/lib/date";

type Tab = "rating" | "record";

const RECORD_COLORS = { win: "var(--positive)", loss: "var(--destructive)", draw: "var(--muted)" };

function RatingTab() {
  const stats = useChessStats();
  const trend = useChessTrend();

  if (stats.isLoading || !stats.data) return <Skeleton className="h-24 w-full" />;
  if (stats.error) return <p className="text-sm text-destructive">Chess.com andmete laadimine ebaõnnestus.</p>;

  return (
    <div className="space-y-4">
      <Readout
        value={stats.data.rating.current}
        label={`Rating · parim ${stats.data.rating.best}`}
        size="lg"
      />
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
  return (
    <div>
      <p className="mb-1.5 font-mono text-base font-semibold tabular-nums">
        <span style={{ color: RECORD_COLORS.win }}>{win}W</span>
        <span className="text-muted"> · </span>
        <span style={{ color: RECORD_COLORS.loss }}>{loss}L</span>
        <span className="text-muted"> · </span>
        <span style={{ color: RECORD_COLORS.draw }}>{draw}D</span>
      </p>
      <SegmentedMeter
        segments={[
          { value: win, color: RECORD_COLORS.win },
          { value: loss, color: RECORD_COLORS.loss },
          { value: draw, color: RECORD_COLORS.draw },
        ]}
      />
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
        <WidgetTitle icon={ChessKnight} href="https://www.chess.com">
          Chess
        </WidgetTitle>
        <div className="flex gap-1">
          <TabButton active={tab === "rating"} onClick={() => setTab("rating")}>
            Rating
          </TabButton>
          <TabButton active={tab === "record"} onClick={() => setTab("record")}>
            W/L/D
          </TabButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto pb-8">
        {tab === "rating" ? <RatingTab /> : <RecordTab />}
      </div>
    </Card>
  );
}
