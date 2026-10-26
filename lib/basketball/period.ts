import { shiftDate } from "@/lib/date";
import type { NbaGame, NbaGameDay, NbaPeriod } from "@/lib/queries/useNba";

// Ajavahemik on kõigil liigadel ühine. "season" on hooaja algusest tänaseni: alguse teab liiga
// adapter (NBA: ESPN-i mängupäevade kalender, Euroopa liigad: hooaja mängukava).

export const PERIOD_DAYS: Record<Exclude<NbaPeriod, "season">, number> = { today: 1, "3d": 3, "7d": 7, "30d": 30 };

const PERIODS: readonly NbaPeriod[] = ["today", "3d", "7d", "30d", "season"];

export function parsePeriod(value: string | null): NbaPeriod | null {
  return PERIODS.find((period) => period === value) ?? null;
}

/** Perioodi kuupäevad tänasest tagasi, uuemast vanemani (tänane kaasa). */
export function periodDates(today: string, period: Exclude<NbaPeriod, "season">): string[] {
  return Array.from({ length: PERIOD_DAYS[period] }, (_, i) => shiftDate(today, -i));
}

/**
 * Terve hooaja mängukavast perioodi mängupäevad, uuemast vanemani (Euroopa liigad, kus mängukava on
 * ühe päringuga käes). Tänane päev on alati kaasas; kui täna mänge pole, tuleb "Täna" alla ka järgmine
 * mängupäev, sest need liigad ei mängi iga päev.
 */
export function groupGameDays(games: NbaGame[], today: string, period: NbaPeriod): NbaGameDay[] {
  const byDay = new Map<string, NbaGame[]>();
  for (const game of games) byDay.set(game.gameDay, [...(byDay.get(game.gameDay) ?? []), game]);

  const dates =
    period === "season"
      ? [...new Set([today, ...[...byDay.keys()].filter((date) => date <= today)])].sort().reverse()
      : periodDates(today, period);
  const gamesOn = (date: string) =>
    (byDay.get(date) ?? []).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  const days: NbaGameDay[] = dates
    .map((date) => ({ date, games: gamesOn(date) }))
    .filter((day) => day.date === today || day.games.length > 0);

  if (period === "today" && days[0]?.games.length === 0) {
    const next = [...byDay.keys()].filter((date) => date > today).sort()[0];
    if (next) days.push({ date: next, games: gamesOn(next) });
  }
  return days;
}
