import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RAID_X, sallyLocal, sallyRaiderAt } from "../../siegeEvent";

const RAIDERS = RAID_X.length;
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

export function SallyRaid() {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => createRaiderGeometry(), []);

  useFrame((state) => {
    if (!bodies.current) return;
    const p = sallyLocal(state.clock.elapsedTime);
    let n = 0;
    for (let i = 0; i < RAIDERS; i++) {
      const r = sallyRaiderAt(p, i);
      if (!r.visible) continue;
      const step = r.fall < 1 ? Math.sin(state.clock.elapsedTime * 14 + i) * 0.06 * (1 - r.fall) : 0;
      dummy.position.set(r.x, r.fall * 0.18 + step, r.z);
      dummy.rotation.set(r.fall * 1.45, 0, r.fall * 0.35);
      dummy.scale.setScalar(1.2);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(n, dummy.matrix);
      n += 1;
    }
    bodies.current.count = n;
    bodies.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={bodies} args={[geo, undefined, RAIDERS]} frustumCulled={false}>
      <meshLambertMaterial vertexColors />
    </instancedMesh>
  );
}
