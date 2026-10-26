"use client";

import { createContext, ReactNode, useContext } from "react";
import type { League } from "@/lib/queries/useNba";

// Mis vaate liigast sõltub: API tee, efektiivsuse nimi (NBA: EFF, EuroLeague: PIR) ja allmärkused.
// Kõik muu (paigutus, kaardid, videoaken) on mõlemal liigal sama.

export interface LeagueConfig {
  id: League;
  effLabel: string;
  effTitle: string;
  dayNote: string;
  /** Parimate soorituste allmärkuse lõpp (tühi = lisamärkust pole). */
  leadersNote: string;
  mvpNote: string;
}

const CONFIGS: Record<League, LeagueConfig> = {
  nba: {
    id: "nba",
    effLabel: "EFF",
    effTitle: "Efektiivsus",
    dayNote: "Mängupäevad USA aja järgi, kellaajad Eesti aja järgi.",
    leadersNote: "eelhooaja ja tähtede mänge mitte.",
    mvpNote:
      "Järjestus hooaja EFF järgi mängu kohta, ESPN-i kvalifitseerunud mängijad. Joon näitab EFF-i liidriga võrreldes. Ametlik NBA MVP edetabel on toimetuse hinnang ja võib sellest erineda.",
  },
  euroleague: {
    id: "euroleague",
    effLabel: "PIR",
    effTitle: "PIR, EuroLeague'i efektiivsus",
    dayNote: "Mängupäevad ja kellaajad Eesti aja järgi.",
    leadersNote: "",
    mvpNote:
      "Järjestus hooaja PIR-i järgi mängu kohta, mängijad, kes on mänginud vähemalt pooltes hooaja mängudest. Joon näitab PIR-i liidriga võrreldes. Ametlik MVP valik võib sellest erineda.",
  },
};

const LeagueContext = createContext<LeagueConfig>(CONFIGS.nba);

export function LeagueProvider({ league, children }: { league: League; children: ReactNode }) {
  return <LeagueContext.Provider value={CONFIGS[league]}>{children}</LeagueContext.Provider>;
}

export function useLeague(): LeagueConfig {
  return useContext(LeagueContext);
}
