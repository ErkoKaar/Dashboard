import type { NbaBoxscore } from "@/lib/queries/useNba";

/**
 * Lõppenud mängu boxscore enne igavesse vahemällu panekut (kõik liigad). Andmeallikas võib kohe pärast
 * mängu anda tiimid ilma mängijateta või nullidega; selline boxscore jääks muidu vahemällu igaveseks
 * ja mängu statistika puuduks ka järgmistel päevadel. Iga tiimi mängijatel peab olema punkte (lõppenud
 * mängus on igal tiimil), muidu visatakse viga: unstable_cache vigu ei salvesta, nii et järgmine
 * päring proovib uuesti.
 */
export function assertCompleteBoxscore(boxscore: NbaBoxscore): NbaBoxscore {
  if (boxscore.teams.length < 2) throw new Error("Boxscore puudub");
  for (const team of boxscore.teams) {
    if (!team.players.some((player) => player.pts > 0)) {
      throw new Error(`Boxscore pole veel täielik (${team.abbreviation})`);
    }
  }
  return boxscore;
}
