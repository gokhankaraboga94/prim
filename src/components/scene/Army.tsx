import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { raidCount, sallyHunting, sallyLiveIndex, sallyLocal, sallyRaiderAt } from "../../siegeEvent";

const MAX_SOLDIERS = 5000;
const MAX_LABELS = 80;
const MAX_ARROWS = 16;
const IDLE_ARROWS = 2;
const dummy = new THREE.Object3D();
const ARROW_FLIGHT = 3.2;
const FRONT_Z = 46;
const FILE = 2.55;
const RANK = 2.9;
const COMP_FILES = 8;
const COMP_GAP = 3.2;
const GATE = new THREE.Vector3(0, 10.5, 16.4);

type Shot = {
  soldier: number;
  born: number;
  sx: number;
  sy: number;
  sz: number;
  tx: number;
  ty: number;
  tz: number;
  flight: number;
  thin: boolean;
};

type ArmyProps = {
  count: number;
  names?: string[];
};

function pickCols(n: number) {
  if (n <= 8) return n;
  if (n <= 40) return 8;
  if (n <= 96) return 16;
  if (n <= 200) return 24;
  if (n <= 500) return 32;
  if (n <= 1500) return 48;
  return 64;
}

function formation(visible: number) {
  const n = Math.max(1, visible);
  return { cols: pickCols(n), scale: 1.14 };
}

export function armyFrame(count: number) {
  const n = Math.max(1, Math.min(MAX_SOLDIERS, Math.floor(count)));
  const cols = pickCols(n);
  const rows = Math.ceil(n / cols);
  const companies = Math.max(1, Math.ceil(cols / COMP_FILES));
  const pitch = (COMP_FILES - 1) * FILE + COMP_GAP;
  const width = (companies - 1) * pitch + (COMP_FILES - 1) * FILE + FILE * 0.55;
  const front = FRONT_Z;
  const back = FRONT_Z + (rows - 1) * RANK;
  return { width, front, back, midZ: (front + back) / 2, height: 3.5 };
}

