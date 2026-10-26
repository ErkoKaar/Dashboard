"use client";

import { useState } from "react";
import { NbaPeriod } from "@/lib/queries/useNba";
import { NbaGamesCard } from "./nba/NbaGamesCard";
import { NbaLeadersCard } from "./nba/NbaLeadersCard";
import { NbaMvpRace } from "./nba/NbaMvpRace";
import { RecapPlayerProvider } from "./nba/RecapPlayer";

type View = "games" | "mvp";

const VIEWS: { id: View; label: string }[] = [
  { id: "games", label: "Mängud" },
  { id: "mvp", label: "MVP race" },
];

const PERIODS: { id: NbaPeriod; label: string }[] = [
  { id: "today", label: "Täna" },
  { id: "3d", label: "3 päeva" },
  { id: "7d", label: "7 päeva" },
  { id: "30d", label: "Kuu" },
];

function PeriodSwitch({ period, onChange }: { period: NbaPeriod; onChange: (period: NbaPeriod) => void }) {
  const activeIndex = PERIODS.findIndex((p) => p.id === period);
  return (
    <div role="group" aria-label="Ajavahemik" className="liquid-glass grid w-full grid-cols-4 rounded-full p-1 sm:w-fit">
      <span
        className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-full bg-white/[0.12] shadow-[inset_0_1px_0_rgb(255_255_255/0.22)] transition-transform duration-[250ms] ease-[cubic-bezier(0.77,0,0.175,1)]"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
        aria-hidden
      />
      {PERIODS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={period === id}
          className={`relative cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright sm:py-1.5 ${
            period === id ? "text-foreground" : "text-muted hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Kaks vaadet: mängud (ajavahemik juhib mängude ja parimate soorituste kaarti) ja MVP race
// (alati terve hooaeg). Vaate nimed on suured display-sõnad, ajavahemik nende all teise taseme pill.
export function NbaWidget() {
  const [view, setView] = useState<View>("games");
  const [period, setPeriod] = useState<NbaPeriod>("today");

  return (
    <RecapPlayerProvider>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div role="group" aria-label="NBA vaade" className="flex items-baseline gap-5 sm:gap-7">
            {VIEWS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-pressed={view === id}
                className={`cursor-pointer rounded font-display text-3xl font-semibold tracking-[-0.03em] transition-colors duration-200 [font-stretch:85%] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-bright sm:text-4xl ${
                  view === id ? "text-foreground" : "text-muted/50 hover:text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {view === "games" && <PeriodSwitch period={period} onChange={setPeriod} />}
        </div>

        {view === "games" ? (
          <div className="grid grid-cols-12 items-start gap-5">
            {/* items-start: kaardid on oma sisu kõrgused. Parimate soorituste veerg on palju pikem, seega
                jääb mängude kaart laial ekraanil kerimisel paigale, et vasakule ei tekiks tühja ala. */}
            <div className="col-span-12 lg:sticky lg:top-6 lg:col-span-7">
              <NbaGamesCard period={period} />
            </div>
            <div className="col-span-12 lg:col-span-5">
              <NbaLeadersCard period={period} />
            </div>
          </div>
        ) : (
          <NbaMvpRace />
        )}
      </div>
    </RecapPlayerProvider>
  );
}
