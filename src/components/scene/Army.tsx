import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { sallyDuck, sallyLocal } from "../../siegeEvent";

const MAX_SOLDIERS = 5000;
const MAX_LABELS = 80;
const MAX_ARROWS = 2;
const dummy = new THREE.Object3D();
const ARROW_FLIGHT = 3.2;
const AREA_W = 42;
const FRONT_Z = 52;
const GATE = new THREE.Vector3(0, 10.5, 16.4);

type Shot = {
  soldier: number;
  born: number;
  sx: number;
  sy: number;
  sz: number;
};

type ArmyProps = {
  count: number;
};

function formation(visible: number) {
  const n = Math.max(1, visible);
  const spacing = Math.min(1.35, Math.max(0.34, Math.sqrt((AREA_W * 14) / n)));
  const cols = Math.max(1, Math.min(n, Math.round(AREA_W / spacing)));
  const pack = Math.min(1, spacing / 1.05);
  return { spacing, cols, scale: 0.92 + pack * 0.38 };
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
    part(new THREE.BoxGeometry(0.15, 0.18, 0.26), "#3a2416", -0.1, 0.09, 0.05),
    part(new THREE.BoxGeometry(0.15, 0.18, 0.26), "#3a2416", 0.1, 0.09, 0.05),
    part(new THREE.BoxGeometry(0.13, 0.3, 0.15), "#16181e", -0.1, 0.32, 0.02),
    part(new THREE.BoxGeometry(0.13, 0.3, 0.15), "#16181e", 0.1, 0.32, 0.02),
    part(new THREE.BoxGeometry(0.16, 0.26, 0.17), "#1a1c24", -0.1, 0.58, 0),
    part(new THREE.BoxGeometry(0.16, 0.26, 0.17), "#1a1c24", 0.1, 0.58, 0),
    part(new THREE.CylinderGeometry(0.24, 0.28, 0.36, 8), "#1b2a48", 0, 0.68, 0.01),
    part(new THREE.BoxGeometry(0.4, 0.34, 0.28), "#4e321c", 0, 0.94, 0.03),
    part(new THREE.BoxGeometry(0.42, 0.045, 0.3), "#2c1c10", 0, 0.84, 0.04),
    part(new THREE.BoxGeometry(0.42, 0.045, 0.3), "#2c1c10", 0, 0.96, 0.04),
    part(new THREE.BoxGeometry(0.42, 0.045, 0.3), "#2c1c10", 0, 1.08, 0.04),
    part(new THREE.BoxGeometry(0.44, 0.08, 0.22), "#6a4a28", 0, 0.78, 0.02),
    part(new THREE.CylinderGeometry(0.2, 0.24, 0.18, 8), "#7a828a", 0, 1.14, 0.01),
    part(new THREE.SphereGeometry(0.12, 8, 6), "#c4a07a", 0, 1.26, 0.03),
    part(new THREE.SphereGeometry(0.16, 9, 7), "#c5ccd4", 0, 1.34, 0.01),
    part(new THREE.BoxGeometry(0.035, 0.18, 0.04), "#d4dae0", 0, 1.38, 0.02),
    part(new THREE.BoxGeometry(0.035, 0.12, 0.07), "#b8c0c8", 0, 1.24, 0.15),
    part(new THREE.BoxGeometry(0.15, 0.22, 0.15), "#3d2a1c", -0.28, 0.96, 0.04, 0, 0, 0.55),
    part(new THREE.BoxGeometry(0.11, 0.2, 0.11), "#4a3220", -0.38, 0.86, 0.08, 0.1, 0, 0.25),
    part(new THREE.BoxGeometry(0.1, 0.16, 0.1), "#3a2818", -0.4, 0.72, 0.14),
    part(new THREE.BoxGeometry(0.14, 0.22, 0.14), "#3d2a1c", 0.3, 0.98, 0.1, 0.25, 0, -0.75),
    part(new THREE.BoxGeometry(0.11, 0.2, 0.11), "#4a3220", 0.28, 0.94, 0.24, 0.45, 0, -0.2),
    part(new THREE.BoxGeometry(0.1, 0.14, 0.1), "#3a2818", 0.24, 0.9, 0.36),
    part(new THREE.TorusGeometry(0.52, 0.02, 5, 14, Math.PI), "#8a5a28", 0.26, 0.88, 0.22, 0, 0.15, Math.PI / 2),
    part(new THREE.BoxGeometry(0.012, 0.98, 0.012), "#e8e0c8", 0.16, 0.88, 0.3),
    part(new THREE.CylinderGeometry(0.055, 0.07, 0.38, 7), "#3a2414", -0.16, 1.02, -0.16, 0.95, 0.45, 0.1),
    part(new THREE.BoxGeometry(0.018, 0.26, 0.018), "#d8c898", -0.14, 1.2, -0.24, 0.25, 0, 0.2),
    part(new THREE.BoxGeometry(0.018, 0.24, 0.018), "#d8c898", -0.19, 1.18, -0.22, 0.15, 0, -0.12),
    part(new THREE.BoxGeometry(0.018, 0.22, 0.018), "#d8c898", -0.12, 1.16, -0.2, 0.1, 0, 0.08),
    part(new THREE.BoxGeometry(0.055, 0.62, 0.055), "#3a3c42", -0.2, 0.7, -0.1, 0.12, 0, 0.25),
    part(new THREE.BoxGeometry(0.04, 0.12, 0.09), "#8a9098", -0.2, 1.02, -0.12),
    part(new THREE.BoxGeometry(0.08, 0.08, 0.08), "#c4a07a", -0.42, 0.64, 0.16),
    part(new THREE.BoxGeometry(0.08, 0.08, 0.08), "#c4a07a", 0.22, 0.86, 0.42),
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
  const shots = useRef<Shot[]>([]);
  const nextShot = useRef(0.6);
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
    const t = state.clock.elapsedTime;
    const { spacing, cols, scale } = form;
    const duck = sallyDuck(sallyLocal(t));

    acc.current += dt;
    if (acc.current >= 1 / 28) {
      acc.current = 0;
      if (bodies.current) {
        bodies.current.count = visible;
        for (let i = 0; i < visible; i++) {
          unitPos(i, t + seeds[i], cols, spacing, pos);
          const lean = duck * (0.72 + seeds[i] * 0.28);
          dummy.position.set(pos.x, pos.y - lean * 0.28 * scale, pos.z);
          dummy.rotation.set(lean * 0.85, Math.PI, 0);
          dummy.scale.setScalar(scale);
          dummy.updateMatrix();
          bodies.current.setMatrixAt(i, dummy.matrix);
          if (showTags && i < MAX_LABELS) {
            const tag = tags.current?.children[i];
            if (tag) {
              tag.visible = true;
              tag.position.set(pos.x, pos.y + 1.72 * scale, pos.z);
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
    }

    if (!arrows.current) return;
    if (visible <= 0) {
      shots.current = [];
      arrows.current.count = 0;
      return;
    }

    shots.current = shots.current.filter((s) => t - s.born < ARROW_FLIGHT);

    if (t >= nextShot.current && shots.current.length < MAX_ARROWS) {
      const pair = visible > 6 && shots.current.length === 0 && Math.random() < 0.38;
      const n = pair ? 2 : 1;
      for (let i = 0; i < n && shots.current.length < MAX_ARROWS; i++) {
        const soldier = Math.floor(Math.random() * visible);
        unitPos(soldier, t + seeds[soldier], cols, spacing, pos);
        shots.current.push({
          soldier,
          born: t + i * 0.12,
          sx: pos.x,
          sy: pos.y + 1.25 * scale,
          sz: pos.z,
        });
      }
      const pace = 1.25 - Math.min(0.75, (visible / 5000) * 0.75);
      nextShot.current = t + pace + Math.random() * 0.28;
    }

    const live = shots.current;
    arrows.current.count = live.length;
    for (let i = 0; i < live.length; i++) {
      const s = live[i];
      const fly = Math.max(0, Math.min(1, (t - s.born) / ARROW_FLIGHT));
      dummy.position.set(
        s.sx + (GATE.x - s.sx) * fly,
        s.sy + (GATE.y - s.sy) * fly + Math.sin(fly * Math.PI) * 2.6,
        s.sz + (GATE.z - s.sz) * fly
      );
      dummy.lookAt(GATE);
      dummy.rotateX(Math.PI / 2);
      dummy.scale.set(1.15, 1.35, 1.15);
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
        <cylinderGeometry args={[0.055, 0.02, 1.45, 6]} />
        <meshBasicMaterial color="#ffe7a0" />
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
