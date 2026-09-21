import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { armyFrame } from "./Army";

const WOOD = "#7a4a24";
const WOOD_DK = "#4a2c14";
const IRON = "#2c2c2e";
const ROPE = "#c4a06a";

function paint(geo: THREE.BufferGeometry, hex: string) {
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

function plank(w: number, h: number, d: number, x: number, y: number, z: number, hex: string, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return paint(g, hex);
}

function wheel(x: number, z: number) {
  const tire = new THREE.CylinderGeometry(0.95, 0.95, 0.28, 10);
  tire.rotateZ(Math.PI / 2);
  tire.translate(x, 0.95, z);
  paint(tire, WOOD_DK);
  const hub = new THREE.CylinderGeometry(0.22, 0.22, 0.36, 8);
  hub.rotateZ(Math.PI / 2);
  hub.translate(x, 0.95, z);
  paint(hub, IRON);
  return [tire, hub];
}

/** 12th–14th c. mangonel / onager: timber chassis, A-frame, throwing arm, spoon. */
function mangonelGeometry() {
  const parts: THREE.BufferGeometry[] = [
    plank(5.4, 0.28, 1.85, 0, 0.55, 0, WOOD),
    plank(5.1, 0.22, 0.28, 0, 0.82, 0.78, WOOD_DK),
    plank(5.1, 0.22, 0.28, 0, 0.82, -0.78, WOOD_DK),
    plank(0.28, 0.7, 1.85, -2.45, 0.7, 0, WOOD_DK),
    plank(0.28, 0.7, 1.85, 2.45, 0.7, 0, WOOD_DK),
    ...wheel(-2.15, 1.05),
    ...wheel(-2.15, -1.05),
    ...wheel(2.15, 1.05),
    ...wheel(2.15, -1.05),
    plank(0.32, 3.4, 0.32, -0.72, 2.3, 0.55, WOOD, 0, 0, 0.18),
    plank(0.32, 3.4, 0.32, 0.72, 2.3, 0.55, WOOD, 0, 0, -0.18),
    plank(0.32, 3.4, 0.32, -0.72, 2.3, -0.55, WOOD, 0, 0, 0.18),
    plank(0.32, 3.4, 0.32, 0.72, 2.3, -0.55, WOOD, 0, 0, -0.18),
    plank(1.7, 0.28, 0.28, 0, 3.85, 0, WOOD_DK),
    plank(0.28, 0.28, 1.35, 0, 3.85, 0, IRON),
    plank(0.34, 4.6, 0.34, 0, 3.2, -1.15, WOOD, 0.72, 0, 0),
    plank(0.85, 0.22, 1.15, 0, 5.05, -2.55, WOOD_DK, 0.2, 0, 0),
    plank(0.22, 0.55, 0.22, -0.48, 5.15, -2.35, IRON),
    plank(0.22, 0.55, 0.22, 0.48, 5.15, -2.35, IRON),
    plank(0.7, 0.7, 0.7, 1.7, 1.15, 0, WOOD_DK),
    plank(0.18, 0.18, 1.4, 1.7, 1.55, 0, ROPE, 0.9, 0, 0),
  ];
  const stone = new THREE.SphereGeometry(0.38, 7, 6);
  stone.translate(0, 5.15, -2.7);
  paint(stone, "#6a675f");
  parts.push(stone);
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) return new THREE.BoxGeometry(1, 1, 1);
  merged.computeVertexNormals();
  return merged;
}

export function Catapults({ soldiers, square = false }: { soldiers: number; square?: boolean }) {
  const geo = useMemo(() => mangonelGeometry(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const form = armyFrame(soldiers, 0, square);
  const meshes = useMemo(() => {
    const half = form.width * 0.5 + 8.2;
    const zs = [form.front + 3, form.midZ, form.back - 2];
    const slots: { x: number; z: number; yaw: number }[] = [];
    for (const z of zs) {
      slots.push({ x: -half, z, yaw: Math.PI * 0.08 });
      slots.push({ x: half, z, yaw: -Math.PI * 0.08 });
    }
    return slots;
  }, [form.width, form.front, form.midZ, form.back]);

  return (
    <instancedMesh args={[geo, undefined, 6]} frustumCulled={false} count={6}
      ref={(mesh) => {
        if (!mesh) return;
        for (let i = 0; i < 6; i++) {
          const s = meshes[i];
          dummy.position.set(s.x, 0, s.z);
          dummy.rotation.set(0, s.yaw, 0);
          dummy.scale.setScalar(1.15);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }}
    >
      <meshStandardMaterial vertexColors roughness={0.78} metalness={0.08} />
    </instancedMesh>
  );
}
