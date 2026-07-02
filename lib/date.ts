const WEEKDAY_LABELS = ["E", "T", "K", "N", "R", "L", "P"];

export interface WeekDay {
  date: string;
  label: string;
}

export function getCurrentWeekDates(): WeekDay[] {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  return WEEKDAY_LABELS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: d.toISOString().slice(0, 10), label };
  });
}

export function nextDate(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function toDayRange(date: string): { start: string; end: string } {
  return { start: `${date}T00:00:00.000Z`, end: `${nextDate(date)}T00:00:00.000Z` };
}

export function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  return { start, end };
}
