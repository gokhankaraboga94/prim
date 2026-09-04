import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { isCommander } from "../../game";
import { REEL_HOLD, reelBeats } from "../../recordCanvas";
import { raidCount, sallyHunting, sallyLiveIndex, sallyLocal, sallyRaiderAt, swordStyleAt, swordSwingPose, swordSwingU } from "../../siegeEvent";

const MAX_SOLDIERS = 5000;
const MAX_LABELS = 2000;
const MAX_COMMANDERS = 24;
const MAX_ARROWS = 28;
const IDLE_ARROWS = 8;
const dummy = new THREE.Object3D();
const ARROW_FLIGHT = 3.2;
const FRONT_Z = 52;
const FILE = 2.55;
const RANK = 2.9;
const CMD_STEP = RANK * 2;
const GATE = new THREE.Vector3(0, 10.5, 16.4);

type Shot = {
  soldier: number;
  draw: number;
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
  commanders?: string[];
  cinematic?: boolean;
  duration?: number;
};

const MAX_RANKS = 4;

function pickCols(n: number) {
  const count = Math.max(1, n);
  return Math.max(Math.ceil(count / MAX_RANKS), Math.min(count, 4));
}

function rankSizes(n: number) {
  const count = Math.max(0, n);
  if (count <= 0) return [];
  const cols = pickCols(count);
  const rows = Math.max(1, Math.min(MAX_RANKS, Math.ceil(count / cols)));
  const base = Math.floor(count / rows);
  const extra = count % rows;
  const sizes: number[] = [];
  for (let r = 0; r < rows; r++) sizes.push(base + (r < extra ? 1 : 0));
  return sizes;
}

export function armyFrame(count: number, commanderCount = 0) {
  const n = Math.max(1, Math.min(MAX_SOLDIERS, Math.floor(count)));
  const chiefs = Math.max(0, Math.min(MAX_COMMANDERS, Math.floor(commanderCount)));
  const sizes = rankSizes(Math.max(1, n - chiefs));
  const cols = sizes.length ? Math.max(...sizes) : 1;
  const rows = Math.max(1, sizes.length);
  const width = Math.max(FILE, (cols - 1) * FILE + FILE * 0.55);
  const front = chiefs > 0 ? FRONT_Z - CMD_STEP : FRONT_Z;
  const back = FRONT_Z + (rows - 1) * RANK;
  return { width, front, back, midZ: (front + back) / 2, height: 4.2 };
}

function unitPos(i: number, t: number, sizes: number[], out: THREE.Vector3) {
  let row = 0;
  let col = i;
  while (row < sizes.length - 1 && col >= sizes[row]) {
    col -= sizes[row];
    row += 1;
  }
  const rowCols = Math.max(1, sizes[row] ?? 1);
  const x = (col - (rowCols - 1) / 2) * FILE;
  const z = FRONT_Z + row * RANK;
  const front = row < 2;
  const strike = front ? Math.abs(Math.sin(t * 7 + i)) * 0.07 : 0;
  const march = front ? 0 : Math.min(1, ((t * 0.13) % 4) / 2.4) * 0.32;
  out.set(x, strike, z - march);
}

function commanderPos(t: number, id: number, out: THREE.Vector3) {
  const strike = Math.abs(Math.sin(t * 7 + id)) * 0.07;
  out.set(0, strike, FRONT_Z - CMD_STEP);
}

