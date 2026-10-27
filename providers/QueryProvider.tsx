"use client";

import { QueryClient, type Query } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider, removeOldestQuery } from "@tanstack/react-query-persist-client";
import { ReactNode, useState } from "react";
import type { League } from "@/lib/queries/useNba";

// Korvpallivaadete (NBA, EuroLeague, Est-Lat) andmed jäävad brauserisse alles: lehe uuel avamisel on
// mängud, parimad sooritused, MVP race ja tabel kohe näha ning värske seis tuleb taustal (andmed on
// taastamisel vananenud, nii et päringud käivad kohe uuesti). Boxscore'e ei salvestata, et maht ei
// kasvaks mängude kaupa.
const PERSISTED_LEAGUES: readonly League[] = ["nba", "euroleague", "estlat"];
const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;
// Muuda, kui mõne vastuse kuju muutub: vana salvestus visatakse siis ära, mitte ei näidata valel kujul.
const PERSIST_BUSTER = "v1";

function shouldPersist(query: Query): boolean {
  const [league, kind] = query.queryKey;
  return (
    query.state.status === "success" &&
    PERSISTED_LEAGUES.includes(league as League) &&
    kind !== "boxscore"
  );
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    // localStorage keelatud: andmed lihtsalt ei jää alles.
    return undefined;
  }
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient();
    // Mitteaktiivne päring kustutatakse mälust gcTime järel ja koos sellega ka salvestusest: liigavaade,
    // mida parasjagu pole lahti, peab alles jääma sama kaua kui salvestus.
    for (const league of PERSISTED_LEAGUES) client.setQueryDefaults([league], { gcTime: PERSIST_MAX_AGE });
    return client;
  });
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: browserStorage(),
      key: "dashboard-league-cache",
      // Kvoot täis: vanim päring visatakse välja ja proovitakse uuesti.
      retry: removeOldestQuery,
    }),
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        buster: PERSIST_BUSTER,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
