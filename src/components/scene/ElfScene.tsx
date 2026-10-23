import { useEffect, useRef } from "react";
import { createRoot } from "@react-three/fiber";
import * as THREE from "three";
import { elfResetClock } from "../../elfReel";
import { WEBGL_BLOCKED } from "../../webglOk";
import { ElfBattle, ElfCam } from "./ElfBattle";

type Root = ReturnType<typeof createRoot>;

export function ElfScene({
  onReady,
  onBlocked,
}: {
  onReady?: (canvas: HTMLCanvasElement) => void;
  onBlocked?: (msg: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  const blockedRef = useRef(onBlocked);
  const boot = useRef(false);
  readyRef.current = onReady;
  blockedRef.current = onBlocked;
  if (!boot.current) {
    boot.current = true;
    elfResetClock();
  }

  useEffect(() => {
    const box = host.current;
    if (!box) return;
    let dead = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let root: Root | null = null;
    let canvas: HTMLCanvasElement | null = null;
    const start = window.setTimeout(() => {
      if (dead || !host.current) return;
      const node = document.createElement("canvas");
      node.style.width = "100%";
      node.style.height = "100%";
      node.style.display = "block";
      host.current.appendChild(node);
      canvas = node;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas: node,
          antialias: false,
          alpha: false,
          depth: true,
          stencil: false,
          preserveDrawingBuffer: true,
          powerPreference: "default",
          failIfMajorPerformanceCaveat: false,
        });
      } catch {
        node.remove();
        canvas = null;
        blockedRef.current?.(WEBGL_BLOCKED);
        return;
      }
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = false;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor("#4a3728", 1);
      root = createRoot(node);
      const W = 720;
      const H = 1280;
      renderer.setSize(W, H, false);
      root.configure({
        dpr: 1,
        gl: renderer,
        camera: { fov: 32, near: 0.18, far: 280, position: [2.8, 1.8, -2] },
        frameloop: "always",
        size: { width: W, height: H, top: 0, left: 0 },
      });
      root.render(
        <>
          <color attach="background" args={["#4a3728"]} />
          <fog attach="fog" args={["#c8b089", 46, 130]} />
          <ElfBattle />
          <ElfCam />
        </>
      );
      readyRef.current?.(node);
    }, 80);
    return () => {
      dead = true;
      window.clearTimeout(start);
      try {
        root?.unmount();
      } catch {
        /* already gone */
      }
      renderer?.dispose();
      canvas?.remove();
    };
  }, []);

  return <div ref={host} style={{ width: "100%", height: "100%" }} />;
}
