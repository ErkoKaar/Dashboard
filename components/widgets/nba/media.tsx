"use client";

import { useState } from "react";

const ESPN_CDN = "https://a.espncdn.com/";
// EuroLeague'i mängijapildid (~450 KB) ja vapid: vähendab Next'i pildioptimeerija (next.config.mjs
// images.remotePatterns peab need hostid lubama).
const OPTIMIZED_HOSTS = new Set(["media-cdn.cortextech.io", "media-cdn.incrowdsports.com"]);
// Est-Lat liiga lehe enda pildivahemälu teeb sama faili soovitud mõõdus: ".../_400x400x1/..." (viimane
// number on lõikamise viis, see jääb samaks; ees võib olla räsi).
const ESTLAT_IMAGE = /^(https:\/\/www\.estlatbl\.com\/cache\/basket\/public\/remote\/[^/]+\/)[0-9a-f]*_\d+x\d+x(\d)(\/.+)$/;
// Next'i vaikimisi lubatud laiused (imageSizes + deviceSizes): optimeerija keeldub muudest.
const NEXT_IMAGE_WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];

/**
 * Pilt vajalikus mõõdus: ESPN-i pildid lõikab ESPN-i CDN-i combiner, Est-Lat liiga omad lehe enda
 * pildivahemälu, EuroLeague'i omad Next'i optimeerija (kõrguse järgib see ise). Võõra hosti URL jääb
 * puutumata.
 */
export function resizedImage(url: string, width: number, height: number): string {
  if (url.startsWith(ESPN_CDN)) {
    const path = url.slice(ESPN_CDN.length - 1);
    return `${ESPN_CDN}combiner/i?img=${encodeURIComponent(path)}&w=${width}&h=${height}&scale=crop`;
  }
  // Ruut: portree on ruudukujuline ja lõikamine ristkülikuks võtaks pea maha.
  const estlat = url.match(ESTLAT_IMAGE);
  if (estlat) {
    const side = Math.max(width, height);
    return `${estlat[1]}_${side}x${side}x${estlat[2]}${estlat[3]}`;
  }
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return url;
  }
  if (!OPTIMIZED_HOSTS.has(host)) return url;
  const allowed = NEXT_IMAGE_WIDTHS.find((w) => w >= width) ?? NEXT_IMAGE_WIDTHS[NEXT_IMAGE_WIDTHS.length - 1];
  return `/_next/image?url=${encodeURIComponent(url)}&w=${allowed}&q=75`;
}

/** Tiimi logo; nimi on alati kõrval tekstina, seega pilt on dekoratiivne. */
export function TeamLogo({ src, size = 24 }: { src: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="shrink-0" style={{ width: size, height: size }} aria-hidden />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resizedImage(src, size * 2, size * 2)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 object-contain"
    />
  );
}

export function Headshot({ src, size = 32 }: { src: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const frame = "shrink-0 rounded-full bg-white/[0.06] ring-1 ring-white/10";
  if (!src || failed) return <span className={frame} style={{ width: size, height: size }} aria-hidden />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resizedImage(src, size * 2, size * 2)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${frame} object-cover object-top`}
    />
  );
}