function unitPos(i: number, t: number, cols: number, n: number, out: THREE.Vector3) {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const companies = Math.max(1, Math.ceil(cols / COMP_FILES));
  const company = Math.floor(col / COMP_FILES);
  const file = col % COMP_FILES;
  const stagger = (row % 2) * FILE * 0.46;
  const pitch = (COMP_FILES - 1) * FILE + COMP_GAP;
  const width = (companies - 1) * pitch + (COMP_FILES - 1) * FILE;
  let x = company * pitch + file * FILE - width / 2 + stagger;
  const rows = Math.max(1, Math.ceil(n / cols));
  const lastCount = n - (rows - 1) * cols;
  if (row === rows - 1 && lastCount > 0 && lastCount < cols) {
    x += ((cols - lastCount) * FILE) / 2;
  }
  const z = FRONT_Z + row * RANK;
  const front = row < 2;
  const strike = front ? Math.abs(Math.sin(t * 7 + i)) * 0.07 : 0;
  const march = front ? 0 : Math.min(1, ((t * 0.13) % 4) / 2.4) * 0.32;
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

let archerGeoCache: THREE.BufferGeometry | null = null;

function getArcherGeometry() {
  if (!archerGeoCache) archerGeoCache = createArcherGeometry();
  return archerGeoCache;
}

type NameTag = {
  map: THREE.CanvasTexture;
  sx: number;
  sy: number;
};

function makeHandleTexture(name: string): NameTag | null {
  const label = `@${name}`;
  const height = 128;
  const maxW = 1024;
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return null;
  let fontSize = 62;
  probe.font = `700 ${fontSize}px Outfit, system-ui, sans-serif`;
  let textW = probe.measureText(label).width;
  while (textW + 40 > maxW && fontSize > 18) {
    fontSize -= 1;
    probe.font = `700 ${fontSize}px Outfit, system-ui, sans-serif`;
    textW = probe.measureText(label).width;
  }
  const width = Math.min(maxW, Math.max(256, Math.ceil(textW + 40)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  ctx.font = `700 ${fontSize}px Outfit, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(6, fontSize * 0.2);
  ctx.strokeStyle = "rgba(0,0,0,0.92)";
  ctx.fillStyle = "#fff";
  ctx.strokeText(label, width / 2, height / 2 + 4);
  ctx.fillText(label, width / 2, height / 2 + 4);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  const sy = 0.95;
  const sx = Math.min(2.7, sy * (width / height));
  return { map, sx, sy };
}

export function Army({ count, names = [] }: ArmyProps) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const arrows = useRef<THREE.InstancedMesh>(null);
  const tags = useRef<THREE.Group>(null);
  const acc = useRef(0);
  const shots = useRef<Shot[]>([]);
  const nextShot = useRef(0.6);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const archerGeo = useMemo(() => getArcherGeometry(), []);

  const visible = Math.min(MAX_SOLDIERS, Math.max(0, Math.floor(count)));
  const instanceCap = Math.min(MAX_SOLDIERS, Math.max(visible, 1));
  const labeled = useMemo(() => {
    const ids: number[] = [];
    for (let i = 0; i < visible && ids.length < MAX_LABELS; i++) {
      if (names[i]) ids.push(i);
    }
    return ids;
  }, [names, visible]);
  const nameMaps = useMemo(() => labeled.map((i) => makeHandleTexture(names[i])), [labeled, names]);
  const form = useMemo(() => formation(visible), [visible]);

  const seeds = useMemo(() => {
    const arr = new Float32Array(MAX_SOLDIERS);
    for (let i = 0; i < MAX_SOLDIERS; i++) arr[i] = Math.random();
    return arr;
  }, []);

  function placeBodies(t: number, camX = 9, camY = 21, camZ = 96) {
    const { cols, scale } = form;
    if (bodies.current) {
      bodies.current.count = visible;
      for (let i = 0; i < visible; i++) {
        unitPos(i, t + seeds[i], cols, visible, pos);
        dummy.position.copy(pos);
        dummy.rotation.set(0, Math.PI, 0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        bodies.current.setMatrixAt(i, dummy.matrix);
      }
      bodies.current.instanceMatrix.needsUpdate = true;
    }
    if (!tags.current) return;
    for (let k = 0; k < tags.current.children.length; k++) {
      const idx = labeled[k];
      const tag = tags.current.children[k];
      const tagData = nameMaps[k];
      if (idx == null || !tagData) {
        tag.visible = false;
        continue;
      }
      unitPos(idx, t + seeds[idx], cols, visible, pos);
      tag.visible = true;
      tag.position.set(pos.x, pos.y + 1.86 * scale, pos.z);
      const dx = camX - pos.x;
      const dy = camY - pos.y;
      const dz = camZ - pos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const boost = Math.min(2.35, Math.max(1.2, dist / 42));
      tag.scale.set(tagData.sx * boost, tagData.sy * boost, 1);
    }
  }

  useLayoutEffect(() => {
    placeBodies(0);
  }, [visible, instanceCap, labeled]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const { cols, scale } = form;
    const sally = sallyLocal(t);
    const hunt = sallyHunting(sally);
    const enemies = raidCount(visible);

    acc.current += dt;
    if (acc.current >= 1 / 28) {
      acc.current = 0;
      placeBodies(t, state.camera.position.x, state.camera.position.y, state.camera.position.z);
    }

    if (!arrows.current) return;
    if (visible <= 0) {
      shots.current = [];
      arrows.current.count = 0;
      return;
    }

    shots.current = shots.current.filter((s) => t - s.born < s.flight);

    const cap = hunt ? MAX_ARROWS : IDLE_ARROWS;
    if (t >= nextShot.current && shots.current.length < cap) {
      const pair = visible > 6 && shots.current.length === 0 && (hunt || Math.random() < 0.38);
      const burst = hunt ? (pair ? 3 : 2) : pair ? 2 : 1;
      for (let i = 0; i < burst && shots.current.length < cap; i++) {
        const soldier = Math.floor(Math.random() * visible);
        unitPos(soldier, t + seeds[soldier], cols, visible, pos);
        const idx = hunt ? sallyLiveIndex(sally, enemies, soldier + i * 11) : -1;
        const prey = idx >= 0 ? sallyRaiderAt(sally, idx, enemies) : null;
        shots.current.push({
          soldier,
          born: t + i * 0.04,
          sx: pos.x,
          sy: pos.y + 1.25 * scale,
          sz: pos.z,
          tx: prey ? prey.x : GATE.x,
          ty: prey ? 1.05 : GATE.y,
          tz: prey ? prey.z : GATE.z,
          flight: prey ? 0.46 : ARROW_FLIGHT,
          thin: Boolean(prey),
        });
      }
      const pace = hunt ? 0.09 : 1.25 - Math.min(0.75, (visible / 5000) * 0.75);
      nextShot.current = t + pace + Math.random() * (hunt ? 0.04 : 0.28);
    }

    const live = shots.current;
    arrows.current.count = live.length;
    for (let i = 0; i < live.length; i++) {
      const s = live[i];
      const fly = Math.max(0, Math.min(1, (t - s.born) / s.flight));
      dummy.position.set(
        s.sx + (s.tx - s.sx) * fly,
        s.sy + (s.ty - s.sy) * fly + Math.sin(fly * Math.PI) * (s.thin ? 1.15 : 2.6),
        s.sz + (s.tz - s.sz) * fly
      );
      dummy.lookAt(s.tx, s.ty, s.tz);
      dummy.rotateX(Math.PI / 2);
      dummy.scale.set(s.thin ? 0.34 : 1.15, s.thin ? 1.02 : 1.35, s.thin ? 0.34 : 1.15);
      dummy.updateMatrix();
      arrows.current.setMatrixAt(i, dummy.matrix);
    }
    arrows.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh key={instanceCap} ref={bodies} args={[archerGeo, undefined, instanceCap]} frustumCulled={false}>
        <meshLambertMaterial vertexColors />
      </instancedMesh>
      <instancedMesh ref={arrows} args={[undefined, undefined, MAX_ARROWS]} frustumCulled={false}>
        <cylinderGeometry args={[0.055, 0.02, 1.45, 6]} />
        <meshBasicMaterial color="#ffe7a0" />
      </instancedMesh>
      <group ref={tags}>
        {nameMaps.map((tag, i) =>
          tag ? (
          <sprite key={`${labeled[i]}-${names[labeled[i]]}`} scale={[tag.sx, tag.sy, 1]} visible={false} renderOrder={2}>
            <spriteMaterial
              map={tag.map}
              transparent
              depthTest={false}
              toneMapped={false}
            />
          </sprite>
          ) : null
        )}
      </group>
    </group>
  );
}
