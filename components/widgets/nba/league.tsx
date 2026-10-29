"use client";

import { createContext, ReactNode, useContext } from "react";
import type { League } from "@/lib/queries/useNba";

// Mis vaate liigast sõltub: API tee, efektiivsuse nimi (NBA: EFF, EuroLeague: PIR, Est-Lat: EF,
// Europe Cup: FIBA EFF), mängijate edetabeli nimi, tabeli tsoonid ja allmärkused.
// Kõik muu (paigutus, kaardid, videoaken) on mõlemal liigal sama.

export interface LeagueConfig {
  id: League;
  effLabel: string;
  effTitle: string;
  dayNote: string;
  /** Parimate soorituste allmärkuse lõpp (tühi = lisamärkust pole). */
  leadersNote: string;
  /** Hooaja mängijate edetabeli nimi vaate valikus ja kaardi pealkirjas. */
  mvpLabel: string;
  mvpNote: string;
  /** Tabeli tsoonid: kohad 1..playoff pääsevad play-off'i, playoff+1..playIn play-in'i (null = play-in'i pole). */
  standingsZones: { playoff: number; playIn: number | null };
  /** Mängijafotod on valgel stuudiotaustal, mis eemaldatakse brauseris (Est-Lat); muudel on taust läbipaistev. */
  whitePhotoBackground: boolean;
  standingsNote: string;
}

const CONFIGS: Record<League, LeagueConfig> = {
  nba: {
    id: "nba",
    effLabel: "EFF",
    effTitle: "Efektiivsus",
    dayNote: "Mängupäevad USA aja järgi, kellaajad Eesti aja järgi.",
    leadersNote: "eelhooaja ja tähtede mänge mitte.",
    mvpLabel: "MVP race",
    mvpNote:
      "Järjestus hooaja EFF järgi mängu kohta, ESPN-i kvalifitseerunud mängijad. Joon näitab EFF-i liidriga võrreldes. Ametlik NBA MVP edetabel on toimetuse hinnang ja võib sellest erineda.",
    standingsZones: { playoff: 6, playIn: 10 },
    whitePhotoBackground: false,
    standingsNote:
      "Kohad 1-6 pääsevad otse play-off'i, 7-10 play-in'i. GB: mänge liidrist maas. Seeria: V võidud, K kaotused järjest.",
  },
  euroleague: {
    id: "euroleague",
    effLabel: "PIR",
    effTitle: "PIR, EuroLeague'i efektiivsus",
    dayNote: "Mängupäevad ja kellaajad Eesti aja järgi.",
    leadersNote: "",
    mvpLabel: "MVP race",
    mvpNote:
      "Järjestus hooaja PIR-i järgi mängu kohta, mängijad, kes on mänginud vähemalt pooltes hooaja mängudest. Joon näitab PIR-i liidriga võrreldes. Ametlik MVP valik võib sellest erineda.",
    standingsZones: { playoff: 6, playIn: 10 },
    whitePhotoBackground: false,
    standingsNote:
      "Kohad 1-6 pääsevad otse play-off'i, 7-10 play-in'i. Vorm: viimased 5 mängu, uusim paremal. Nool näitab koha muutust viimases voorus.",
  },
  estlat: {
    id: "estlat",
    effLabel: "EF",
    effTitle: "Efektiivsus, Est-Lat liiga ametlik",
    dayNote: "Mängupäevad ja kellaajad Eesti aja järgi.",
    leadersNote: "",
    mvpLabel: "MVP race",
    mvpNote:
      "Järjestus hooaja EF-i järgi mängu kohta, arvutatud mängude statistikast; mängijad, kes on mänginud vähemalt pooltes hooaja mängudest. Joon näitab EF-i liidriga võrreldes.",
    standingsZones: { playoff: 8, playIn: null },
    whitePhotoBackground: true,
    standingsNote: "Kohad 1-8 pääsevad play-off'i. Vorm: viimased 5 mängu, uusim paremal.",
  },
  // Ainult Pärnu, Tartu ja Kalevi mängud, nende gruppide tabelid ja nende mängijad (lib/europecup/api.ts).
  europecup: {
    id: "europecup",
    effLabel: "EFF",
    effTitle: "Efektiivsus, FIBA ametlik",
    dayNote: "Pärnu, Tartu ja Kalevi mängud. Mängupäevad ja kellaajad Eesti aja järgi.",
    leadersNote: "ainult Eesti klubide mängijad.",
    mvpLabel: "Parimad mängijad",
    mvpNote:
      "Pärnu, Tartu ja Kalevi mängijad, järjestus hooaja EFF-i järgi mängu kohta; mängijad, kes on mänginud vähemalt pooltes oma klubi mängudest. Joon näitab EFF-i liidriga võrreldes.",
    standingsZones: { playoff: 2, playIn: null },
    whitePhotoBackground: false,
    standingsNote: "Ainult grupid, kus mängivad Eesti klubid. Kohad 1-2 pääsevad edasi. Vorm: viimased 5 mängu, uusim paremal.",
  },
};

const LeagueContext = createContext<LeagueConfig>(CONFIGS.nba);

/** Liiga seaded väljaspool LeagueProvider'it (vaate valik on provideri kohal). */
export function leagueConfig(league: League): LeagueConfig {
  return CONFIGS[league];
}

export function LeagueProvider({ league, children }: { league: League; children: ReactNode }) {
  return <LeagueContext.Provider value={CONFIGS[league]}>{children}</LeagueContext.Provider>;
}

export function useLeague(): LeagueConfig {
  return useContext(LeagueContext);
}
