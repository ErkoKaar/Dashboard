interface WeekStripProps {
  daily: { day: string; done: number; total: number }[];
}

export function WeekStrip({ daily }: WeekStripProps) {
  const todayIndex = (new Date().getDay() + 6) % 7;

  return (
    <div className="mb-4 flex justify-between">
      {daily.map((d, i) => {
        const rate = d.total > 0 ? d.done / d.total : 0;
        const isToday = i === todayIndex;
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div
              className={`h-2.5 w-2.5 rounded-full ${rate > 0 ? "bg-accent" : "bg-surface-hover"}`}
              style={rate > 0 ? { opacity: 0.35 + rate * 0.65 } : undefined}
            />
            <span
              className={`text-[10px] uppercase tracking-wide ${
                isToday ? "font-semibold text-foreground" : "text-muted"
              }`}
            >
              {d.day}
            </span>
          </div>
        );
      })}
    </div>
  );
}