function buildLayout(names: string[], commanders: string[], n: number) {
  const cmd: number[] = [];
  const rest: number[] = [];
  for (let i = 0; i < n; i++) {
    if (names[i] && isCommander(names[i], commanders)) cmd.push(i);
    else rest.push(i);
  }
  const slotOf = new Array<number>(n).fill(-1);
  rest.forEach((soldier, i) => {
    slotOf[soldier] = i;
  });
  const cmdOf = new Array<number>(n).fill(-1);
  cmd.forEach((soldier, i) => {
    cmdOf[soldier] = i;
  });
  return { cmd, rest, slotOf, cmdOf, sizes: rankSizes(rest.length) };
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

const ARMOR = "#3a4048";
const ARMOR_DK = "#24282e";
const ARMOR_HI = "#5a616a";
const GOLD = "#d4b03a";
const GOLD_DK = "#9a7618";
const SLIT = "#050608";
const LEATHER = "#1c1a18";

function mergeParts(pieces: THREE.BufferGeometry[], fallback: string) {
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  return merged || colorize(new THREE.BoxGeometry(0.4, 1.2, 0.28), fallback);
}

function helmBowl(seg: number) {
  const pts = [
    new THREE.Vector2(0.01, 0.2),
    new THREE.Vector2(0.09, 0.19),
    new THREE.Vector2(0.15, 0.145),
    new THREE.Vector2(0.174, 0.055),
    new THREE.Vector2(0.176, -0.02),
    new THREE.Vector2(0.17, -0.1),
    new THREE.Vector2(0.162, -0.2),
    new THREE.Vector2(0.155, -0.27),
    new THREE.Vector2(0.182, -0.31),
  ];
  return new THREE.LatheGeometry(pts, seg);
}

function corinthianShell(seg = 14) {
  return [
    part(helmBowl(seg), ARMOR, 0, 1.43, 0.01),
    part(new THREE.SphereGeometry(0.168, seg, 10), ARMOR_HI, 0, 1.46, 0),
    part(new THREE.BoxGeometry(0.09, 0.2, 0.14), ARMOR_DK, -0.13, 1.24, 0.1),
    part(new THREE.BoxGeometry(0.09, 0.2, 0.14), ARMOR_DK, 0.13, 1.24, 0.1),
    part(new THREE.BoxGeometry(0.22, 0.048, 0.055), SLIT, 0, 1.355, 0.168),
    part(new THREE.BoxGeometry(0.03, 0.155, 0.05), SLIT, 0, 1.255, 0.172),
    part(new THREE.BoxGeometry(0.24, 0.012, 0.016), GOLD, 0, 1.382, 0.188),
    part(new THREE.BoxGeometry(0.24, 0.012, 0.016), GOLD, 0, 1.328, 0.188),
    part(new THREE.BoxGeometry(0.014, 0.17, 0.016), GOLD, -0.108, 1.355, 0.188),
    part(new THREE.BoxGeometry(0.014, 0.17, 0.016), GOLD, 0.108, 1.355, 0.188),
    part(new THREE.BoxGeometry(0.042, 0.17, 0.018), GOLD, 0, 1.255, 0.195),
    part(new THREE.CylinderGeometry(0.15, 0.188, 0.055, seg), ARMOR_DK, 0, 1.115, 0.02),
    part(new THREE.TorusGeometry(0.168, 0.01, 6, seg), GOLD, 0, 1.13, 0.02, Math.PI / 2),
    part(new THREE.BoxGeometry(0.038, 0.1, 0.26), ARMOR_HI, 0, 1.6, 0),
    part(new THREE.BoxGeometry(0.05, 0.04, 0.2), GOLD_DK, 0, 1.55, 0),
  ];
}

function helmPlume(tall: boolean) {
  const h = tall ? 0.52 : 0.34;
  const light = tall ? "#eef0f3" : "#c8ccd2";
  const mid = tall ? "#b8bcc2" : "#8e949c";
  const dark = tall ? "#7a8088" : "#5c6268";
  return [
    part(new THREE.BoxGeometry(0.085, h, 0.12), light, 0, 1.66 + h * 0.28, 0.01),
    part(new THREE.BoxGeometry(0.06, h * 0.86, 0.09), mid, 0, 1.62 + h * 0.22, -0.05),
    part(new THREE.BoxGeometry(0.05, h * 0.7, 0.07), dark, 0, 1.58 + h * 0.16, -0.09),
    part(new THREE.BoxGeometry(0.07, h * 0.35, 0.16), light, 0, 1.88 + h * 0.18, 0.02),
  ];
}

function plateArmor() {
  const flaps: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const x = (i - 3.5) * 0.052;
    flaps.push(part(new THREE.BoxGeometry(0.046, 0.24, 0.038), LEATHER, x, 0.66, 0.11));
    flaps.push(part(new THREE.BoxGeometry(0.046, 0.22, 0.034), ARMOR_DK, x, 0.64, -0.09));
  }
  return [
    part(new THREE.BoxGeometry(0.14, 0.1, 0.24), ARMOR_DK, -0.1, 0.05, 0.04),
    part(new THREE.BoxGeometry(0.14, 0.1, 0.24), ARMOR_DK, 0.1, 0.05, 0.04),
    part(new THREE.CylinderGeometry(0.055, 0.07, 0.26, 8), ARMOR, -0.1, 0.22, 0.03),
    part(new THREE.CylinderGeometry(0.055, 0.07, 0.26, 8), ARMOR, 0.1, 0.22, 0.03),
    part(new THREE.BoxGeometry(0.016, 0.24, 0.02), GOLD_DK, -0.155, 0.22, 0.08),
    part(new THREE.BoxGeometry(0.016, 0.24, 0.02), GOLD_DK, 0.155, 0.22, 0.08),
    part(new THREE.CylinderGeometry(0.075, 0.09, 0.26, 8), ARMOR, -0.1, 0.48, 0.02),
    part(new THREE.CylinderGeometry(0.075, 0.09, 0.26, 8), ARMOR, 0.1, 0.48, 0.02),
    ...flaps,
    part(new THREE.BoxGeometry(0.4, 0.07, 0.22), ARMOR_HI, 0, 0.8, 0.02),
    part(new THREE.BoxGeometry(0.1, 0.055, 0.05), GOLD, 0, 0.8, 0.14),
    part(new THREE.BoxGeometry(0.38, 0.4, 0.17), ARMOR, 0, 1.02, 0.02),
    part(new THREE.BoxGeometry(0.34, 0.018, 0.185), GOLD, 0, 1.2, 0.03),
    part(new THREE.BoxGeometry(0.34, 0.014, 0.02), GOLD, 0, 0.86, 0.115),
    part(new THREE.BoxGeometry(0.014, 0.36, 0.02), GOLD, 0, 1.02, 0.115),
    part(new THREE.BoxGeometry(0.014, 0.36, 0.02), GOLD, -0.17, 1.02, 0.11),
    part(new THREE.BoxGeometry(0.014, 0.36, 0.02), GOLD, 0.17, 1.02, 0.11),
    part(new THREE.SphereGeometry(0.155, 12, 10), ARMOR_HI, -0.28, 1.15, 0),
    part(new THREE.SphereGeometry(0.155, 12, 10), ARMOR_HI, 0.28, 1.15, 0),
    part(new THREE.SphereGeometry(0.11, 10, 8), ARMOR, -0.32, 1.06, 0.04),
    part(new THREE.SphereGeometry(0.11, 10, 8), ARMOR, 0.32, 1.06, 0.04),
    part(new THREE.TorusGeometry(0.1, 0.014, 6, 12), GOLD, -0.28, 1.03, 0.03, Math.PI / 2),
    part(new THREE.TorusGeometry(0.1, 0.014, 6, 12), GOLD, 0.28, 1.03, 0.03, Math.PI / 2),
    part(new THREE.CylinderGeometry(0.058, 0.065, 0.2, 8), ARMOR, -0.3, 0.96, 0.03, 0, 0, 0.28),
    part(new THREE.CylinderGeometry(0.058, 0.065, 0.2, 8), ARMOR, 0.3, 0.96, 0.03, 0, 0, -0.28),
    part(new THREE.CylinderGeometry(0.05, 0.056, 0.2, 8), ARMOR_DK, -0.36, 0.8, 0.07, 0.08, 0, 0.16),
    part(new THREE.CylinderGeometry(0.05, 0.056, 0.2, 8), ARMOR_DK, 0.36, 0.8, 0.07, 0.08, 0, -0.16),
    part(new THREE.BoxGeometry(0.016, 0.16, 0.016), GOLD_DK, -0.36, 0.8, 0.12),
    part(new THREE.BoxGeometry(0.016, 0.16, 0.016), GOLD_DK, 0.36, 0.8, 0.12),
    part(new THREE.BoxGeometry(0.075, 0.07, 0.09), LEATHER, -0.4, 0.7, 0.11),
    part(new THREE.BoxGeometry(0.075, 0.07, 0.09), LEATHER, 0.4, 0.7, 0.11),
    part(new THREE.CylinderGeometry(0.058, 0.058, 0.028, 14), GOLD, -0.13, 1.2, 0.12, Math.PI / 2),
    part(new THREE.CylinderGeometry(0.058, 0.058, 0.028, 14), GOLD, 0.13, 1.2, 0.12, Math.PI / 2),
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 10), GOLD_DK, -0.13, 1.2, 0.138, Math.PI / 2),
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 10), GOLD_DK, 0.13, 1.2, 0.138, Math.PI / 2),
  ];
}

