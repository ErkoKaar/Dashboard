import { shiftDate } from "@/lib/date";
import type { NbaPeriod } from "@/lib/queries/useNba";

// Ajavahemik on NBA-l ja EuroLeague'il ühine. "season" on hooaja algusest tänaseni: alguse teab
// liiga adapter (NBA: ESPN-i mängupäevade kalender, EuroLeague: hooaja mängukava).

export const PERIOD_DAYS: Record<Exclude<NbaPeriod, "season">, number> = { today: 1, "3d": 3, "7d": 7, "30d": 30 };

const PERIODS: readonly NbaPeriod[] = ["today", "3d", "7d", "30d", "season"];

export function parsePeriod(value: string | null): NbaPeriod | null {
  return PERIODS.find((period) => period === value) ?? null;
}

/** Perioodi kuupäevad tänasest tagasi, uuemast vanemani (tänane kaasa). */
export function periodDates(today: string, period: Exclude<NbaPeriod, "season">): string[] {
  return Array.from({ length: PERIOD_DAYS[period] }, (_, i) => shiftDate(today, -i));
}
