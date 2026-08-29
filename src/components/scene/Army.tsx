import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const MAX_SOLDIERS = 5000;
const MAX_LABELS = 80;
const MAX_ARROWS = 8;
const dummy = new THREE.Object3D();
const VOLLEY_FLIGHT = 1.35;
const VOLLEY_REST = 2.5;
const AREA_W = 28;
const FRONT_Z = 11.15;

type ArmyProps = {
  count: number;
};

function formation(visible: number) {
  const n = Math.max(1, visible);
  const spacing = Math.min(1.35, Math.max(0.34, Math.sqrt((AREA_W * 14) / n)));
  const cols = Math.max(1, Math.min(n, Math.round(AREA_W / spacing)));
  const pack = Math.min(1, spacing / 1.05);
  return { spacing, cols, scale: 0.52 + pack * 0.48 };
}

function unitPos(i: number, t: number, cols: number, spacing: number, out: THREE.Vector3) {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const x = (col - (cols - 1) / 2) * spacing;
  const atWall = row < 3;
  const z = FRONT_Z + row * spacing * 0.92;
  const strike = atWall ? Math.abs(Math.sin(t * 7 + i)) * 0.08 : 0;
  const march = atWall ? 0 : Math.min(1, ((t * 0.16) % 4) / 2.2) * Math.min(spacing * 0.8, 0.55);
  out.set(x, strike, z - march);
}

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

function createArcherGeometry() {
  const pieces = [
    part(new THREE.BoxGeometry(0.15, 0.16, 0.2), "#1a1410", -0.09, 0.08, 0.03),
    part(new THREE.BoxGeometry(0.15, 0.16, 0.2), "#1a1410", 0.09, 0.08, 0.03),
    part(new THREE.BoxGeometry(0.13, 0.3, 0.14), "#161820", -0.09, 0.28, 0),
    part(new THREE.BoxGeometry(0.13, 0.3, 0.14), "#161820", 0.09, 0.28, 0),
    part(new THREE.BoxGeometry(0.38, 0.3, 0.24), "#1c2740", 0, 0.54, 0),
    part(new THREE.BoxGeometry(0.4, 0.28, 0.26), "#4a3220", 0, 0.78, 0.01),
    part(new THREE.BoxGeometry(0.44, 0.1, 0.28), "#5c636a", 0, 0.94, 0),
    part(new THREE.BoxGeometry(0.16, 0.22, 0.16), "#3d2a1c", -0.22, 0.74, 0.04, 0, 0, 0.35),
    part(new THREE.BoxGeometry(0.14, 0.24, 0.14), "#3d2a1c", 0.24, 0.76, 0.08, 0.15, 0, -0.55),
    part(new THREE.ConeGeometry(0.17, 0.24, 7), "#8b9298", 0, 1.18, 0),
    part(new THREE.BoxGeometry(0.035, 0.12, 0.07), "#9aa0a6", 0, 1.04, 0.13),
    part(new THREE.CylinderGeometry(0.055, 0.07, 0.28, 6), "#3a2818", -0.16, 0.82, -0.14, 0.7, 0.4, 0),
    part(new THREE.BoxGeometry(0.035, 0.82, 0.035), "#5c3a18", 0.28, 0.72, 0.1, 0, 0, 0.18),
    part(new THREE.BoxGeometry(0.012, 0.7, 0.012), "#c8c2b4", 0.2, 0.72, 0.16),
  ];
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  if (!merged) {
    return colorize(new THREE.BoxGeometry(0.4, 1.1, 0.28), "#4a3220");
  }
  return merged;
}

