"use client";

import { CSSProperties, useState } from "react";
import { useCountUp } from "@/lib/useCountUp";
import { useLeague } from "./league";
import { resizedImage } from "./media";
import { useWithoutBackground, withoutBackground } from "./whiteBackground";

// Parimate soorituste ja MVP race'i ühised osad: tiimivärv, mängija väljalõige, avatar, statistikariba.

// --- Tiimivärv ---

type Rgb = [number, number, number];
const SURFACE: Rgb = [5, 9, 12]; // --background
const ACCENT: Rgb = [16, 161, 180]; // --accent, kui ESPN värvi ei anna

function hexToRgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return a.map((value, i) => Math.round(value + (b[i] - value) * amount)) as Rgb;
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const rgbCss = (rgb: Rgb) => `rgb(${rgb.join(" ")})`;

// Kaart kannab valget teksti: peaaegu must tiimivärv (Nets #000000, Nuggets #0e2240) segatakse
// valgega, väga hele mustaga, et kontrast püsiks ja kaart ei kaoks tumeda tausta sisse.
function teamTone(hex: string | null): Rgb {
  const rgb = hex ? hexToRgb(hex) : ACCENT;
  const light = luminance(rgb);
  if (light < 0.02) return mix(rgb, [255, 255, 255], 0.3);
  if (light > 0.3) return mix(rgb, [0, 0, 0], 0.45);
  return rgb;
}

export function teamToneCss(hex: string | null): string {
  return rgbCss(teamTone(hex));
}

export function cardBackground(hex: string | null): CSSProperties {
  const tone = teamTone(hex);
  return {
    background: `linear-gradient(160deg, ${rgbCss(tone)} 0%, ${rgbCss(mix(tone, SURFACE, 0.5))} 75%, ${rgbCss(mix(tone, SURFACE, 0.7))} 100%)`,
  };
}

// --- Pildid ---

const CUTOUT_SIZES = { lg: [548, 400], sm: [330, 241] } as const;

/**
 * Mängija väljalõige kaardi paremas servas. Kutsuja annab key={src}: uus mängija saab uue
 * laadimiskatse, ka kui eelmise pilt puudus. Valge taustaga foto (Est-Lat) näidatakse alles siis, kui
 * brauser on tausta eemaldanud, et kaardile ei vilksataks valget ruutu. Suur kaart (liider, avatud MVP
 * kaart) on vaates esimene: selle foto laaditakse kohe ja enne teisi, väiksemad alles ekraanile jõudes.
 */
export function Cutout({ src, size }: { src: string; size: "lg" | "sm" }) {
  const { whitePhotoBackground } = useLeague();
  const [failed, setFailed] = useState(false);
  const [width, height] = CUTOUT_SIZES[size];
  const priority = size === "lg";
  const sized = resizedImage(src, width, height);
  const keyed = useWithoutBackground(whitePhotoBackground ? sized : null, width, priority);
  const shown = whitePhotoBackground ? keyed : sized;
  if (failed || !shown) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={shown}
      alt=""
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      onError={() => setFailed(true)}
      className="pointer-events-none absolute bottom-0 right-0 h-full w-auto max-w-[68%] object-contain object-right-bottom [mask-image:linear-gradient(to_right,transparent,#000_28%)]"
    />
  );
}

/** Laeb suure kaardi foto ette (MVP race'i eellaadimine), et vaate avamisel oleks see juba olemas. */
export function preloadCutout(src: string, whitePhotoBackground: boolean): void {
  const [width, height] = CUTOUT_SIZES.lg;
  const sized = resizedImage(src, width, height);
  if (whitePhotoBackground) void withoutBackground(sized, width);
  else new Image().src = sized;
}

/** Ümar pilt tiimivärvi taustal. Kutsuja annab key={headshot} samal põhjusel nagu Cutout'il. */
export function Avatar({ headshot, color }: { headshot: string | null; color: string | null }) {
  const { whitePhotoBackground } = useLeague();
  const [failed, setFailed] = useState(false);
  const sized = headshot ? resizedImage(headshot, 96, 96) : null;
  const keyed = useWithoutBackground(whitePhotoBackground ? sized : null, 96);
  const photo = failed ? null : whitePhotoBackground ? keyed : sized;
  return (
    <span
      className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15"
      style={{ background: teamToneCss(color) }}
      aria-hidden
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover object-top"
        />
      )}
    </span>
  );
}

// --- Numbrid ---

// Mõõdiku või vahemiku vahetusel loeb number vanast väärtusest uueni: muutus on näha, aga kaart ei liigu.
export function CountUpNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  return <>{useCountUp(value).toFixed(decimals)}</>;
}

export interface StatCell {
  label: string;
  title: string;
  value: string;
  active?: boolean;
}

/** Statistikariba. Veergude arv tuleb kutsujalt (columns), sest see sõltub kaardi laiusest. */
export function StatGrid({ cells, columns }: { cells: StatCell[]; columns: string }) {
  return (
    <dl className={`grid gap-px overflow-hidden rounded-xl ${columns}`}>
      {cells.map((cell) => (
        <div
          key={cell.label}
          className={`flex flex-col-reverse items-center gap-0.5 px-0.5 py-2 ${cell.active ? "bg-accent/25" : "bg-white/[0.05]"}`}
        >
          <dt className={`text-[10px] font-medium ${cell.active ? "text-accent-bright" : "text-muted"}`}>
            <abbr title={cell.title} className="no-underline">
              {cell.label}
            </abbr>
          </dt>
          {/* nowrap: "17-30" ei tohi telefoni ~38 px lahtris kahele reale murduda. */}
          <dd
            className={`whitespace-nowrap text-[11px] font-semibold tabular-nums sm:text-sm ${cell.active ? "text-foreground" : "text-foreground/85"}`}
          >
            {cell.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