function capeCloth(cloth: string, lining: string) {
  return [
    part(new THREE.BoxGeometry(0.88, 1.32, 0.12), cloth, 0, 0.54, -0.3),
    part(new THREE.BoxGeometry(0.7, 0.7, 0.1), lining, 0, 0.18, -0.36),
    part(new THREE.BoxGeometry(0.96, 0.2, 0.18), cloth, 0, 1.16, -0.18),
    part(new THREE.BoxGeometry(0.28, 0.14, 0.2), cloth, -0.22, 1.17, -0.04),
    part(new THREE.BoxGeometry(0.28, 0.14, 0.2), cloth, 0.22, 1.17, -0.04),
    part(new THREE.BoxGeometry(0.22, 1.05, 0.08), cloth, -0.38, 0.52, -0.24, 0, 0, 0.12),
    part(new THREE.BoxGeometry(0.22, 1.05, 0.08), cloth, 0.38, 0.52, -0.24, 0, 0, -0.12),
  ];
}

function bowKit() {
  return [
    part(new THREE.TorusGeometry(0.5, 0.018, 6, 18, Math.PI), "#4a3824", 0.32, 0.9, 0.2, 0, 0.18, Math.PI / 2),
    part(new THREE.BoxGeometry(0.01, 0.96, 0.01), "#d0ccc0", 0.2, 0.9, 0.3),
    part(new THREE.CylinderGeometry(0.045, 0.058, 0.3, 8), ARMOR_DK, -0.2, 0.98, -0.16, 0.9, 0.4, 0.08),
    part(new THREE.BoxGeometry(0.014, 0.2, 0.014), ARMOR_HI, -0.18, 1.16, -0.22, 0.22, 0, 0.15),
    part(new THREE.BoxGeometry(0.014, 0.18, 0.014), ARMOR_HI, -0.22, 1.14, -0.2, 0.12, 0, -0.1),
  ];
}

