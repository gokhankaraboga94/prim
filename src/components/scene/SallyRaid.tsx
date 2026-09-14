import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MAX_RAIDERS, raidCount, sallyLocal, sallyRaiderAt } from "../../siegeEvent";

const dummy = new THREE.Object3D();

function colorize(geo: THREE.BufferGeometry, hex: string) {
  const color = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}

function part(
  geo: THREE.BufferGeometry,
  hex: string,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0
) {
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  geo.translate(x, y, z);
  return colorize(geo, hex);
}

function createRaiderGeometry() {
  const pieces = [
    part(new THREE.BoxGeometry(0.16, 0.14, 0.22), "#1a1010", -0.09, 0.07, 0.03),
    part(new THREE.BoxGeometry(0.16, 0.14, 0.22), "#1a1010", 0.09, 0.07, 0.03),
    part(new THREE.BoxGeometry(0.13, 0.28, 0.14), "#2a1212", -0.09, 0.27, 0),
    part(new THREE.BoxGeometry(0.13, 0.28, 0.14), "#2a1212", 0.09, 0.27, 0),
    part(new THREE.BoxGeometry(0.4, 0.34, 0.24), "#9a1c1c", 0, 0.6, 0.01),
    part(new THREE.BoxGeometry(0.42, 0.26, 0.26), "#5c1414", 0, 0.86, 0.02),
    part(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 8), "#7a8288", 0, 1.04, 0),
    part(new THREE.SphereGeometry(0.1, 6, 5), "#c4a07a", 0, 1.13, 0.02),
    part(new THREE.ConeGeometry(0.17, 0.24, 8), "#b0b6bc", 0, 1.3, 0),
    part(new THREE.BoxGeometry(0.16, 0.22, 0.15), "#4a1818", 0.28, 0.82, 0.08, 0.2, 0, -0.4),
    part(new THREE.BoxGeometry(0.045, 0.95, 0.045), "#8a6a3a", 0.38, 1.05, 0.22, 0.7, 0, 0),
  ];
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  return merged ?? colorize(new THREE.BoxGeometry(0.4, 1.2, 0.28), "#9a1c1c");
}

