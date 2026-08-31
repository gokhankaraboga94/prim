import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";

function makeWarOverlay() {
  const w = 540;
  const h = 960;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const wash = ctx.createLinearGradient(0, 0, w, h);
  wash.addColorStop(0, "rgba(28, 78, 72, 0.28)");
  wash.addColorStop(0.42, "rgba(0, 0, 0, 0)");
  wash.addColorStop(1, "rgba(150, 78, 22, 0.26)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  const vig = ctx.createRadialGradient(w / 2, h * 0.42, h * 0.1, w / 2, h * 0.48, h * 0.78);
  vig.addColorStop(0, "rgba(0, 0, 0, 0)");
  vig.addColorStop(0.5, "rgba(12, 10, 6, 0.06)");
  vig.addColorStop(1, "rgba(8, 6, 4, 0.58)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    if (d[i + 3] < 18) d[i + 3] = Math.min(18, d[i + 3] + 10);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Color wash + vignette + grain. Does not take over the render loop. */
export function WarGrade() {
  const size = useThree((s) => s.size);
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(makeWarOverlay());
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, []);

  return (
    <Hud renderPriority={2}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh position={[0, 0, 0]} renderOrder={40}>
        <planeGeometry args={[size.width, size.height]} />
        <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </Hud>
  );
}
