import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { elfResetClock } from "../../elfReel";
import { ElfBattle, ElfCam } from "./ElfBattle";

export function ElfScene({ onReady }: { onReady?: (canvas: HTMLCanvasElement) => void }) {
  const boot = useRef(false);
  if (!boot.current) {
    boot.current = true;
    elfResetClock();
  }
  return (
    <Canvas
      dpr={1}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: "low-power",
        stencil: false,
        depth: true,
        preserveDrawingBuffer: true,
        failIfMajorPerformanceCaveat: false,
      }}
      camera={{ fov: 40, near: 0.25, far: 320, position: [14, 12, 36] }}
      frameloop="always"
      style={{ width: "100%", height: "100%", display: "block" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.enabled = false;
        gl.setPixelRatio(1);
        gl.setClearColor("#4a3728", 1);
        onReady?.(gl.domElement);
      }}
    >
      <color attach="background" args={["#4a3728"]} />
      <fog attach="fog" args={["#c8b089", 28, 160]} />
      <ElfBattle />
      <ElfCam />
    </Canvas>
  );
}
