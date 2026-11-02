import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { liveCam } from "../../liveCam";

/** Arrow keys slide the live battlefield the way the edit field does. Wheel, drag and the settings panel still own orbit, zoom and lens. */
export function LiveDrive() {
  const { camera, controls } = useThree();
  const keys = useRef(new Set<string>());
  const baseY = useRef<number | null>(null);
  const restored = useRef(0);

  useEffect(() => {
    const bag = keys.current;
    const down = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!event.key.startsWith("Arrow")) return;
      event.preventDefault();
      bag.add(event.key);
    };
    const up = (event: KeyboardEvent) => bag.delete(event.key);
    const blur = () => bag.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      bag.clear();
    };
  }, []);

  useFrame((_, dt) => {
    const orbit = controls as { target?: THREE.Vector3; update?: () => void } | null;
    const target = orbit?.target;
    if (!target) return;
    if (baseY.current == null) baseY.current = camera.position.y;
    if (restored.current !== liveCam.restore) {
      restored.current = liveCam.restore;
      camera.position.y = baseY.current;
    }
    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - liveCam.fov) > 0.01) {
      camera.fov = liveCam.fov;
      camera.updateProjectionMatrix();
    }
    if (liveCam.height != null) camera.position.y = liveCam.height;
    if (!keys.current.size) return;
    const e = camera.matrixWorld.elements;
    const rx = e[0];
    const rz = e[2];
    const fx = -e[8];
    const fz = -e[10];
    const fl = Math.hypot(fx, fz) || 1;
    const rl = Math.hypot(rx, rz) || 1;
    const dist = camera.position.distanceTo(target);
    const step = (22 + dist * 0.22) * Math.min(0.05, Math.max(0, dt)) * liveCam.speed;
    let mx = 0;
    let mz = 0;
    if (keys.current.has("ArrowUp")) {
      mx += fx / fl;
      mz += fz / fl;
    }
    if (keys.current.has("ArrowDown")) {
      mx -= fx / fl;
      mz -= fz / fl;
    }
    if (keys.current.has("ArrowLeft")) {
      mx -= rx / rl;
      mz -= rz / rl;
    }
    if (keys.current.has("ArrowRight")) {
      mx += rx / rl;
      mz += rz / rl;
    }
    const len = Math.hypot(mx, mz) || 1;
    const dx = (mx / len) * step;
    const dz = (mz / len) * step;
    camera.position.x += dx;
    camera.position.z += dz;
    target.x += dx;
    target.z += dz;
    orbit?.update?.();
  });

  return null;
}
