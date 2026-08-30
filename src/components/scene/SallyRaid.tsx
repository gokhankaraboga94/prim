import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { sallyLocal, sallyMarch, sallyThrowAt } from "../../siegeEvent";

const RAIDERS = 4;
const dummy = new THREE.Object3D();
const look = new THREE.Vector3();
const XS = [-3.6, -1.2, 1.2, 3.6];

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

type SallyRaidProps = {
  level: number;
};

export function SallyRaid({ level }: SallyRaidProps) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const spears = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => createRaiderGeometry(), []);
  const grow = 1 + Math.min(0.35, (level - 1) * 0.02);
  const sz = 2.15 * grow;

  useFrame((state) => {
    const p = sallyLocal(state.clock.elapsedTime);
    const march = sallyMarch(p);
    const insideZ = 12.2 * sz;
    const outZ = 26;
    const scale = 1.15 * grow;

    if (bodies.current) {
      const show = march > 0.02;
      bodies.current.count = show ? RAIDERS : 0;
      if (show) {
        for (let i = 0; i < RAIDERS; i++) {
          dummy.position.set(XS[i], 0, insideZ + (outZ - insideZ) * march);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(scale);
          dummy.updateMatrix();
          bodies.current.setMatrixAt(i, dummy.matrix);
        }
        bodies.current.instanceMatrix.needsUpdate = true;
      }
    }

    if (!spears.current) return;
    let n = 0;
    for (let i = 0; i < RAIDERS; i++) {
      const born = sallyThrowAt(p, i);
      const fly = (p - born) / 1.15;
      if (fly < 0 || fly > 1 || march < 0.85) continue;
      const sx = XS[i];
      const sy = 1.4 * scale;
      const sz0 = insideZ + (outZ - insideZ) * march;
      const tx = XS[i] * 2.8;
      const ty = 0.35;
      const tz = 50;
      dummy.position.set(sx + (tx - sx) * fly, sy + (ty - sy) * fly + Math.sin(fly * Math.PI) * 4.2, sz0 + (tz - sz0) * fly);
      look.set(tx, ty, tz);
      dummy.lookAt(look);
      dummy.rotateX(Math.PI / 2);
      dummy.scale.set(1.3, 1.8, 1.3);
      dummy.updateMatrix();
      spears.current.setMatrixAt(n, dummy.matrix);
      n += 1;
    }
    spears.current.count = n;
    spears.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodies} args={[geo, undefined, RAIDERS]} frustumCulled={false}>
        <meshLambertMaterial vertexColors />
      </instancedMesh>
      <instancedMesh ref={spears} args={[undefined, undefined, RAIDERS]} frustumCulled={false}>
        <cylinderGeometry args={[0.06, 0.02, 2.1, 6]} />
        <meshBasicMaterial color="#c4a46a" />
      </instancedMesh>
    </group>
  );
}
