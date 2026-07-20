export function dailyScoreStatus(done: number, total: number): string {
  if (total === 0) return "Pole midagi täna";
  if (done === total) return "Kõik tehtud 🔥";
  if (done === 0) return "Alusta ühest";
  if (done / total >= 0.5) return "Poolel teel";
  return "Hea algus";
}

export function scoreBadge(done: number, total: number): string {
  if (total === 0) return "0/0";
  return `${done}/${total} · ${Math.round((done / total) * 100)}%`;
}