function createArcherGeometry() {
  return mergeParts([...plateArmor(), ...corinthianShell(12), ...bowKit()], ARMOR);
}

function hipScabbard() {
  return [
    part(new THREE.BoxGeometry(0.055, 0.44, 0.08), ARMOR_DK, -0.22, 0.7, 0.16, 0, 0.2, 0.4),
    part(new THREE.BoxGeometry(0.07, 0.05, 0.09), GOLD, -0.2, 0.9, 0.16, 0, 0.2, 0.4),
  ];
}

function createCommanderGeometry() {
  return mergeParts([...plateArmor(), ...corinthianShell(16), ...hipScabbard()], ARMOR);
}

function createCapeGeometry(cloth: string, lining: string) {
  return mergeParts(capeCloth(cloth, lining), cloth);
}

function createPlumeGeometry(tall: boolean) {
  return mergeParts(helmPlume(tall), "#d0d4d8");
}

let archerGeoCache: THREE.BufferGeometry | null = null;
let commanderGeoCache: THREE.BufferGeometry | null = null;
let soldierCapeCache: THREE.BufferGeometry | null = null;
let commanderCapeCache: THREE.BufferGeometry | null = null;
let soldierPlumeCache: THREE.BufferGeometry | null = null;
let commanderPlumeCache: THREE.BufferGeometry | null = null;

function getArcherGeometry() {
  if (!archerGeoCache) archerGeoCache = createArcherGeometry();
  return archerGeoCache;
}

function getCommanderGeometry() {
  if (!commanderGeoCache) commanderGeoCache = createCommanderGeometry();
  return commanderGeoCache;
}

