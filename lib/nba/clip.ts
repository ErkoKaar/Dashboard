import type { NbaGame, NbaRecapClip } from "@/lib/queries/useNba";

// Puhas abifunktsioon (ei sõltu React Queryst ega serverist): kasutavad nii espn.ts kui mängude kaart.
export function recapClip(game: NbaGame): NbaRecapClip | null {
  if (!game.youtube) return null;
  const side = (team: NbaGame["away"]) => (team.score === null ? team.name : `${team.name} ${team.score}`);
  return {
    videoId: game.youtube.videoId,
    title: `${side(game.away)}, ${side(game.home)}`,
    headline: game.recap?.headline ?? null,
    duration: game.youtube.duration,
  };
}
