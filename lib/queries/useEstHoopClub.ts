import { useQuery } from "@tanstack/react-query";

/** Mängija nii palju, kui rea kuvamiseks vaja: nimi ja pildi slug. */
export interface ClubPlayer {
  name: string;
  slug: string;
}

/** Tulevane klubimäng graafikust (app/api/esthoop-club-schedule). */
export interface ClubScheduleGame {
  id: string;
  /** Selle klubi Eesti koondislased. */
  players: ClubPlayer[];
  club: string;
  opponent: string;
  home: boolean;
  competition: string;
  /** Mängupäev ISO kujul ("2026-09-19"), juba Eesti aja järgi. */
  date: string;
  /** Null, kui kellaaeg pole veel avaldatud. */
  startTimestamp: number | null;
}

/** Peetud klubimäng ühe mängija vaatest (app/api/esthoop-club-results). */
export interface ClubResult {
  id: string;
  player: string;
  slug: string;
  club: string | null;
  opponent: string;
  league: string | null;
  /** Mängupäev ISO kujul ("2026-05-09"). */
  date: string;
  /** Skoorid mängija klubi vaatest. */
  own: number;
  against: number;
  home: boolean;
  won: boolean | null;
  /** ProBallersi protokoll; puuduv väärtus jääb reast välja. */
  pts: number | null;
  reb: number | null;
  ast: number | null;
  min: number | null;
  /** Link ProBallersi mänguprotokollile; vanematel ridadel puudub. */
  gameUrl: string | null;
}

// Mõlemad päringud käivad läbi serveri ja on seal vahemälus. Widget renderdab
// korraga ainult aktiivse tabi, nii et päring läheb alles selle avamisel.

export function useEstHoopClubSchedule() {
  return useQuery({
    queryKey: ["esthoop-club-schedule"],
    queryFn: async (): Promise<ClubScheduleGame[]> => {
      const res = await fetch("/api/esthoop-club-schedule");
      if (!res.ok) throw new Error("Klubigraafiku laadimine ebaõnnestus");
      const json = await res.json();
      return json.games;
    },
  });
}

export function useEstHoopClubResults() {
  return useQuery({
    queryKey: ["esthoop-club-results"],
    queryFn: async (): Promise<ClubResult[]> => {
      const res = await fetch("/api/esthoop-club-results");
      if (!res.ok) throw new Error("Klubitulemuste laadimine ebaõnnestus");
      const json = await res.json();
      return json.results;
    },
  });
}
