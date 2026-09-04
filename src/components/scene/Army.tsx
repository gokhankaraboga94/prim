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

const ARMOR = "#2a2e34";
const ARMOR_DK = "#16181c";
const ARMOR_HI = "#4a5058";
const GOLD = "#c9a24a";
const GOLD_DK = "#8a6a1c";
const SLIT = "#040406";
const LEATHER = "#141210";
const PLUME = "#0c0c0e";
const PLUME_HI = "#1a1a1e";
const BLUE = "#0437f2";
const BLUE_DK = "#0327a9";
const BLACK = "#070709";
const BLACK_LINING = "#121218";

function mergeParts(pieces: THREE.BufferGeometry[], fallback: string) {
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  return merged || colorize(new THREE.BoxGeometry(0.4, 1.2, 0.28), fallback);
}

function helmBowl(seg: number) {
  const pts = [
    new THREE.Vector2(0.012, 0.21),
    new THREE.Vector2(0.1, 0.2),
    new THREE.Vector2(0.158, 0.15),
    new THREE.Vector2(0.182, 0.06),
    new THREE.Vector2(0.186, -0.02),
    new THREE.Vector2(0.18, -0.1),
    new THREE.Vector2(0.172, -0.2),
    new THREE.Vector2(0.166, -0.3),
    new THREE.Vector2(0.194, -0.34),
  ];
  return new THREE.LatheGeometry(pts, seg);
}

function corinthianShell(seg = 16) {
  return [
    part(helmBowl(seg), ARMOR, 0, 1.46, 0.02),
    part(new THREE.SphereGeometry(0.178, seg, 12), ARMOR_HI, 0, 1.5, 0.01),
    part(new THREE.SphereGeometry(0.155, 10, 8), ARMOR_DK, 0, 1.28, 0.08),
    part(new THREE.BoxGeometry(0.11, 0.24, 0.16), ARMOR, -0.135, 1.24, 0.12),
    part(new THREE.BoxGeometry(0.11, 0.24, 0.16), ARMOR, 0.135, 1.24, 0.12),
    part(new THREE.BoxGeometry(0.26, 0.07, 0.07), SLIT, 0, 1.37, 0.185),
    part(new THREE.BoxGeometry(0.038, 0.2, 0.07), SLIT, 0, 1.25, 0.188),
    part(new THREE.BoxGeometry(0.28, 0.016, 0.02), GOLD, 0, 1.408, 0.212),
    part(new THREE.BoxGeometry(0.28, 0.016, 0.02), GOLD, 0, 1.332, 0.212),
    part(new THREE.BoxGeometry(0.016, 0.22, 0.02), GOLD, -0.128, 1.37, 0.212),
    part(new THREE.BoxGeometry(0.016, 0.22, 0.02), GOLD, 0.128, 1.37, 0.212),
    part(new THREE.BoxGeometry(0.05, 0.22, 0.022), GOLD, 0, 1.25, 0.218),
    part(new THREE.CylinderGeometry(0.16, 0.2, 0.06, seg), ARMOR_DK, 0, 1.12, 0.02),
    part(new THREE.TorusGeometry(0.178, 0.012, 6, seg), GOLD, 0, 1.135, 0.02, Math.PI / 2),
    part(new THREE.BoxGeometry(0.055, 0.08, 0.34), ARMOR_HI, 0, 1.64, 0.01),
    part(new THREE.BoxGeometry(0.07, 0.03, 0.28), GOLD_DK, 0, 1.58, 0.01),
  ];
}

function helmPlume(tall: boolean) {
  const h = tall ? 0.58 : 0.4;
  const d = tall ? 0.38 : 0.3;
  return [
    part(new THREE.BoxGeometry(0.1, h, d), PLUME, 0, 1.7 + h * 0.22, 0.02),
    part(new THREE.BoxGeometry(0.07, h * 0.88, d * 0.78), PLUME_HI, 0, 1.66 + h * 0.18, -0.04),
    part(new THREE.BoxGeometry(0.055, h * 0.55, d * 0.55), PLUME, 0, 1.88 + h * 0.12, 0.04),
    part(new THREE.BoxGeometry(0.08, 0.16, 0.1), PLUME, 0, 1.58, -0.16),
  ];
}

