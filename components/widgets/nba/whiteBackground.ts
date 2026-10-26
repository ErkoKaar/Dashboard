"use client";

import { useEffect, useState } from "react";
import { optimizedImage } from "./media";

// Est-Lat liiga mängijafotod on stuudioportreed valgel taustal: taust eemaldatakse brauseris, et mängija
// istuks kaardil nagu NBA ja EuroLeague'i läbipaistvad väljalõiked. Lõuendilt saab piksleid lugeda ainult
// sama päritoluga pildist, seega käib foto läbi Next'i pildioptimeerija (next.config.mjs remotePatterns).

// Värvikaugus taustast: alla CLEAR_BELOW läbipaistev, SOLID_FROM-ini pehme üleminek (juuksed, servad).
const CLEAR_BELOW = 22;
const SOLID_FROM = 60;
// Täide ei liigu edasi pehme ülemineku keskelt: särgi valged ääred ja triibud jäävad alles.
const SPREAD_LIMIT = CLEAR_BELOW + (SOLID_FROM - CLEAR_BELOW) / 2;
// Ainult hele taust (nurkade järgi): muu fotoga ei tehta midagi, see näidatakse nagu on.
const MIN_BACKGROUND = 215;

/**
 * Täidab servadest (üla, vasak, parem; all on keha) taustaga ühendatud heledad pikslid läbipaistvaks.
 * Pooleldi läbipaistvatelt servapikslitelt võetakse taustavärv maha, et kaardile ei jääks valget kuma.
 */
function removeBackground(pixels: Uint8ClampedArray, width: number, height: number): boolean {
  const corners = [0, width - 1, 4 * width + 2, 5 * width - 3];
  const bg = [0, 1, 2].map((k) => corners.reduce((sum, p) => sum + pixels[p * 4 + k], 0) / corners.length);
  if (Math.min(...bg) < MIN_BACKGROUND) return false;
  const distance = (p: number) =>
    Math.hypot(pixels[p * 4] - bg[0], pixels[p * 4 + 1] - bg[1], pixels[p * 4 + 2] - bg[2]);

  const alpha = new Float32Array(width * height).fill(1);
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let x = 0; x < width; x++) stack.push(x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  for (let p = stack.pop(); p !== undefined; p = stack.pop()) {
    if (seen[p]) continue;
    seen[p] = 1;
    const d = distance(p);
    if (d >= SOLID_FROM) continue;
    alpha[p] = d <= CLEAR_BELOW ? 0 : (d - CLEAR_BELOW) / (SOLID_FROM - CLEAR_BELOW);
    if (d > SPREAD_LIMIT) continue;
    const x = p % width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (p >= width) stack.push(p - width);
    if (p < width * (height - 1)) stack.push(p + width);
  }

  for (let p = 0; p < alpha.length; p++) {
    const a = alpha[p];
    if (a >= 1) continue;
    const i = p * 4;
    if (a > 0) {
      for (let k = 0; k < 3; k++) pixels[i + k] = (pixels[i + k] - (1 - a) * bg[k]) / a;
    }
    pixels[i + 3] = Math.round(a * 255);
  }
  return true;
}

function loadImage(src: string, priority: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (priority) image.fetchPriority = "high";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Pilt ei laadinud"));
    image.src = src;
  });
}

// Valmis väljalõiked jäävad brauseri vahemällu (Cache Storage): järgmisel avamisel pole fotot vaja uuesti
// laadida ega töödelda. Versioon nimes: kui algoritm muutub, alustab uus nimi tühjalt.
const STORE = "estlat-cutouts-v1";
// Uued mängijad ja uuenenud fotod (uus aadress) lisanduvad: vanimad kaovad, et vahemälu ei kasvaks lõputult.
const STORE_LIMIT = 400;
const storeKey = (key: string) => new Request(`/__cutouts/${encodeURIComponent(key)}`);

async function fromStore(key: string): Promise<Blob | null> {
  try {
    const hit = await (await caches.open(STORE)).match(storeKey(key));
    return hit ? await hit.blob() : null;
  } catch {
    // Cache Storage puudub (privaatrežiim, ebaturvaline päritolu): töödeldakse iga kord.
    return null;
  }
}

async function toStore(key: string, blob: Blob): Promise<void> {
  try {
    const store = await caches.open(STORE);
    await store.put(storeKey(key), new Response(blob, { headers: { "content-type": blob.type } }));
    // Võtmed on lisamise järjekorras: üle piiri minnes kustuvad vanimad.
    const keys = await store.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - STORE_LIMIT)).map((request) => store.delete(request)));
  } catch {
    // Vahemälu on kiirendus, mitte eeldus.
  }
}

/** Läbipaistva taustaga pilt (blob-aadress); kui taust pole hele, siis foto ise. */
async function cutOut(src: string, width: number, priority: boolean): Promise<string | null> {
  const key = `${width}|${src}`;
  const stored = await fromStore(key);
  if (stored) return URL.createObjectURL(stored);

  // Kõrgem kvaliteet: JPEG-i müra servas teeks läbipaistvuse piiri sakiliseks.
  const image = await loadImage(optimizedImage(src, width, 90), priority);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  if (!removeBackground(data.data, canvas.width, canvas.height)) return image.src;
  context.putImageData(data, 0, 0);
  // WebP läbipaistvusega on ~8 korda väiksem kui PNG; Safari teeb WebP asemel PNG-i.
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) return null;
  void toStore(key, blob);
  return URL.createObjectURL(blob);
}

// Iga foto töödeldakse lehe eluea jooksul üks kord (sama mängija on mitmes kaardis ja vaates). Blob-aadresse
// ei vabastata: neid on kümneid, igaüks mõnikümmend KB.
const results = new Map<string, Promise<string | null>>();

/** Väljalõige (mälust, brauseri vahemälust või uus); sama foto korduv küsimine ootab sama tulemust. */
export function withoutBackground(src: string, width: number, priority = false): Promise<string | null> {
  const key = `${width}|${src}`;
  let result = results.get(key);
  if (!result) {
    result = cutOut(src, width, priority).catch(() => null);
    results.set(key, result);
  }
  return result;
}

/**
 * Valge taustata pildi aadress; töötlemise ajal ja vea korral null (pilti siis ei näidata). priority:
 * kaardi ülemine (esimesena nähtav) foto laaditakse enne teisi.
 */
export function useWithoutBackground(src: string | null, width: number, priority = false): string | null {
  const key = src ? `${width}|${src}` : null;
  const [done, setDone] = useState<{ key: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!key || !src) return;
    let current = true;
    withoutBackground(src, width, priority).then((url) => {
      if (current) setDone({ key, url });
    });
    return () => {
      current = false;
    };
  }, [key, src, width, priority]);

  return done && done.key === key ? done.url : null;
}
