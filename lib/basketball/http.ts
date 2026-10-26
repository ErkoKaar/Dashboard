// Ainult serveris (lib/nba, lib/euroleague, lib/basketball).

const RETRY_STATUSES = new Set([429, 503]);
const MAX_RETRIES = 2;

/**
 * Liiga paljude päringute (429) või ajutise rikke (503) korral kuni kaks kordust pausiga
 * (Retry-After, kuid mitte üle 3 s). EuroLeague'i API piirab päringuid hooaja arvutuse ajal.
 */
async function request(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    if (!RETRY_STATUSES.has(res.status) || attempt >= MAX_RETRIES) {
      throw new Error(`${new URL(url).host} vastas koodiga ${res.status}`);
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 3000) : 700 * (attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

export async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  return (await (await request(url, init)).json()) as T;
}

/** HTML-leht: Est-Lat liiga avalikku API-t ei paku. */
export async function fetchText(url: string, init: RequestInit): Promise<string> {
  return (await request(url, init)).text();
}

// Lingid lähevad otse href-i: ainult http(s), et vastusesse sattunud "javascript:" ei saaks käivituda.
export function safeUrl(value: string | undefined): string | null {
  return value && /^https?:\/\//i.test(value) ? value : null;
}

/** Nagu Promise.allSettled, aga korraga töös kuni `limit` päringut; ebaõnnestunu on null. */
export async function settleWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index]);
      } catch {
        results[index] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
