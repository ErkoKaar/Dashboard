"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const SkyCanvas = dynamic(() => import("@/components/ui/SkyCanvas"), { ssr: false });

type SkyPhase = "night" | "morning" | "day" | "evening";

// [helendus, keskmine toon, sügavus] — kolmas hoiab taeva tumeda, et klaasil olev tekst loeks.
const PALETTES: Record<SkyPhase, readonly [string, string, string]> = {
  night: ["#27787f", "#1d3852", "#07131a"],
  morning: ["#b57965", "#3c5d75", "#0d1c26"],
  day: ["#54abb2", "#5a8a97", "#12303a"],
  evening: ["#b56a42", "#53333d", "#0d1a20"],
};

// Samad piirid mis getGreeting'il (lib/date.ts).
function skyPhase(hour: number): SkyPhase {
  if (hour < 5 || hour >= 23) return "night";
  if (hour < 11) return "morning";
  if (hour < 18) return "day";
  return "evening";
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return gl !== null;
  } catch {
    return false;
  }
}

export function SkyBackdrop() {
  // Kellaaeg loetakse alles kliendis, et serveri ajavöönd ei tekitaks hydration-viga.
  const [phase, setPhase] = useState<SkyPhase | null>(null);
  const [webgl, setWebgl] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setWebgl(supportsWebGL());

    const updatePhase = () => setPhase(skyPhase(new Date().getHours()));
    updatePhase();
    const interval = setInterval(updatePhase, 60_000);

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(motionQuery.matches);
    updateMotion();
    motionQuery.addEventListener("change", updateMotion);

    return () => {
      clearInterval(interval);
      motionQuery.removeEventListener("change", updateMotion);
    };
  }, []);

  if (!phase) return null;

  const colors = PALETTES[phase];
  const [glow, mid, deep] = colors;

  return (
    <div className="animate-sky-in pointer-events-none fixed inset-0 -z-10" aria-hidden>
      {/* Varuvariant ilma WebGL-ita ja seni, kuni shader laeb. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(90% 70% at 15% 15%, ${glow}66, transparent 60%), radial-gradient(80% 80% at 85% 90%, ${mid}88, transparent 65%), ${deep}`,
        }}
      />
      {webgl && <SkyCanvas colors={colors} animate={!reducedMotion} />}
      <div className="sky-vignette absolute inset-0" />
    </div>
  );
}
