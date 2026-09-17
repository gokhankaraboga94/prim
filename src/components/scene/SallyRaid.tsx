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
  const helm = "#9a1616";
  const skin = "#d4a57c";
  const boot = "#1a100c";
  const steel = "#e8eef4";
  const pieces = [
    part(new THREE.BoxGeometry(0.16, 0.12, 0.26), boot, -0.11, 0.06, 0.08),
    part(new THREE.BoxGeometry(0.16, 0.12, 0.26), boot, 0.11, 0.06, -0.08),
    part(new THREE.BoxGeometry(0.13, 0.52, 0.14), redDk, -0.11, 0.38, 0.04),
    part(new THREE.BoxGeometry(0.13, 0.52, 0.14), redDk, 0.11, 0.38, -0.04),
    part(new THREE.BoxGeometry(0.38, 0.46, 0.24), red, 0, 0.96, 0.02),
    part(new THREE.BoxGeometry(0.12, 0.4, 0.12), redDk, -0.28, 0.9, 0.04),
    part(new THREE.BoxGeometry(0.12, 0.4, 0.12), redDk, 0.28, 0.9, 0.06),
    part(new THREE.BoxGeometry(0.22, 0.18, 0.2), skin, 0, 1.28, 0.03),
    part(new THREE.SphereGeometry(0.14, 6, 5), helm, 0, 1.48, 0.02),
    part(new THREE.BoxGeometry(0.16, 0.03, 0.05), "#080202", 0, 1.46, 0.14),
    part(new THREE.BoxGeometry(0.09, 0.08, 0.1), skin, 0.36, 0.86, 0.16),
    part(new THREE.BoxGeometry(0.036, 0.036, 1.55), steel, 0.4, 0.9, 0.92, 0.18, 0, 0.12),
    part(new THREE.ConeGeometry(0.028, 0.52, 7), "#f7f4ee", 0.51, 1.07, 1.84, Math.PI / 2 + 0.18, 0, 0.12),
  ];
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  return merged ?? colorize(new THREE.BoxGeometry(0.4, 1.2, 0.28), red);
}

let raiderGeoCache: THREE.BufferGeometry | null = null;
let defendRaiderSpearTipGeo: THREE.BufferGeometry | null = null;

export function getRaiderGeometry() {
  if (!raiderGeoCache) raiderGeoCache = createRaiderGeometry();
  return raiderGeoCache;
}

export function getDefendRaiderGeometry() {
  if (!defendRaiderSpearTipGeo) defendRaiderSpearTipGeo = createDefendRaiderGeometry();
  return defendRaiderSpearTipGeo;
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