function makeNumberTexture(n: number) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  ctx.font = n >= 10 ? "700 52px Outfit, system-ui, sans-serif" : "700 72px Outfit, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(0,0,0,0.88)";
  ctx.fillStyle = "#fff";
  ctx.strokeText(String(n), size / 2, size / 2 + 4);
  ctx.fillText(String(n), size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export function Army({ count }: ArmyProps) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const arrows = useRef<THREE.InstancedMesh>(null);
  const tags = useRef<THREE.Group>(null);
  const acc = useRef(0);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const archerGeo = useMemo(() => createArcherGeometry(), []);
  const numberMaps = useMemo(
    () => Array.from({ length: MAX_LABELS }, (_, i) => makeNumberTexture(i + 1)),
    []
  );

  const visible = Math.min(MAX_SOLDIERS, Math.max(0, Math.floor(count)));
  const showTags = visible > 0 && visible <= MAX_LABELS;
  const form = useMemo(() => formation(visible), [visible]);

  const seeds = useMemo(() => {
    const arr = new Float32Array(MAX_SOLDIERS);
    for (let i = 0; i < MAX_SOLDIERS; i++) arr[i] = Math.random();
    return arr;
  }, []);

  useFrame((state, dt) => {
    acc.current += dt;
    if (acc.current < 1 / 28) return;
    acc.current = 0;
    const t = state.clock.elapsedTime;
    const { spacing, cols, scale } = form;

    if (bodies.current) {
      bodies.current.count = visible;
      for (let i = 0; i < visible; i++) {
        unitPos(i, t + seeds[i], cols, spacing, pos);
        dummy.position.copy(pos);
        dummy.rotation.set(0, Math.PI, 0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        bodies.current.setMatrixAt(i, dummy.matrix);
        if (showTags && i < MAX_LABELS) {
          const tag = tags.current?.children[i];
          if (tag) {
            tag.visible = true;
            tag.position.set(pos.x, pos.y + 1.35 * scale, pos.z);
          }
        }
      }
      bodies.current.instanceMatrix.needsUpdate = true;
    }

    if (tags.current) {
      for (let i = 0; i < MAX_LABELS; i++) {
        if (!showTags || i >= visible) tags.current.children[i].visible = false;
      }
    }

    if (!arrows.current) return;
    if (visible <= 0) {
      arrows.current.count = 0;
      return;
    }

    const volleySize = Math.min(MAX_ARROWS, Math.max(1, Math.ceil(Math.min(visible, 80) * 0.1)));
    const cycle = VOLLEY_FLIGHT + VOLLEY_REST;
    const inCycle = t % cycle;
    if (inCycle > VOLLEY_FLIGHT) {
      arrows.current.count = 0;
      return;
    }

    const volley = Math.floor(t / cycle);
    const start = (volley * volleySize) % visible;
    const fly = inCycle / VOLLEY_FLIGHT;
    arrows.current.count = volleySize;

    for (let i = 0; i < volleySize; i++) {
      const soldier = (start + i) % visible;
      unitPos(soldier, t, cols, spacing, pos);
      dummy.position.set(pos.x * (1 - fly), 0.95 + Math.sin(fly * Math.PI) * 2.4, pos.z + (6.4 - pos.z) * fly);
      dummy.rotation.set(0.7 - fly, 0, 0);
      dummy.scale.set(0.1, 0.1, 0.85);
      dummy.updateMatrix();
      arrows.current.setMatrixAt(i, dummy.matrix);
    }
    arrows.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodies} args={[archerGeo, undefined, MAX_SOLDIERS]} frustumCulled={false}>
        <meshLambertMaterial vertexColors />
      </instancedMesh>
      <instancedMesh ref={arrows} args={[undefined, undefined, MAX_ARROWS]} frustumCulled={false}>
        <cylinderGeometry args={[0.025, 0.01, 1, 5]} />
        <meshLambertMaterial color="#c4b089" />
      </instancedMesh>
      <group ref={tags}>
        {numberMaps.map((map, i) => (
          <sprite key={i} scale={[1.15, 1.15, 1.15]} visible={false} renderOrder={2}>
            <spriteMaterial
              map={map ?? undefined}
              transparent
              depthTest={false}
              toneMapped={false}
            />
          </sprite>
        ))}
      </group>
    </group>
  );
}
