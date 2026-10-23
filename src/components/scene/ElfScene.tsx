import { useLayoutEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { elfResetClock } from "../../elfReel";
import { ElfBattle, ElfCam } from "./ElfBattle";

const ELF_W = 720;
const ELF_H = 1280;

function LockReelBuffer() {
  const gl = useThree((s) => s.gl);
  const set = useThree((s) => s.set);
  useLayoutEffect(() => {
    gl.setPixelRatio(1);
    gl.setSize(ELF_W, ELF_H, false);
    set({ size: { width: ELF_W, height: ELF_H, top: 0, left: 0 } });
  }, [gl, set]);
  useFrame(() => {
    if (gl.domElement.width === ELF_W && gl.domElement.height === ELF_H) return;
    gl.setPixelRatio(1);
    gl.setSize(ELF_W, ELF_H, false);
    set({ size: { width: ELF_W, height: ELF_H, top: 0, left: 0 } });
  });
  return null;
}

export function ElfScene({ onReady }: { onReady?: (canvas: HTMLCanvasElement) => void; onBlocked?: (msg: string) => void }) {
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
        powerPreference: "default",
        stencil: false,
        depth: true,
        preserveDrawingBuffer: true,
        failIfMajorPerformanceCaveat: false,
      }}
      camera={{ fov: 32, near: 0.18, far: 280, position: [2.8, 1.8, -2] }}
      frameloop="always"
      style={{ width: "100%", height: "100%", display: "block" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.enabled = false;
        gl.setPixelRatio(1);
        gl.setSize(ELF_W, ELF_H, false);
        gl.setClearColor("#4a3728", 1);
        onReady?.(gl.domElement);
      }}
    >
      <LockReelBuffer />
      <color attach="background" args={["#4a3728"]} />
      <fog attach="fog" args={["#c8b089", 46, 130]} />
      <ElfBattle />
      <ElfCam />
    </Canvas>
  );
}