function plateArmor() {
  const flaps: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 0.05;
    flaps.push(part(new THREE.BoxGeometry(0.046, 0.28, 0.05), LEATHER, x, 0.64, 0.12));
    flaps.push(part(new THREE.BoxGeometry(0.046, 0.26, 0.042), ARMOR_DK, x, 0.62, -0.1));
  }
  return [
    part(new THREE.BoxGeometry(0.15, 0.1, 0.24), ARMOR_DK, -0.1, 0.05, 0.04),
    part(new THREE.BoxGeometry(0.15, 0.1, 0.24), ARMOR_DK, 0.1, 0.05, 0.04),
    part(new THREE.CylinderGeometry(0.058, 0.072, 0.28, 10), ARMOR, -0.1, 0.22, 0.03),
    part(new THREE.CylinderGeometry(0.058, 0.072, 0.28, 10), ARMOR, 0.1, 0.22, 0.03),
    part(new THREE.BoxGeometry(0.018, 0.26, 0.02), GOLD_DK, -0.16, 0.22, 0.09),
    part(new THREE.BoxGeometry(0.018, 0.26, 0.02), GOLD_DK, 0.16, 0.22, 0.09),
    part(new THREE.CylinderGeometry(0.08, 0.095, 0.28, 10), ARMOR, -0.1, 0.48, 0.02),
    part(new THREE.CylinderGeometry(0.08, 0.095, 0.28, 10), ARMOR, 0.1, 0.48, 0.02),
    ...flaps,
    part(new THREE.BoxGeometry(0.42, 0.08, 0.24), ARMOR_HI, 0, 0.8, 0.02),
    part(new THREE.BoxGeometry(0.11, 0.055, 0.055), GOLD, 0, 0.8, 0.15),
    part(new THREE.BoxGeometry(0.4, 0.44, 0.18), ARMOR, 0, 1.04, 0.03),
    part(new THREE.BoxGeometry(0.06, 0.4, 0.04), ARMOR_HI, 0, 1.04, 0.12),
    part(new THREE.BoxGeometry(0.36, 0.016, 0.2), GOLD, 0, 1.24, 0.04),
    part(new THREE.BoxGeometry(0.36, 0.012, 0.02), GOLD, 0, 0.86, 0.13),
    part(new THREE.BoxGeometry(0.014, 0.4, 0.02), GOLD, 0, 1.04, 0.13),
    part(new THREE.BoxGeometry(0.014, 0.4, 0.02), GOLD, -0.18, 1.04, 0.125),
    part(new THREE.BoxGeometry(0.014, 0.4, 0.02), GOLD, 0.18, 1.04, 0.125),
    part(new THREE.SphereGeometry(0.175, 14, 12), ARMOR_HI, -0.3, 1.18, 0.02),
    part(new THREE.SphereGeometry(0.175, 14, 12), ARMOR_HI, 0.3, 1.18, 0.02),
    part(new THREE.SphereGeometry(0.125, 12, 10), ARMOR, -0.34, 1.08, 0.06),
    part(new THREE.SphereGeometry(0.125, 12, 10), ARMOR, 0.34, 1.08, 0.06),
    part(new THREE.TorusGeometry(0.112, 0.016, 7, 14), GOLD, -0.3, 1.04, 0.05, Math.PI / 2),
    part(new THREE.TorusGeometry(0.112, 0.016, 7, 14), GOLD, 0.3, 1.04, 0.05, Math.PI / 2),
    ...arm(-1),
    ...arm(1),
    part(new THREE.CylinderGeometry(0.07, 0.07, 0.032, 16), GOLD, -0.15, 1.22, 0.14, Math.PI / 2),
    part(new THREE.CylinderGeometry(0.07, 0.07, 0.032, 16), GOLD, 0.15, 1.22, 0.14, Math.PI / 2),
    part(new THREE.CylinderGeometry(0.038, 0.038, 0.022, 12), GOLD_DK, -0.15, 1.22, 0.16, Math.PI / 2),
    part(new THREE.CylinderGeometry(0.038, 0.038, 0.022, 12), GOLD_DK, 0.15, 1.22, 0.16, Math.PI / 2),
    part(new THREE.TorusGeometry(0.052, 0.008, 6, 12), GOLD, -0.15, 1.22, 0.155, Math.PI / 2),
    part(new THREE.TorusGeometry(0.052, 0.008, 6, 12), GOLD, 0.15, 1.22, 0.155, Math.PI / 2),
  ];
}