function createDefendRaiderGeometry() {
  const red = "#d31c1c";
  const redDk = "#7a1212";
  const redMid = "#b01818";
  const helm = "#9a1616";
  const helmDk = "#5a0c0c";
  const skin = "#d4a57c";
  const skinDk = "#b88860";
  const boot = "#1a100c";
  const steel = "#c4c8ce";
  const leather = "#3a2218";
  const pieces = [
    part(new THREE.BoxGeometry(0.16, 0.12, 0.28), boot, -0.12, 0.06, 0.1),
    part(new THREE.BoxGeometry(0.16, 0.12, 0.28), boot, 0.12, 0.06, -0.12),
    part(new THREE.CylinderGeometry(0.055, 0.07, 0.38, 8), redDk, -0.12, 0.28, 0.08),
    part(new THREE.CylinderGeometry(0.055, 0.07, 0.38, 8), redDk, 0.12, 0.28, -0.1),
    part(new THREE.CylinderGeometry(0.072, 0.082, 0.36, 8), redMid, -0.12, 0.62, 0.04),
    part(new THREE.CylinderGeometry(0.072, 0.082, 0.36, 8), redMid, 0.12, 0.62, -0.06),
    part(new THREE.BoxGeometry(0.36, 0.18, 0.22), leather, 0, 0.82, 0),
    part(new THREE.BoxGeometry(0.4, 0.48, 0.26), red, 0, 1.12, 0.02),
    part(new THREE.BoxGeometry(0.36, 0.22, 0.12), redDk, 0, 1.18, 0.12),
    part(new THREE.SphereGeometry(0.09, 8, 6), redMid, -0.24, 1.32, 0),
    part(new THREE.SphereGeometry(0.09, 8, 6), redMid, 0.24, 1.32, 0),
    part(new THREE.CylinderGeometry(0.05, 0.058, 0.32, 8), redDk, -0.3, 1.1, 0.06, 0.35, 0, 0.35),
    part(new THREE.CylinderGeometry(0.05, 0.058, 0.32, 8), redDk, 0.32, 1.14, 0.08, 0.55, 0, -0.2),
    part(new THREE.CylinderGeometry(0.042, 0.048, 0.28, 8), skin, -0.36, 0.86, 0.16, 0.5, 0, 0.25),
    part(new THREE.CylinderGeometry(0.042, 0.048, 0.28, 8), skin, 0.4, 0.94, 0.28, 0.7, 0, -0.15),
    part(new THREE.SphereGeometry(0.05, 7, 6), skinDk, -0.4, 0.72, 0.26),
    part(new THREE.SphereGeometry(0.05, 7, 6), skinDk, 0.46, 0.8, 0.42),
    part(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 8), skin, 0, 1.38, 0.02),
    part(new THREE.SphereGeometry(0.13, 10, 8), skin, 0, 1.52, 0.04),
    part(new THREE.SphereGeometry(0.035, 6, 5), skinDk, 0, 1.48, 0.15),
    part(new THREE.SphereGeometry(0.145, 10, 8), helm, 0, 1.56, 0.02),
    part(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 10), helmDk, 0, 1.42, 0.04),
    part(new THREE.BoxGeometry(0.09, 0.028, 0.05), "#080202", -0.045, 1.52, 0.155),
    part(new THREE.BoxGeometry(0.09, 0.028, 0.05), "#080202", 0.045, 1.52, 0.155),
    part(new THREE.BoxGeometry(0.035, 0.035, 0.85), steel, 0.48, 0.82, 0.78),
    part(new THREE.BoxGeometry(0.12, 0.04, 0.04), "#c9a227", 0.48, 0.82, 0.42),
  ];
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  return merged ?? colorize(new THREE.BoxGeometry(0.4, 1.2, 0.28), red);
}

let raiderGeoCache: THREE.BufferGeometry | null = null;
let defendRaiderGeoCache: THREE.BufferGeometry | null = null;

export function getRaiderGeometry() {
  if (!raiderGeoCache) raiderGeoCache = createRaiderGeometry();
  return raiderGeoCache;
}

export function getDefendRaiderGeometry() {
  if (!defendRaiderGeoCache) defendRaiderGeoCache = createDefendRaiderGeometry();
  return defendRaiderGeoCache;
}

type SallyRaidProps = {
  soldiers: number;
  commanders?: number;
};

export function SallyRaid({ soldiers, commanders = 0 }: SallyRaidProps) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => getRaiderGeometry(), []);
  const n = raidCount(soldiers);
  const cap = Math.min(MAX_RAIDERS, Math.max(n, 1));

  useFrame((state) => {
    if (!bodies.current) return;
    const p = sallyLocal(state.clock.elapsedTime);
    if (n <= 0 || p < 2.4 || p >= 28.8) {
      bodies.current.count = 0;
      return;
    }
    let shown = 0;
    for (let i = 0; i < n; i++) {
      const r = sallyRaiderAt(p, i, n, commanders);
      if (!r.visible) continue;
      const step = !r.flung && r.fall < 1 ? Math.sin(state.clock.elapsedTime * 8 + i) * 0.05 * (1 - r.fall) : 0;
      dummy.position.set(r.x, (r.flung ? 0 : r.fall * 0.18) + r.y + step, r.z);
      dummy.rotation.set(
        r.fall * (r.flung ? 3.4 : 1.45),
        r.flung ? r.fall * 2.6 : 0,
        r.fall * (r.flung ? 2.1 : 0.35)
      );
      dummy.scale.setScalar(1.15);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(shown, dummy.matrix);
      shown += 1;
    }
    bodies.current.count = shown;
    bodies.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh key={cap} ref={bodies} args={[geo, undefined, cap]} frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.58} metalness={0.16} />
    </instancedMesh>
  );
}
