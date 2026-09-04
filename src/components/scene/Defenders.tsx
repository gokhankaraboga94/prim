import { useLayoutEffect, useMemo, useRef } from "react";
import { castleAxes } from "../../castleLayout";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const dummy = new THREE.Object3D();

function colorize(geo: THREE.BufferGeometry, hex: string) {
  const color = new THREE.Color(hex);
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
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

function createSwordsmanGeometry() {
  const pieces = [
    part(new THREE.BoxGeometry(0.16, 0.14, 0.22), "#1a1010", -0.09, 0.07, 0.03),
    part(new THREE.BoxGeometry(0.16, 0.14, 0.22), "#1a1010", 0.09, 0.07, 0.03),
    part(new THREE.BoxGeometry(0.13, 0.28, 0.14), "#2a1212", -0.09, 0.27, 0),
    part(new THREE.BoxGeometry(0.13, 0.28, 0.14), "#2a1212", 0.09, 0.27, 0),
    part(new THREE.BoxGeometry(0.4, 0.34, 0.24), "#8b1a1a", 0, 0.6, 0.01),
    part(new THREE.BoxGeometry(0.42, 0.26, 0.26), "#5c1414", 0, 0.86, 0.02),
    part(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 8), "#7a8288", 0, 1.04, 0),
    part(new THREE.SphereGeometry(0.1, 6, 5), "#c4a07a", 0, 1.13, 0.02),
    part(new THREE.ConeGeometry(0.17, 0.24, 8), "#b0b6bc", 0, 1.3, 0),
    part(new THREE.BoxGeometry(0.16, 0.22, 0.15), "#4a1818", -0.26, 0.84, 0.04, 0, 0, 0.4),
    part(new THREE.BoxGeometry(0.16, 0.22, 0.15), "#4a1818", 0.28, 0.82, 0.1, 0.15, 0, -0.55),
    part(new THREE.BoxGeometry(0.05, 0.62, 0.05), "#c8cdd2", 0.36, 0.95, 0.18, 0, 0, -0.35),
    part(new THREE.BoxGeometry(0.12, 0.08, 0.03), "#8a9096", 0.34, 0.72, 0.14),
  ];
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  return merged ?? colorize(new THREE.BoxGeometry(0.4, 1.2, 0.28), "#8b1a1a");
}

type Post = { x: number; y: number; z: number; rot: number };

function line(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  n: number,
  y: number,
  rot: number,
  out: [number, number, number, number][]
) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    out.push([x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, rot]);
  }
}

function posts(wallH: number, sx: number, sy: number, sz: number): Post[] {
  const walk = wallH + 0.04;
  const local: [number, number, number, number][] = [];

  line(-10.1, 6.15, -2.55, 6.15, 10, walk, 0, local);
  line(2.55, 6.15, 10.1, 6.15, 10, walk, 0, local);
  line(-10.2, -12.85, 10.2, -12.85, 16, walk, Math.PI, local);
  line(-10.5, 4.6, -10.5, -11.6, 12, walk, -Math.PI / 2, local);
  line(10.5, 4.6, 10.5, -11.6, 12, walk, Math.PI / 2, local);

  local.push(
    [-11.2, 8.75, -13.4, Math.PI],
    [-10.7, 8.82, -13.8, Math.PI * 0.85],
    [10.7, 9.05, -13.4, Math.PI],
    [11.2, 9.12, -13.8, Math.PI * 1.15],
    [-11.2, 8.15, 6.6, 0],
    [-10.7, 8.22, 7.1, 0.2],
    [10.7, 8.35, 6.6, 0],
    [11.2, 8.42, 7.1, -0.2],
    [-2.55, 9.75, -2.35, 0.4],
    [-1.9, 9.82, -2.9, 0.15],
    [0.15, 12.7, -1.05, 0.25],
    [1.35, 12.7, -1.35, -0.15],
    [0.55, 12.76, -2.55, Math.PI],
    [1.7, 12.63, -2.2, Math.PI * 0.9],
    [-0.7, 12.66, -1.85, 0.55]
  );

  return local.map(([x, y, z, rot]) => ({
    x: x * sx,
    y: y * sy,
    z: z * sz,
    rot,
  }));
}

type DefendersProps = {
  grow: number;
  wallH: number;
};

export function Defenders({ grow, wallH }: DefendersProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => createSwordsmanGeometry(), []);
  const { sx, sy, sz, zShift } = castleAxes(grow);
  const list = useMemo(
    () =>
      posts(wallH, sx, sy, sz).map((p) => ({
        ...p,
        z: p.z + zShift,
      })),
    [wallH, sx, sy, sz, zShift]
  );

  useLayoutEffect(() => {
    if (!mesh.current) return;
    const unit = 1.05 * grow;
    list.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.rot, 0);
      dummy.scale.setScalar(unit);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.count = list.length;
  }, [list, grow]);

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, list.length]} frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.7} metalness={0.1} />
    </instancedMesh>
  );
}