function arm(side: -1 | 1) {
  const s = side;
  const hx = s * 0.4;
  const hy = 0.58;
  const hz = 0.14;
  const digits: THREE.BufferGeometry[] = [];
  const spread = [-0.028, -0.01, 0.008, 0.026];
  for (let i = 0; i < 4; i++) {
    const fx = hx + spread[i];
    const fy = hy - 0.055;
    const fz = hz + 0.04 + i * 0.004;
    digits.push(part(new THREE.CylinderGeometry(0.013, 0.015, 0.046, 7), LEATHER, fx, fy, fz, 0.85, 0, s * 0.08));
    digits.push(part(new THREE.CylinderGeometry(0.011, 0.013, 0.038, 7), LEATHER, fx, fy - 0.038, fz + 0.02, 1.05, 0, s * 0.06));
    digits.push(part(new THREE.SphereGeometry(0.012, 6, 5), LEATHER, fx, fy - 0.058, fz + 0.034));
  }
  return [
    part(new THREE.CylinderGeometry(0.058, 0.068, 0.26, 12), ARMOR, s * 0.3, 1.02, 0.04, 0.08, 0, s * 0.22),
    part(new THREE.SphereGeometry(0.052, 10, 8), ARMOR_HI, s * 0.35, 0.88, 0.07),
    part(new THREE.CylinderGeometry(0.05, 0.056, 0.24, 12), ARMOR_DK, s * 0.38, 0.74, 0.1, 0.18, 0, s * 0.08),
    part(new THREE.BoxGeometry(0.018, 0.18, 0.016), GOLD, s * 0.38, 0.74, 0.15),
    part(new THREE.TorusGeometry(0.048, 0.01, 7, 12), GOLD, s * 0.39, 0.64, 0.12, Math.PI / 2),
    part(new THREE.CylinderGeometry(0.04, 0.042, 0.05, 10), LEATHER, hx, 0.62, 0.13, 0.2, 0, s * 0.04),
    part(new THREE.BoxGeometry(0.072, 0.09, 0.048), LEATHER, hx, hy, hz, 0.25, 0, s * 0.05),
    part(new THREE.SphereGeometry(0.028, 8, 6), LEATHER, hx, hy - 0.02, hz + 0.01),
    ...digits,
    part(new THREE.CylinderGeometry(0.014, 0.016, 0.042, 7), LEATHER, hx - s * 0.028, hy + 0.012, hz + 0.01, 0.35, 0, s * -0.85),
    part(new THREE.CylinderGeometry(0.012, 0.014, 0.032, 7), LEATHER, hx - s * 0.04, hy + 0.004, hz + 0.028, 0.55, 0, s * -0.7),
    part(new THREE.SphereGeometry(0.013, 6, 5), LEATHER, hx - s * 0.048, hy - 0.006, hz + 0.042),
  ];
}

