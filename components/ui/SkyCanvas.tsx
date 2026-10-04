"use client";

import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";

interface SkyCanvasProps {
  colors: readonly [string, string, string];
  animate: boolean;
}

// Laetakse ainult kliendis (next/dynamic, ssr: false) — three.js ei jõua esimesse renderisse.
// Sissetulek on siin, mitte SkyBackdropis, et see algaks alles siis, kui chunk on laetud.
export default function SkyCanvas({ colors, animate }: SkyCanvasProps) {
  return (
    <div className="animate-sky-canvas-in absolute inset-0">
      <ShaderGradientCanvas
        pixelDensity={1}
        pointerEvents="none"
        lazyLoad={false}
        style={{ position: "absolute", inset: 0 }}
      >
        <ShaderGradient
          control="props"
          enableTransition={false}
          type="plane"
          animate={animate ? "on" : "off"}
          uSpeed={0.05}
          uStrength={2}
          uDensity={1.3}
          uFrequency={5.5}
          uAmplitude={1}
          uTime={0}
          positionX={-1.4}
          positionY={0}
          positionZ={0}
          rotationX={0}
          rotationY={10}
          rotationZ={50}
          cAzimuthAngle={180}
          cPolarAngle={90}
          cDistance={2.8}
          cameraZoom={1.2}
          brightness={0.8}
          reflection={0.1}
          lightType="3d"
          grain="off"
          color1={colors[0]}
          color2={colors[1]}
          color3={colors[2]}
        />
      </ShaderGradientCanvas>
    </div>
  );
}