function getSoldierCapeGeometry() {
  if (!soldierCapeCache) soldierCapeCache = createCapeGeometry("#1a4aad", "#12306e");
  return soldierCapeCache;
}

function getCommanderCapeGeometry() {
  if (!commanderCapeCache) commanderCapeCache = createCapeGeometry("#0a0a0c", "#141418");
  return commanderCapeCache;
}

function getSoldierPlumeGeometry() {
  if (!soldierPlumeCache) soldierPlumeCache = createPlumeGeometry(false);
  return soldierPlumeCache;
}

function getCommanderPlumeGeometry() {
  if (!commanderPlumeCache) commanderPlumeCache = createPlumeGeometry(true);
  return commanderPlumeCache;
}

let swordGeoCache: THREE.BufferGeometry | null = null;

function createSwordGeometry() {
  const pieces = [
    part(new THREE.BoxGeometry(0.075, 1.48, 0.09), "#c8ccd0", 0, 0.86, 0),
    part(new THREE.BoxGeometry(0.18, 0.07, 0.2), "#c9a227", 0, 0.12, 0),
    part(new THREE.BoxGeometry(0.065, 0.22, 0.065), "#1a1a1e", 0, -0.02, 0),
    part(new THREE.BoxGeometry(0.11, 0.1, 0.04), "#c9a227", 0, -0.14, 0),
  ];
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  return merged || colorize(new THREE.BoxGeometry(0.08, 1.4, 0.08), "#c8ccd0");
}

function getSwordGeometry() {
  if (!swordGeoCache) swordGeoCache = createSwordGeometry();
  return swordGeoCache;
}

function SwordFlash() {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const u = swordSwingU(sallyLocal(clock.elapsedTime), 1);
    const hit = u > 0.4 ? Math.sin(((u - 0.4) / 0.6) * Math.PI) : 0;
    if (light.current) {
      light.current.intensity = hit * 16;
      light.current.position.set(0, 2.35, FRONT_Z - CMD_STEP - 1.5);
    }
  });
  return <pointLight ref={light} color="#ffe8c8" intensity={0} distance={18} decay={2} />;
}

type NameTag = {
  map: THREE.CanvasTexture;
  sx: number;
  sy: number;
};

function slotCoord(i: number, sizes: number[]) {
  let row = 0;
  let col = i;
  while (row < sizes.length - 1 && col >= sizes[row]) {
    col -= sizes[row];
    row += 1;
  }
  return { row, col };
}