function wrapCape(cloth: string, lining: string) {
  return [
    part(new THREE.BoxGeometry(0.58, 0.94, 0.05), cloth, 0, 0.76, -0.2),
    part(new THREE.BoxGeometry(0.44, 0.58, 0.035), lining, 0, 0.62, -0.23),
    part(new THREE.BoxGeometry(0.6, 0.14, 0.07), cloth, 0, 1.18, -0.12),
    part(new THREE.BoxGeometry(0.16, 0.12, 0.07), cloth, -0.16, 1.17, 0.02),
    part(new THREE.BoxGeometry(0.16, 0.12, 0.07), cloth, 0.16, 1.17, 0.02),
    part(new THREE.BoxGeometry(0.12, 0.72, 0.04), cloth, -0.24, 0.82, -0.1, 0, 0.12, 0.03),
    part(new THREE.BoxGeometry(0.12, 0.72, 0.04), cloth, 0.24, 0.82, -0.1, 0, -0.12, -0.03),
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

function hipScabbard() {
  return [
    part(new THREE.BoxGeometry(0.055, 0.46, 0.085), ARMOR_DK, -0.22, 0.7, 0.16, 0, 0.2, 0.4),
    part(new THREE.BoxGeometry(0.072, 0.05, 0.09), GOLD, -0.2, 0.9, 0.16, 0, 0.2, 0.4),
  ];
}

function createArcherGeometry() {
  return mergeParts([...plateArmor(), ...corinthianShell(14), ...bowKit()], ARMOR);
}

function createCommanderGeometry() {
  return mergeParts([...plateArmor(), ...corinthianShell(18), ...hipScabbard()], ARMOR);
}

function createCapeGeometry(cloth: string, lining: string) {
  return mergeParts(wrapCape(cloth, lining), cloth);
}

function createPlumeGeometry(tall: boolean) {
  return mergeParts(helmPlume(tall), PLUME);
}

let archerGeoV8: THREE.BufferGeometry | null = null;
let commanderGeoV8: THREE.BufferGeometry | null = null;
let soldierCapeV9: THREE.BufferGeometry | null = null;
let commanderCapeV9: THREE.BufferGeometry | null = null;
let soldierPlumeV8: THREE.BufferGeometry | null = null;
let commanderPlumeV8: THREE.BufferGeometry | null = null;
let nockArrowGeo: THREE.BufferGeometry | null = null;
const nockOff = new THREE.Vector3();

function getArcherGeometry() {
  if (!archerGeoV8) archerGeoV8 = createArcherGeometry();
  return archerGeoV8;
}

function getCommanderGeometry() {
  if (!commanderGeoV8) commanderGeoV8 = createCommanderGeometry();
  return commanderGeoV8;
}

function getSoldierCapeGeometry() {
  if (!soldierCapeV9) soldierCapeV9 = createCapeGeometry(BLUE, BLUE_DK);
  return soldierCapeV9;
}

function getCommanderCapeGeometry() {
  if (!commanderCapeV9) commanderCapeV9 = createCapeGeometry(BLACK, BLACK_LINING);
  return commanderCapeV9;
}

function getSoldierPlumeGeometry() {
  if (!soldierPlumeV8) soldierPlumeV8 = createPlumeGeometry(false);
  return soldierPlumeV8;
}

function getCommanderPlumeGeometry() {
  if (!commanderPlumeV8) commanderPlumeV8 = createPlumeGeometry(true);
  return commanderPlumeV8;
}

function createNockArrowGeometry() {
  const pieces = [
    part(new THREE.CylinderGeometry(0.011, 0.013, 0.78, 7), "#6a4a28", 0, 0, 0, Math.PI / 2),
    part(new THREE.ConeGeometry(0.022, 0.08, 7), "#c8ccd2", 0, 0, 0.42, Math.PI / 2),
    part(new THREE.BoxGeometry(0.055, 0.012, 0.07), "#8b1d1d", 0, 0.028, -0.32),
    part(new THREE.BoxGeometry(0.012, 0.055, 0.07), "#8b1d1d", 0.028, 0, -0.32),
    part(new THREE.BoxGeometry(0.012, 0.055, 0.07), "#8b1d1d", -0.028, 0, -0.32),
    part(new THREE.BoxGeometry(0.02, 0.02, 0.03), "#3a2a18", 0, 0, -0.4),
  ];
  return mergeParts(pieces, "#6a4a28");
}

function getNockArrowGeometry() {
  if (!nockArrowGeo) nockArrowGeo = createNockArrowGeometry();
  return nockArrowGeo;
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
  const nocks = useRef<THREE.InstancedMesh>(null);
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
  const nockGeo = useMemo(() => getNockArrowGeometry(), []);

  const visible = Math.min(MAX_SOLDIERS, Math.max(0, Math.floor(count)));
  const instanceCap = Math.min(MAX_SOLDIERS, Math.max(visible, 1));
  const layout = useMemo(() => buildLayout(names, commanders, visible), [names, commanders, visible]);
  const form = useMemo(() => ({ sizes: layout.sizes, scale: 1.28 }), [layout.sizes]);
  const steelRough = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#6a6a6a";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.14})`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 12, 1);
    }
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.16})`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 10 + Math.random() * 36, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.anisotropy = 8;
    return tex;
  }, []);
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
      raise,
      draw,
      loose,
      rx: -0.08 * raise - 0.14 * draw + 0.1 * loose + sway,
      ry: Math.PI - 0.04 * raise - 0.06 * draw + 0.03 * loose,
      rz: 0.02 * raise + 0.03 * draw,
      dz: 0.04 * draw,
      dy: 0.02 * draw,
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
      if (nocks.current) nocks.current.count = n;
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
        if (nocks.current) {
          const aim = cycle.raise * (1 - cycle.loose);
          if (aim > 0.12) {
            nockOff.set(0.14, 1.04 + cycle.draw * 0.03, 0.22 - cycle.draw * 0.1);
            nockOff.applyEuler(dummy.rotation);
            nockOff.multiplyScalar(scale);
            dummy.position.set(pos.x + nockOff.x, pos.y + nockOff.y, pos.z + nockOff.z);
            dummy.rotation.set(cycle.rx - 0.18 - cycle.draw * 0.1, cycle.ry, cycle.rz);
            dummy.scale.setScalar(scale * (0.92 + aim * 0.1));
            dummy.updateMatrix();
            nocks.current.setMatrixAt(i, dummy.matrix);
          } else {
            dummy.scale.setScalar(0);
            dummy.updateMatrix();
            nocks.current.setMatrixAt(i, dummy.matrix);
          }
        }
      }
      bodies.current.instanceMatrix.needsUpdate = true;
      if (soldierCapes.current) soldierCapes.current.instanceMatrix.needsUpdate = true;
      if (soldierPlumes.current) soldierPlumes.current.instanceMatrix.needsUpdate = true;
      if (nocks.current) nocks.current.instanceMatrix.needsUpdate = true;
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
      let lift = 2.92;
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
        <meshPhysicalMaterial
          vertexColors
          roughness={0.42}
          metalness={0.82}
          roughnessMap={steelRough ?? undefined}
          envMapIntensity={1.25}
          clearcoat={0.28}
          clearcoatRoughness={0.45}
        />
      </instancedMesh>
      <instancedMesh key="cape-v9" ref={soldierCapes} args={[soldierCapeGeo, undefined, instanceCap]} frustumCulled={false} castShadow>
        <meshStandardMaterial color="#0437f2" roughness={0.88} metalness={0} envMapIntensity={0.08} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={soldierPlumes} args={[soldierPlumeGeo, undefined, instanceCap]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.86} metalness={0} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={chiefs} args={[commanderGeo, undefined, MAX_COMMANDERS]} frustumCulled={false} castShadow>
        <meshPhysicalMaterial
          vertexColors
          roughness={0.36}
          metalness={0.88}
          roughnessMap={steelRough ?? undefined}
          envMapIntensity={1.45}
          clearcoat={0.35}
          clearcoatRoughness={0.38}
        />
      </instancedMesh>
      <instancedMesh ref={chiefCapes} args={[commanderCapeGeo, undefined, MAX_COMMANDERS]} frustumCulled={false} castShadow>
        <meshStandardMaterial vertexColors roughness={0.94} metalness={0} envMapIntensity={0.06} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={chiefPlumes} args={[commanderPlumeGeo, undefined, MAX_COMMANDERS]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.88} metalness={0} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={swords} args={[swordGeo, undefined, MAX_COMMANDERS]} frustumCulled={false} castShadow>
        <meshPhysicalMaterial vertexColors roughness={0.2} metalness={0.9} envMapIntensity={1.5} clearcoat={0.4} />
      </instancedMesh>
      <instancedMesh ref={nocks} args={[nockGeo, undefined, instanceCap]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.55} metalness={0.28} />
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
