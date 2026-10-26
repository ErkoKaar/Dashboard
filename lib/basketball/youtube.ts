import { shiftDate } from "@/lib/date";
import type { NbaGame, NbaGameDay } from "@/lib/queries/useNba";

// Mänguülevaated YouTube'is (NBA: Motion Station, EuroLeague: MAGENTA SPORT, varuks EuroLeague'i kanal). Kanal ja
// pealkirja järgi sidumine tulevad liiga adapterilt; laadimine, RSS-varu ja kestused on ühised.

const RECAP_REVALIDATE = 600;
// Pikim vahemik on 30 päeva; üks päev varu, sest video ilmub järgmisel päeval (UTC). Hooaja
// vaates jäävad vanematel mängudel recapid ära.
const RECAP_LOOKBACK_DAYS = 31;
// 12 x 50 videot katab ka tiheda kanali kuu varuga.
const RECAP_MAX_PAGES = 12;
const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
const VIDEO_ID = /^[\w-]{11}$/;

export interface RecapVideo {
  id: string;
  title: string;
  publishedAt: string;
}

/** Võtmega: kõik viimase 31 päeva videod. Uusimad on playlistis eespool, seega peatub vanemani jõudes. */
async function fetchRecapVideosApi(channelId: string, apiKey: string, since: number): Promise<RecapVideo[]> {
  // Kanali üleslaadimiste playlist on sama id "UU" eesliitega.
  const playlistId = `UU${channelId.slice(2)}`;
  const videos: RecapVideo[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < RECAP_MAX_PAGES; page++) {
    const params = new URLSearchParams({ part: "snippet", playlistId, maxResults: "50" });
    if (pageToken) params.set("pageToken", pageToken);
    // Võti päises, mitte URL-is: nii ei satu see logidesse ega vahemälu võtme nähtavasse ossa.
    const res = await fetch(`${YOUTUBE_API}/playlistItems?${params}`, {
      headers: { "X-Goog-Api-Key": apiKey },
      next: { revalidate: RECAP_REVALIDATE },
    });
    if (!res.ok) throw new Error(`YouTube vastas koodiga ${res.status}`);
    const json = (await res.json()) as {
      nextPageToken?: string;
      items?: { snippet?: { title?: string; publishedAt?: string; resourceId?: { videoId?: string } } }[];
    };

    let reachedOld = false;
    for (const item of json.items ?? []) {
      const snippet = item.snippet;
      const id = snippet?.resourceId?.videoId;
      if (!id || !snippet?.title || !snippet.publishedAt) continue;
      if (Date.parse(snippet.publishedAt) < since) {
        reachedOld = true;
        continue;
      }
      videos.push({ id, title: snippet.title, publishedAt: snippet.publishedAt });
    }
    pageToken = json.nextPageToken;
    if (reachedOld || !pageToken) break;
  }
  return videos;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Võtmeta: kanali RSS annab 15 viimast videot. */
async function fetchRecapVideosRss(channelId: string): Promise<RecapVideo[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
    next: { revalidate: RECAP_REVALIDATE },
  });
  if (!res.ok) throw new Error(`YouTube RSS vastas koodiga ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap(([, entry]) => {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = entry.match(/<title>([^<]+)<\/title>/)?.[1];
    const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    return id && title && publishedAt ? [{ id, title: decodeXml(title), publishedAt }] : [];
  });
}

/**
 * Recap-videod ei tohi mängude laadimist kunagi murda: API vea (kvoot täis, vigane võti) korral
 * proovitakse RSS-i, selle vea korral jäävad recapid lihtsalt ära. apiKey on tagastatud ainult siis,
 * kui API päring õnnestus (kestuste jaoks).
 */
export async function getChannelVideos(
  channelId: string,
  today: string,
): Promise<{ videos: RecapVideo[]; apiKey: string | null }> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (apiKey) {
    try {
      const since = Date.parse(`${shiftDate(today, -RECAP_LOOKBACK_DAYS)}T00:00:00Z`);
      return { videos: await fetchRecapVideosApi(channelId, apiKey, since), apiKey };
    } catch {
      // langeb RSS-ile
    }
  }
  try {
    return { videos: await fetchRecapVideosRss(channelId), apiKey: null };
  } catch {
    return { videos: [], apiKey: null };
  }
}

// "PT2M44S" -> 164
function parseIsoDuration(value: string | undefined): number | null {
  const match = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const [, h = "0", m = "0", s = "0"] = match;
  const seconds = Number(h) * 3600 + Number(m) * 60 + Number(s);
  return seconds > 0 ? seconds : null;
}

/** Kestused on lisainfo: vea korral jäävad need lihtsalt puudu. */
async function fetchDurations(apiKey: string, ids: string[]): Promise<Map<string, number>> {
  const durations = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 50) {
    const params = new URLSearchParams({ part: "contentDetails", id: ids.slice(i, i + 50).join(",") });
    try {
      const res = await fetch(`${YOUTUBE_API}/videos?${params}`, {
        headers: { "X-Goog-Api-Key": apiKey },
        next: { revalidate: 86400 },
      });
      if (!res.ok) break;
      const json = (await res.json()) as { items?: { id?: string; contentDetails?: { duration?: string } }[] };
      for (const item of json.items ?? []) {
        const seconds = parseIsoDuration(item.contentDetails?.duration);
        if (item.id && seconds) durations.set(item.id, seconds);
      }
    } catch {
      break;
    }
  }
  return durations;
}

/**
 * Seob videod lõppenud mängudega. `find` on liiga reegel (pealkirja kuju); siin kontrollitakse
 * ainult, et video id on kehtiv ja video avaldati pärast mängu algust (sama paar kuu eest ei sobi).
 * Juba videoga mäng jääb puutumata: teise kanali kutse täidab ainult puuduvad.
 */
export function attachRecaps(
  days: NbaGameDay[],
  videos: RecapVideo[],
  find: (game: NbaGame, candidates: RecapVideo[]) => RecapVideo | undefined,
): NbaGameDay[] {
  const valid = videos.filter((video) => VIDEO_ID.test(video.id));
  return days.map((day) => ({
    ...day,
    games: day.games.map((game) => {
      if (!game.completed || game.youtube) return game;
      const after = valid.filter((video) => Date.parse(video.publishedAt) >= Date.parse(game.startTime));
      const found = find(game, after);
      if (!found) return game;
      return {
        ...game,
        youtube: { url: `https://www.youtube.com/watch?v=${found.id}`, videoId: found.id, duration: null },
      };
    }),
  }));
}

/** Teine samm (ainult API võtmega): kestused küsitakse ainult mängudega seotud videotele. */
export async function withDurations(days: NbaGameDay[], apiKey: string): Promise<NbaGameDay[]> {
  const ids = days.flatMap((day) => day.games.flatMap((game) => (game.youtube ? [game.youtube.videoId] : [])));
  const durations = await fetchDurations(apiKey, ids);
  if (durations.size === 0) return days;
  return days.map((day) => ({
    ...day,
    games: day.games.map((game) => {
      const duration = game.youtube ? durations.get(game.youtube.videoId) : undefined;
      return duration && game.youtube ? { ...game, youtube: { ...game.youtube, duration } } : game;
    }),
  }));
}