function makeHandleTexture(name: string, commander = false): NameTag | null {
  const label = `@${name}`;
  const height = 160;
  const maxW = 1024;
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return null;
  let fontSize = 78;
  probe.font = `800 ${fontSize}px Outfit, system-ui, sans-serif`;
  let textW = probe.measureText(label).width;
  while (textW + 36 > maxW && fontSize > 28) {
    fontSize -= 2;
    probe.font = `800 ${fontSize}px Outfit, system-ui, sans-serif`;
    textW = probe.measureText(label).width;
  }
  const width = Math.min(maxW, Math.max(160, Math.ceil(textW + 36)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  ctx.font = `800 ${fontSize}px Outfit, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(10, fontSize * 0.2);
  ctx.strokeStyle = commander ? "rgba(4, 18, 8, 0.96)" : "rgba(0,0,0,0.94)";
  ctx.fillStyle = commander ? "#c8ffb0" : "#fff";
  ctx.strokeText(label, width / 2, height / 2);
  ctx.fillText(label, width / 2, height / 2);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.anisotropy = 8;
  const sy = commander ? 1.02 : 0.9;
  const sx = Math.min(FILE * 0.9, sy * (width / height));
  return { map, sx, sy };
}

export function Army({ count, names = [], commanders = [], cinematic, duration = 8 }: ArmyProps) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const soldierCapes = useRef<THREE.InstancedMesh>(null);
  const soldierPlumes = useRef<THREE.InstancedMesh>(null);
  const chiefs = useRef<THREE.InstancedMesh>(null);
  const chiefCapes = useRef<THREE.InstancedMesh>(null);
  const chiefPlumes = useRef<THREE.InstancedMesh>(null);
  const swords = useRef<THREE.InstancedMesh>(null);
  const arrows = useRef<THREE.InstancedMesh>(null);
  const tags = useRef<THREE.Group>(null);
  const acc = useRef(0);
  const shots = useRef<Shot[]>([]);
  const nextShot = useRef(0.6);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const archerGeo = useMemo(() => getArcherGeometry(), []);
  const commanderGeo = useMemo(() => getCommanderGeometry(), []);
  const soldierCapeGeo = useMemo(() => getSoldierCapeGeometry(), []);
  const commanderCapeGeo = useMemo(() => getCommanderCapeGeometry(), []);
  const soldierPlumeGeo = useMemo(() => getSoldierPlumeGeometry(), []);
  const commanderPlumeGeo = useMemo(() => getCommanderPlumeGeometry(), []);
  const swordGeo = useMemo(() => getSwordGeometry(), []);

  const visible = Math.min(MAX_SOLDIERS, Math.max(0, Math.floor(count)));
  const instanceCap = Math.min(MAX_SOLDIERS, Math.max(visible, 1));
  const layout = useMemo(() => buildLayout(names, commanders, visible), [names, commanders, visible]);
  const form = useMemo(() => ({ sizes: layout.sizes, scale: 1.2 }), [layout.sizes]);
  const labeled = useMemo(() => {
    const ids: number[] = [];
    for (let i = 0; i < visible && ids.length < MAX_LABELS; i++) {
      if (names[i]) ids.push(i);
    }
    return ids;
  }, [names, visible]);
  const nameMaps = useMemo(
    () => labeled.map((i) => makeHandleTexture(names[i], isCommander(names[i], commanders))),
    [labeled, names, commanders]
  );

  const seeds = useMemo(() => {
    const arr = new Float32Array(MAX_SOLDIERS);
    for (let i = 0; i < MAX_SOLDIERS; i++) arr[i] = Math.random();
    return arr;
  }, []);

  function poseSoldier(soldier: number, t: number) {
    const cmdK = layout.cmdOf[soldier];
    if (cmdK >= 0) {
      commanderPos(t, soldier, pos);
      return;
    }
    const slot = layout.slotOf[soldier];
    unitPos(slot >= 0 ? slot : soldier, t + seeds[soldier], form.sizes, pos);
  }

  function bowCycle(soldier: number, t: number) {
    const seed = seeds[soldier] ?? 0.5;
    let u = 0;
    let shot: Shot | undefined;
    for (let k = 0; k < shots.current.length; k++) {
      if (shots.current[k].soldier === soldier) {
        shot = shots.current[k];
        break;
      }
    }
    if (shot) {
      const age = t - shot.draw;
      const drawT = Math.max(0.12, shot.born - shot.draw);
      if (age < drawT) u = 0.18 + 0.52 * Math.max(0, Math.min(1, age / drawT));
      else u = 0.7 + 0.3 * Math.max(0, Math.min(1, (age - drawT) / 0.55));
    } else {
      const period = 3.05 + seed * 1.7;
      u = ((t + seed * 19.3 + soldier * 0.17) % period) / period;
    }
    const ease = (x: number) => {
      const v = Math.max(0, Math.min(1, x));
      return v * v * (3 - 2 * v);
    };
    let raise = 0;
    let draw = 0;
    let loose = 0;
    if (u < 0.16) {
      raise = 0;
    } else if (u < 0.3) {
      raise = ease((u - 0.16) / 0.14);
    } else if (u < 0.54) {
      raise = 1;
      draw = ease((u - 0.3) / 0.24);
    } else if (u < 0.7) {
      raise = 1;
      draw = 1;
    } else if (u < 0.8) {
      raise = 1;
      draw = 1;
      loose = ease((u - 0.7) / 0.1);
    } else {
      const rec = ease((u - 0.8) / 0.2);
      raise = 1 - rec;
      draw = 1 - rec;
      loose = 1 - rec;
    }
    const sway = Math.sin(t * 1.35 + soldier) * 0.012;
    return {
      rx: -0.055 * raise - 0.065 * draw + 0.07 * loose + sway,
      ry: Math.PI - 0.045 * raise - 0.055 * draw + 0.03 * loose,
      rz: 0.035 * raise + 0.04 * draw,
      dz: 0.035 * draw,
      dy: 0.012 * draw,
    };
  }

  function stamp(mesh: THREE.InstancedMesh | null, i: number) {
    if (mesh) mesh.setMatrixAt(i, dummy.matrix);
  }

  function placeBodies(t: number) {
    const { scale } = form;
    if (bodies.current) {
      const n = layout.rest.length;
      bodies.current.count = n;
      if (soldierCapes.current) soldierCapes.current.count = n;
      if (soldierPlumes.current) soldierPlumes.current.count = n;
      for (let i = 0; i < n; i++) {
        const soldier = layout.rest[i];
        unitPos(i, t + seeds[soldier], form.sizes, pos);
        const cycle = bowCycle(soldier, t);
        pos.y += cycle.dy;
        pos.z += cycle.dz;
        dummy.position.copy(pos);
        dummy.rotation.set(cycle.rx, cycle.ry, cycle.rz);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        stamp(bodies.current, i);
        stamp(soldierCapes.current, i);
        stamp(soldierPlumes.current, i);
      }
      bodies.current.instanceMatrix.needsUpdate = true;
      if (soldierCapes.current) soldierCapes.current.instanceMatrix.needsUpdate = true;
      if (soldierPlumes.current) soldierPlumes.current.instanceMatrix.needsUpdate = true;
    }
    if (chiefs.current) {
      const n = Math.min(MAX_COMMANDERS, layout.cmd.length);
      chiefs.current.count = n;
      if (chiefCapes.current) chiefCapes.current.count = n;
      if (chiefPlumes.current) chiefPlumes.current.count = n;
      if (swords.current) swords.current.count = n;
      const p = sallyLocal(t);
      const swing = swordSwingU(p, n);
      const cmdScale = scale * 1.26;
      for (let k = 0; k < n; k++) {
        const soldier = layout.cmd[k];
        commanderPos(t, soldier, pos);
        dummy.position.copy(pos);
        dummy.rotation.set(0, Math.PI, 0);
        dummy.scale.setScalar(cmdScale);
        dummy.updateMatrix();
        stamp(chiefs.current, k);
        stamp(chiefCapes.current, k);
        stamp(chiefPlumes.current, k);
        if (swords.current) {
          const [rx, ry, rz] = swordSwingPose(swordStyleAt(p, k), swing);
          dummy.position.set(pos.x - 0.42 * cmdScale, pos.y + 0.86 * cmdScale, pos.z - 0.14 * cmdScale);
          dummy.rotation.set(rx, ry, rz);
          dummy.scale.setScalar(cmdScale);
          dummy.updateMatrix();
          swords.current.setMatrixAt(k, dummy.matrix);
        }
      }
      chiefs.current.instanceMatrix.needsUpdate = true;
      if (chiefCapes.current) chiefCapes.current.instanceMatrix.needsUpdate = true;
      if (chiefPlumes.current) chiefPlumes.current.instanceMatrix.needsUpdate = true;
      if (swords.current) swords.current.instanceMatrix.needsUpdate = true;
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
      const cmd = layout.cmdOf[idx] >= 0;
      poseSoldier(idx, t);
      let nameScale = 1;
      if (cinematic) {
        const recT = t - REEL_HOLD;
        const beats = reelBeats(duration);
        if (recT < 0) {
          tag.visible = false;
          continue;
        }
        if (recT < beats.cmd) nameScale = 0.38;
        else {
          const u = Math.min(1, (recT - beats.cmd) / Math.max(0.2, beats.turn * 0.58));
          const e = u * u * (3 - 2 * u);
          nameScale = 0.38 + 0.62 * e;
        }
      }
      tag.visible = true;
      let lift = 2.78;
      if (!cmd) {
        const slot = layout.slotOf[idx];
        const { row, col } = slotCoord(slot >= 0 ? slot : 0, form.sizes);
        lift = 2.22 + row * 0.5 + (col % 2) * 0.2;
      }
      tag.position.set(pos.x, pos.y + lift * scale, pos.z);
      tag.scale.set(tagData.sx * nameScale, tagData.sy * nameScale, 1);
    }
  }

  useLayoutEffect(() => {
    placeBodies(0);
  }, [visible, instanceCap, labeled]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const { scale } = form;
    const sally = sallyLocal(t);
    const hunt = sallyHunting(sally);
    const enemies = raidCount(visible);

    acc.current += dt;
      if (acc.current >= 1 / 40) {
      acc.current = 0;
      placeBodies(t);
    }

    if (!arrows.current) return;
    if (visible <= 0) {
      shots.current = [];
      arrows.current.count = 0;
      return;
    }

    shots.current = shots.current.filter((s) => t - s.draw < s.flight + 0.45);

    const cap = hunt ? MAX_ARROWS : IDLE_ARROWS;
    if (t >= nextShot.current && shots.current.length < cap) {
      const pair = visible > 6 && shots.current.length === 0 && (hunt || Math.random() < 0.38);
      const burst = hunt ? (pair ? 3 : 2) : pair ? 2 : 1;
      for (let i = 0; i < burst && shots.current.length < cap; i++) {
        if (layout.rest.length <= 0) break;
        const soldier = layout.rest[Math.floor(Math.random() * layout.rest.length)];
        poseSoldier(soldier, t);
        const cmdN = layout.cmd.length;
        const idx = hunt ? sallyLiveIndex(sally, enemies, soldier + i * 11, cmdN) : -1;
        const prey = idx >= 0 ? sallyRaiderAt(sally, idx, enemies, cmdN) : null;
        const draw = t + i * 0.05;
        shots.current.push({
          soldier,
          draw,
          born: draw + 0.36,
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
      const pace = hunt ? 0.08 : 0.7 - Math.min(0.35, (visible / 5000) * 0.35);
      nextShot.current = t + pace + Math.random() * (hunt ? 0.04 : 0.28);
    }

    const live = shots.current.filter((s) => t >= s.born && t - s.born < s.flight);
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
      <instancedMesh key={instanceCap} ref={bodies} args={[archerGeo, undefined, instanceCap]} frustumCulled={false} castShadow>
        <meshStandardMaterial vertexColors roughness={0.32} metalness={0.62} envMapIntensity={1.15} />
      </instancedMesh>
      <instancedMesh ref={soldierCapes} args={[soldierCapeGeo, undefined, instanceCap]} frustumCulled={false} castShadow>
        <meshStandardMaterial vertexColors roughness={0.88} metalness={0.02} envMapIntensity={0.15} />
      </instancedMesh>
      <instancedMesh ref={soldierPlumes} args={[soldierPlumeGeo, undefined, instanceCap]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.78} metalness={0} />
      </instancedMesh>
      <instancedMesh ref={chiefs} args={[commanderGeo, undefined, MAX_COMMANDERS]} frustumCulled={false} castShadow>
        <meshStandardMaterial vertexColors roughness={0.26} metalness={0.72} envMapIntensity={1.35} />
      </instancedMesh>
      <instancedMesh ref={chiefCapes} args={[commanderCapeGeo, undefined, MAX_COMMANDERS]} frustumCulled={false} castShadow>
        <meshStandardMaterial vertexColors roughness={0.9} metalness={0.02} envMapIntensity={0.12} />
      </instancedMesh>
      <instancedMesh ref={chiefPlumes} args={[commanderPlumeGeo, undefined, MAX_COMMANDERS]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.74} metalness={0} />
      </instancedMesh>
      <instancedMesh ref={swords} args={[swordGeo, undefined, MAX_COMMANDERS]} frustumCulled={false} castShadow>
        <meshStandardMaterial vertexColors roughness={0.18} metalness={0.78} envMapIntensity={1.4} />
      </instancedMesh>
      <instancedMesh ref={arrows} args={[undefined, undefined, MAX_ARROWS]} frustumCulled={false}>
        <cylinderGeometry args={[0.055, 0.02, 1.45, 6]} />
        <meshBasicMaterial color="#ffd078" />
      </instancedMesh>
      <SwordFlash />
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
