interface MeterSegment {
  value: number;
  color: string;
}

interface SegmentedMeterProps {
  segments: MeterSegment[];
  totalSegments?: number;
}

export function SegmentedMeter({ segments, totalSegments = 24 }: SegmentedMeterProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  const rawCounts = segments.map((s) => (total > 0 ? (s.value / total) * totalSegments : 0));
  const counts = rawCounts.map((n) => Math.round(n));
  const diff = totalSegments - counts.reduce((a, b) => a + b, 0);
  if (diff !== 0 && total > 0) {
    const largestIndex = rawCounts.indexOf(Math.max(...rawCounts));
    counts[largestIndex] += diff;
  }

  const cells: (string | null)[] = [];
  segments.forEach((s, i) => {
    for (let j = 0; j < Math.max(0, counts[i]); j++) cells.push(s.color);
  });
  while (cells.length < totalSegments) cells.push(null);

  return (
    <div className="flex gap-[3px]">
      {cells.slice(0, totalSegments).map((color, i) => (
        <div
          key={i}
          className={`h-3 flex-1 rounded-[1.5px] transition-colors duration-500 ${
            color ? "" : "bg-surface-hover/70"
          }`}
          style={color ? { backgroundColor: color } : undefined}
        />
      ))}
    </div>
  );
}
