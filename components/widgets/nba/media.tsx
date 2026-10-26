"use client";

import { useState } from "react";

const ESPN_CDN = "https://a.espncdn.com/";

// ESPN-i pildid on suured (mängijapilt ~200 KB); CDN-i combiner lõikab need vajalikku mõõtu.
// Võõra hosti URL jääb puutumata.
export function espnImage(url: string, width: number, height: number): string {
  if (!url.startsWith(ESPN_CDN)) return url;
  const path = url.slice(ESPN_CDN.length - 1);
  return `${ESPN_CDN}combiner/i?img=${encodeURIComponent(path)}&w=${width}&h=${height}&scale=crop`;
}

/** Tiimi logo; nimi on alati kõrval tekstina, seega pilt on dekoratiivne. */
export function TeamLogo({ src, size = 24 }: { src: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="shrink-0" style={{ width: size, height: size }} aria-hidden />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={espnImage(src, size * 2, size * 2)}
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
      src={espnImage(src, size * 2, size * 2)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${frame} object-cover object-top`}
    />
  );
}
