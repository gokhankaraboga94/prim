import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DEFAULT_COMMANDER, effectiveCommanders, isCommander } from "../../game";
import { REEL_HOLD, reelBeats } from "../../recordCanvas";
import { rosterBeat, rosterSoldierIds, stampRosterSoldier, type PlanBId, type RosterPose } from "../../rosterReel";
import { discoverBeat, DISCOVER_HOOK_END, DISCOVER3_ID, RAF2_ID, shelfBeat, trailerBeat, type DiscoverId } from "../../discoverReel";
import { raidCount, sallyHunting, sallyLiveIndex, sallyLocal, sallyRaiderAt, swordArmPose, swordStyleAt, swordSwingU } from "../../siegeEvent";
import { castleFrame } from "../../castleLayout";

const MAX_SOLDIERS = 5000;
const MAX_LABELS = 400;
const MAX_REEL_LABELS = 120;
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
  skipCommander?: boolean;
  roster?: PlanBId | null;
  discover?: DiscoverId | null;
  mix?: boolean;
  level?: number;
  rosterIds?: number[] | null;
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
const BLACK = "#070709";
const BLACK_LINING = "#121218";
const HELM = "#1a2430";
const HELM_HI = "#2a3648";
const HELM_DK = "#0c1016";
const SKIN = "#c9a57c";
const SKIN_DK = "#9a7352";
const NAIL = "#e4c9a4";
const WOOD = "#4a3018";
const WOOD_HI = "#6a4422";
const HORN = "#c4b48a";
const STRING = "#d8d2c4";
const L_SHOULDER = new THREE.Vector3(-0.28, 1.16, 0.03);
const R_SHOULDER = new THREE.Vector3(0.28, 1.16, 0.03);
const _limbPos = new THREE.Vector3();
const _limbQuat = new THREE.Quaternion();
const _limbScl = new THREE.Vector3();
const _bodyQ = new THREE.Quaternion();
const _extraQ = new THREE.Quaternion();
const _limbEul = new THREE.Euler();
const rosterPose: RosterPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scaleMul: 1, nameMul: 1 };

function mergeParts(pieces: THREE.BufferGeometry[], fallback: string) {
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  return merged || colorize(new THREE.BoxGeometry(0.4, 1.2, 0.28), fallback);
}

function helmBowl(seg: number) {
  const pts = [
    new THREE.Vector2(0.01, 0.24),
    new THREE.Vector2(0.092, 0.228),
    new THREE.Vector2(0.158, 0.175),
    new THREE.Vector2(0.192, 0.08),
    new THREE.Vector2(0.2, -0.02),
    new THREE.Vector2(0.192, -0.12),
    new THREE.Vector2(0.178, -0.22),
    new THREE.Vector2(0.17, -0.32),
    new THREE.Vector2(0.205, -0.38),
  ];
  return new THREE.LatheGeometry(pts, seg);
}

function eyeSocket(x: number) {
  return [
    part(new THREE.BoxGeometry(0.1, 0.062, 0.09), SLIT, x, 1.378, 0.188),
    part(new THREE.BoxGeometry(0.086, 0.046, 0.04), "#020204", x, 1.378, 0.228),
    part(new THREE.BoxGeometry(0.108, 0.012, 0.014), HELM_HI, x, 1.414, 0.236),
    part(new THREE.BoxGeometry(0.108, 0.012, 0.014), HELM_HI, x, 1.342, 0.236),
    part(new THREE.BoxGeometry(0.012, 0.066, 0.014), HELM_HI, x - 0.052, 1.378, 0.236),
    part(new THREE.BoxGeometry(0.012, 0.066, 0.014), HELM_HI, x + 0.052, 1.378, 0.236),
  ];
}

function corinthianShell(seg = 16) {
  return [
    part(helmBowl(seg), HELM, 0, 1.48, 0.02),
    part(new THREE.SphereGeometry(0.192, seg, 14), HELM_HI, 0, 1.53, 0.01),
    part(new THREE.SphereGeometry(0.128, 12, 10), HELM, -0.112, 1.28, 0.06),
    part(new THREE.SphereGeometry(0.128, 12, 10), HELM, 0.112, 1.28, 0.06),
    part(new THREE.SphereGeometry(0.155, 14, 12, 0, Math.PI * 2, Math.PI * 0.28, Math.PI * 0.42), HELM, 0, 1.33, 0.05),
    part(new THREE.TorusGeometry(0.138, 0.018, 7, 18, Math.PI), HELM_HI, 0, 1.43, 0.15, -Math.PI / 2),
    part(new THREE.BoxGeometry(0.034, 0.15, 0.05), HELM_HI, 0, 1.3, 0.208),
    part(new THREE.BoxGeometry(0.028, 0.08, 0.04), HELM, 0, 1.22, 0.2),
    ...eyeSocket(-0.058),
    ...eyeSocket(0.058),
    part(new THREE.BoxGeometry(0.042, 0.1, 0.055), SLIT, 0, 1.21, 0.198),
    part(new THREE.CylinderGeometry(0.168, 0.218, 0.075, seg), HELM_DK, 0, 1.1, 0.02),
    part(new THREE.TorusGeometry(0.195, 0.013, 6, seg), HELM_HI, 0, 1.132, 0.02, Math.PI / 2),
    part(new THREE.BoxGeometry(0.046, 0.072, 0.3), HELM_HI, 0, 1.67, 0.01),
  ];
}

function commanderHelmBowl(seg: number) {
  const pts = [
    new THREE.Vector2(0.008, 0.27),
    new THREE.Vector2(0.068, 0.262),
    new THREE.Vector2(0.138, 0.228),
    new THREE.Vector2(0.186, 0.15),
    new THREE.Vector2(0.208, 0.05),
    new THREE.Vector2(0.212, -0.05),
    new THREE.Vector2(0.2, -0.16),
    new THREE.Vector2(0.188, -0.26),
    new THREE.Vector2(0.18, -0.35),
    new THREE.Vector2(0.208, -0.42),
  ];
  return new THREE.LatheGeometry(pts, seg);
}

function commanderHelm() {
  return [
    part(commanderHelmBowl(24), HELM, 0, 1.5, 0.01),
    part(new THREE.SphereGeometry(0.192, 22, 16), HELM_HI, 0, 1.55, 0),
    part(new THREE.BoxGeometry(0.11, 0.3, 0.15), HELM_DK, -0.145, 1.26, 0.1),
    part(new THREE.BoxGeometry(0.11, 0.3, 0.15), HELM_DK, 0.145, 1.26, 0.1),
    part(new THREE.SphereGeometry(0.152, 12, 10), HELM, -0.1, 1.28, 0.05),
    part(new THREE.SphereGeometry(0.152, 12, 10), HELM, 0.1, 1.28, 0.05),
    part(new THREE.BoxGeometry(0.22, 0.3, 0.07), HELM, 0, 1.32, 0.155),
    part(new THREE.BoxGeometry(0.2, 0.012, 0.02), GOLD, 0, 1.46, 0.188),
    part(new THREE.BoxGeometry(0.016, 0.28, 0.022), GOLD, -0.2, 1.26, 0.165),
    part(new THREE.BoxGeometry(0.016, 0.28, 0.022), GOLD, 0.2, 1.26, 0.165),
    part(new THREE.BoxGeometry(0.13, 0.016, 0.022), GOLD, -0.155, 1.115, 0.175),
    part(new THREE.BoxGeometry(0.13, 0.016, 0.022), GOLD, 0.155, 1.115, 0.175),
    part(new THREE.CylinderGeometry(0.175, 0.228, 0.075, 22), HELM_DK, 0, 1.08, 0.02),
    part(new THREE.TorusGeometry(0.2, 0.015, 8, 24), GOLD, 0, 1.105, 0.02, Math.PI / 2),
    part(new THREE.BoxGeometry(0.072, 0.11, 0.46), HELM_HI, 0, 1.72, 0),
    part(new THREE.BoxGeometry(0.082, 0.028, 0.48), GOLD, 0, 1.655, 0),
    part(new THREE.BoxGeometry(0.082, 0.028, 0.48), GOLD, 0, 1.772, 0),
    part(new THREE.BoxGeometry(0.086, 0.022, 0.42), "#2a1c10", 0, 1.79, 0),
    part(new THREE.BoxGeometry(0.042, 0.065, 0.085), GOLD, 0, 1.7, 0.24),
    part(new THREE.BoxGeometry(0.042, 0.065, 0.085), GOLD, 0, 1.7, -0.24),
    part(new THREE.BoxGeometry(0.062, 0.058, 0.042), GOLD, 0, 1.23, -0.168),
    part(new THREE.BoxGeometry(0.056, 0.05, 0.04), GOLD_DK, 0, 1.168, -0.176),
    part(new THREE.BoxGeometry(0.05, 0.046, 0.038), GOLD, 0, 1.11, -0.18),
    part(new THREE.BoxGeometry(0.046, 0.04, 0.036), GOLD_DK, 0, 1.058, -0.174),
  ];
}

function commanderFace() {
  return [
    part(new THREE.SphereGeometry(0.135, 16, 13), SKIN, 0, 1.365, 0.042),
    part(new THREE.SphereGeometry(0.03, 8, 7), SKIN_DK, 0, 1.305, 0.142),
    part(new THREE.SphereGeometry(0.018, 7, 6), SKIN, 0, 1.318, 0.164),
    part(new THREE.SphereGeometry(0.014, 8, 6), "#f2eee6", -0.032, 1.4, 0.162),
    part(new THREE.SphereGeometry(0.014, 8, 6), "#f2eee6", 0.032, 1.4, 0.162),
    part(new THREE.SphereGeometry(0.007, 6, 5), "#1a1008", -0.032, 1.4, 0.174),
    part(new THREE.SphereGeometry(0.007, 6, 5), "#1a1008", 0.032, 1.4, 0.174),
    part(new THREE.BoxGeometry(0.052, 0.009, 0.012), "#6a3a32", 0, 1.242, 0.158),
    part(new THREE.BoxGeometry(0.072, 0.014, 0.032), SKIN_DK, 0, 1.218, 0.122),
  ];
}

function horsehairPlume(tall: boolean) {
  const strands: THREE.BufferGeometry[] = [];
  const n = tall ? 14 : 7;
  const baseH = tall ? 0.68 : 0.4;
  const baseY = 1.8;
  const span = tall ? 0.54 : 0.34;
  for (let i = 0; i < n; i++) {
    const u = n <= 1 ? 0.5 : i / (n - 1);
    const z = (u - 0.5) * span;
    const arch = Math.sin(u * Math.PI);
    const h = baseH * (0.58 + 0.55 * arch);
    const x = ((i % 3) - 1) * 0.013;
    const lean = (u - 0.5) * 0.42;
    const col = i % 3 === 0 ? PLUME_HI : PLUME;
    strands.push(part(new THREE.BoxGeometry(0.018 + (i % 2) * 0.008, h, 0.03), col, x, baseY + h * 0.36, z, lean * 0.18, 0, 0));
  }
  strands.push(part(new THREE.BoxGeometry(0.072, 0.2, 0.11), PLUME, 0, 1.64, -0.24, 0.42));
  return strands;
}

function plateArmor(withArms: boolean | "left" = true) {
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
    part(new THREE.BoxGeometry(0.42, 0.46, 0.16), ARMOR, 0, 1.04, 0.02),
    part(new THREE.BoxGeometry(0.06, 0.42, 0.03), ARMOR_HI, 0, 1.04, 0.105),
    part(new THREE.BoxGeometry(0.38, 0.014, 0.18), GOLD, 0, 1.25, 0.03),
    part(new THREE.BoxGeometry(0.38, 0.01, 0.018), GOLD, 0, 0.84, 0.108),
    part(new THREE.BoxGeometry(0.012, 0.42, 0.018), GOLD, 0, 1.04, 0.108),
    part(new THREE.BoxGeometry(0.012, 0.42, 0.018), GOLD, -0.19, 1.04, 0.104),
    part(new THREE.BoxGeometry(0.012, 0.42, 0.018), GOLD, 0.19, 1.04, 0.104),
    part(new THREE.BoxGeometry(0.2, 0.16, 0.14), ARMOR_HI, -0.34, 1.2, -0.02),
    part(new THREE.BoxGeometry(0.2, 0.16, 0.14), ARMOR_HI, 0.34, 1.2, -0.02),
    part(new THREE.TorusGeometry(0.08, 0.012, 6, 12), GOLD, -0.34, 1.12, 0.02, Math.PI / 2),
    part(new THREE.TorusGeometry(0.08, 0.012, 6, 12), GOLD, 0.34, 1.12, 0.02, Math.PI / 2),
    ...(withArms === true ? [...arm(-1), ...arm(1)] : withArms === "left" ? [...arm(1)] : []),
  ];
}

function fingers(hx: number, hy: number, hz: number, s: -1 | 1, curl: number, spreadMul = 1) {
  const digits: THREE.BufferGeometry[] = [];
  const spread = [-0.038, -0.013, 0.012, 0.037].map((v) => v * spreadMul);
  const lens = [0.05, 0.056, 0.054, 0.044];
  for (let i = 0; i < 4; i++) {
    const fx = hx + spread[i];
    const pitch = 0.4 + curl * 0.92;
    const len = lens[i];
    const dip = hy - 0.016 - curl * 0.01;
    const tipZ = hz + 0.05 + curl * 0.02;
    digits.push(part(new THREE.BoxGeometry(0.022, len, 0.022), SKIN, fx, dip - len * 0.26, hz + 0.034, pitch, 0, s * 0.05));
    digits.push(part(new THREE.SphereGeometry(0.012, 8, 6), SKIN_DK, fx, dip - len * 0.5, hz + 0.042 + curl * 0.008));
    digits.push(
      part(
        new THREE.BoxGeometry(0.018, len * 0.7, 0.018),
        SKIN,
        fx,
        dip - len * 0.76,
        hz + 0.05 + curl * 0.016,
        pitch + 0.4 * curl,
        0,
        s * 0.04
      )
    );
    digits.push(
      part(new THREE.BoxGeometry(0.014, 0.012, 0.006), NAIL, fx, dip - len * 1.02, tipZ, pitch + 0.55 * curl, 0, s * 0.04)
    );
  }
  digits.push(part(new THREE.SphereGeometry(0.016, 8, 6), SKIN, hx - s * 0.04, hy + 0.012, hz + 0.018));
  digits.push(
    part(new THREE.BoxGeometry(0.02, 0.05, 0.02), SKIN, hx - s * 0.046, hy + 0.004, hz + 0.032, 0.52, 0, s * -0.95)
  );
  digits.push(part(new THREE.SphereGeometry(0.01, 7, 6), SKIN_DK, hx - s * 0.052, hy - 0.006, hz + 0.042));
  digits.push(
    part(new THREE.BoxGeometry(0.016, 0.034, 0.016), SKIN, hx - s * 0.056, hy - 0.012, hz + 0.046, 0.82, 0, s * -0.68)
  );
  digits.push(
    part(new THREE.BoxGeometry(0.012, 0.01, 0.005), NAIL, hx - s * 0.062, hy - 0.026, hz + 0.058, 0.95, 0, s * -0.55)
  );
  return digits;
}

function arm(side: -1 | 1) {
  const s = side;
  const hx = s * 0.4;
  const hy = 0.58;
  const hz = 0.14;
  return [
    part(new THREE.CylinderGeometry(0.058, 0.068, 0.26, 12), ARMOR, s * 0.3, 1.02, 0.04, 0.08, 0, s * 0.22),
    part(new THREE.SphereGeometry(0.052, 10, 8), ARMOR_HI, s * 0.35, 0.88, 0.07),
    part(new THREE.CylinderGeometry(0.05, 0.056, 0.24, 12), ARMOR_DK, s * 0.38, 0.74, 0.1, 0.18, 0, s * 0.08),
    part(new THREE.BoxGeometry(0.018, 0.18, 0.016), GOLD, s * 0.38, 0.74, 0.15),
    part(new THREE.TorusGeometry(0.048, 0.01, 7, 12), GOLD, s * 0.39, 0.64, 0.12, Math.PI / 2),
    part(new THREE.CylinderGeometry(0.04, 0.042, 0.05, 10), LEATHER, hx, 0.62, 0.13, 0.2, 0, s * 0.04),
    part(new THREE.BoxGeometry(0.072, 0.09, 0.048), LEATHER, hx, hy, hz, 0.25, 0, s * 0.05),
    part(new THREE.SphereGeometry(0.026, 8, 6), SKIN, hx, hy - 0.018, hz + 0.01),
    ...fingers(hx, hy, hz, s, 0.35),
  ];
}

function bowLimb(x: number, y: number, z: number, dir: 1 | -1) {
  const segs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.5) / 5;
    const a = t * 1.22 * dir;
    const yy = y + Math.sin(a) * 0.52;
    const zz = z - (1 - Math.cos(a)) * 0.15;
    const thick = 0.02 - t * 0.007;
    segs.push(part(new THREE.CylinderGeometry(thick, thick + 0.003, 0.12, 6), i % 2 ? WOOD_HI : WOOD, x, yy, zz, -a, 0, 0));
  }
  segs.push(part(new THREE.CylinderGeometry(0.007, 0.013, 0.06, 5), HORN, x, y + dir * 0.52, z - 0.13, dir * -0.38));
  return segs;
}

function recurveBow(x: number, y: number, z: number) {
  return [
    ...bowLimb(x, y, z, 1),
    ...bowLimb(x, y, z, -1),
    part(new THREE.CylinderGeometry(0.02, 0.024, 0.16, 8), LEATHER, x, y, z),
    part(new THREE.CylinderGeometry(0.027, 0.027, 0.038, 8), "#3a2410", x, y + 0.062, z),
    part(new THREE.CylinderGeometry(0.027, 0.027, 0.038, 8), "#3a2410", x, y - 0.062, z),
    part(new THREE.TorusGeometry(0.023, 0.006, 5, 8), "#5a3a18", x, y + 0.028, z, Math.PI / 2),
    part(new THREE.TorusGeometry(0.023, 0.006, 5, 8), "#5a3a18", x, y - 0.028, z, Math.PI / 2),
    part(new THREE.BoxGeometry(0.032, 0.012, 0.018), LEATHER, x + 0.02, y + 0.036, z + 0.012),
    part(new THREE.CylinderGeometry(0.0035, 0.0035, 1.02, 5), STRING, x, y, z - 0.145),
  ];
}

function createBowHoldGeometry() {
  const s = -1 as const;
  const gx = 0.16;
  const gy = 0.04;
  const gz = 0.44;
  return mergeParts(
    [
      part(new THREE.SphereGeometry(0.056, 10, 8), ARMOR_HI, 0, 0, 0),
      part(new THREE.TorusGeometry(0.05, 0.012, 6, 12), GOLD, 0, -0.016, 0, Math.PI / 2),
      part(new THREE.CylinderGeometry(0.05, 0.06, 0.28, 11), ARMOR, 0.06, -0.04, 0.13, -1.15, 0, 0.22),
      part(new THREE.SphereGeometry(0.048, 9, 7), ARMOR_HI, 0.1, -0.02, 0.28),
      part(new THREE.CylinderGeometry(0.042, 0.05, 0.26, 11), ARMOR_DK, 0.13, 0.02, 0.4, -1.25, 0, 0.12),
      part(new THREE.BoxGeometry(0.016, 0.17, 0.014), GOLD, 0.15, 0.03, 0.4),
      part(new THREE.TorusGeometry(0.044, 0.009, 6, 10), GOLD, 0.155, 0.04, 0.5, Math.PI / 2),
      part(new THREE.CylinderGeometry(0.044, 0.048, 0.07, 8), LEATHER, gx, gy, gz - 0.04, -1.2, 0, 0.08),
      part(new THREE.TorusGeometry(0.042, 0.012, 6, 10), GOLD, gx, gy + 0.012, gz - 0.02, Math.PI / 2),
      part(new THREE.BoxGeometry(0.09, 0.112, 0.062), LEATHER, gx, gy, gz, 0.12, 0, 0.06),
      part(new THREE.BoxGeometry(0.094, 0.024, 0.022), ARMOR_HI, gx, gy + 0.032, gz - 0.03),
      part(new THREE.BoxGeometry(0.076, 0.086, 0.054), SKIN, gx, gy - 0.01, gz - 0.008, 0.1, 0, 0.04),
      part(new THREE.SphereGeometry(0.032, 8, 7), SKIN, gx, gy, gz - 0.006),
      ...fingers(gx, gy, gz, s, 0.82, 0.95),
      ...recurveBow(gx, gy, gz + 0.02),
    ],
    ARMOR
  );
}

function createDrawArmGeometry() {
  const s = 1 as const;
  const hx = -0.16;
  const hy = 0.26;
  const hz = 0.22;
  return mergeParts(
    [
      part(new THREE.SphereGeometry(0.056, 10, 8), ARMOR_HI, 0, 0, 0),
      part(new THREE.TorusGeometry(0.05, 0.012, 6, 12), GOLD, 0, -0.016, 0, Math.PI / 2),
      part(new THREE.CylinderGeometry(0.05, 0.06, 0.26, 11), ARMOR, 0.1, 0.08, 0.12, -0.55, 0, -0.72),
      part(new THREE.SphereGeometry(0.046, 9, 7), ARMOR_HI, 0.16, 0.16, 0.18),
      part(new THREE.CylinderGeometry(0.04, 0.048, 0.24, 11), ARMOR_DK, 0.02, 0.2, 0.16, 0.12, 0, -1.12),
      part(new THREE.BoxGeometry(0.014, 0.15, 0.012), GOLD, 0.01, 0.21, 0.2),
      part(new THREE.TorusGeometry(0.04, 0.008, 6, 10), GOLD, -0.06, 0.24, 0.14, Math.PI / 2),
      part(new THREE.CylinderGeometry(0.04, 0.044, 0.06, 8), LEATHER, hx + 0.03, hy - 0.02, hz, 0.2, 0, -0.35),
      part(new THREE.TorusGeometry(0.038, 0.011, 6, 10), GOLD, hx + 0.02, hy - 0.006, hz - 0.008, Math.PI / 2),
      part(new THREE.BoxGeometry(0.078, 0.096, 0.056), LEATHER, hx, hy, hz, 0.1, 0, -0.28),
      part(new THREE.BoxGeometry(0.082, 0.022, 0.02), ARMOR_HI, hx, hy + 0.03, hz - 0.028),
      part(new THREE.BoxGeometry(0.066, 0.074, 0.048), SKIN, hx, hy - 0.006, hz - 0.008, 0.08, 0, -0.2),
      part(new THREE.SphereGeometry(0.03, 8, 7), SKIN, hx, hy, hz - 0.012),
      ...fingers(hx, hy, hz, s, 0.55, 0.78),
    ],
    ARMOR
  );
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

function hipScabbard() {
  return [
    part(new THREE.BoxGeometry(0.055, 0.46, 0.085), ARMOR_DK, -0.22, 0.7, 0.16, 0, 0.2, 0.4),
    part(new THREE.BoxGeometry(0.072, 0.05, 0.09), GOLD, -0.2, 0.9, 0.16, 0, 0.2, 0.4),
  ];
}

function createArcherGeometry() {
  return mergeParts([...plateArmor(false), ...corinthianShell(14)], ARMOR);
}

function createCommanderGeometry() {
  return mergeParts([...plateArmor("left"), ...commanderHelm(), ...hipScabbard()], ARMOR);
}

function createSwordArmGeometry() {
  return mergeParts(
    [
      part(new THREE.SphereGeometry(0.056, 10, 8), ARMOR_HI, 0, 0, 0),
      part(new THREE.TorusGeometry(0.05, 0.012, 6, 12), GOLD, 0, -0.016, 0, Math.PI / 2),
      part(new THREE.CylinderGeometry(0.05, 0.062, 0.28, 11), ARMOR, -0.04, -0.14, 0.03, 0.28, 0, -0.12),
      part(new THREE.SphereGeometry(0.05, 9, 7), ARMOR_HI, -0.07, -0.3, 0.07),
      part(new THREE.CylinderGeometry(0.042, 0.05, 0.26, 11), ARMOR_DK, -0.1, -0.46, 0.12, 0.22, 0, -0.08),
      part(new THREE.BoxGeometry(0.016, 0.16, 0.014), GOLD, -0.12, -0.46, 0.16),
      part(new THREE.TorusGeometry(0.044, 0.009, 6, 10), GOLD, -0.12, -0.58, 0.14, Math.PI / 2),
      part(new THREE.CylinderGeometry(0.04, 0.044, 0.06, 8), LEATHER, -0.13, -0.62, 0.16, 0.15, 0, -0.06),
      part(new THREE.TorusGeometry(0.04, 0.011, 6, 10), GOLD, -0.13, -0.6, 0.17, Math.PI / 2),
      part(new THREE.BoxGeometry(0.082, 0.1, 0.056), LEATHER, -0.14, -0.68, 0.18, 0.12, 0, -0.05),
      part(new THREE.BoxGeometry(0.086, 0.022, 0.02), ARMOR_HI, -0.14, -0.64, 0.21),
      part(new THREE.BoxGeometry(0.07, 0.08, 0.048), SKIN, -0.14, -0.69, 0.188, 0.1, 0, -0.04),
      part(new THREE.SphereGeometry(0.03, 8, 7), SKIN, -0.14, -0.7, 0.19),
      ...fingers(-0.14, -0.7, 0.19, -1, 0.72, 0.85),
    ],
    ARMOR
  );
}

function createCapeGeometry(cloth: string, lining: string) {
  return mergeParts(wrapCape(cloth, lining), cloth);
}

function createPlumeGeometry(tall: boolean) {
  return mergeParts(horsehairPlume(tall), PLUME);
}

function createCommanderFaceGeometry() {
  return mergeParts(commanderFace(), SKIN);
}

let archerGeoV14: THREE.BufferGeometry | null = null;
let commanderGeoV14: THREE.BufferGeometry | null = null;
let commanderSwordArmV3: THREE.BufferGeometry | null = null;
let commanderCapeV9: THREE.BufferGeometry | null = null;
let soldierPlumeV10: THREE.BufferGeometry | null = null;
let commanderPlumeV10: THREE.BufferGeometry | null = null;
let commanderFaceV10: THREE.BufferGeometry | null = null;
let bowHoldV13: THREE.BufferGeometry | null = null;
let drawArmV13: THREE.BufferGeometry | null = null;
let nockArrowGeo: THREE.BufferGeometry | null = null;
const nockOff = new THREE.Vector3();
const handOff = new THREE.Vector3();

function getArcherGeometry() {
  if (!archerGeoV14) archerGeoV14 = createArcherGeometry();
  return archerGeoV14;
}

function getCommanderGeometry() {
  if (!commanderGeoV14) commanderGeoV14 = createCommanderGeometry();
  return commanderGeoV14;
}

function getSwordArmGeometry() {
  if (!commanderSwordArmV3) commanderSwordArmV3 = createSwordArmGeometry();
  return commanderSwordArmV3;
}

function getCommanderCapeGeometry() {
  if (!commanderCapeV9) commanderCapeV9 = createCapeGeometry(BLACK, BLACK_LINING);
  return commanderCapeV9;
}

function getSoldierPlumeGeometry() {
  if (!soldierPlumeV10) soldierPlumeV10 = createPlumeGeometry(false);
  return soldierPlumeV10;
}

function getCommanderPlumeGeometry() {
  if (!commanderPlumeV10) commanderPlumeV10 = createPlumeGeometry(true);
  return commanderPlumeV10;
}

function getCommanderFaceGeometry() {
  if (!commanderFaceV10) commanderFaceV10 = createCommanderFaceGeometry();
  return commanderFaceV10;
}

function getBowHoldGeometry() {
  if (!bowHoldV13) bowHoldV13 = createBowHoldGeometry();
  return bowHoldV13;
}

function getDrawArmGeometry() {
  if (!drawArmV13) drawArmV13 = createDrawArmGeometry();
  return drawArmV13;
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

function makeHandleTexture(name: string, commander = false, crisp = false): NameTag | null {
  const label = `@${name}`;
  const height = crisp ? 220 : 160;
  const maxW = 1024;
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return null;
  let fontSize = crisp ? 96 : 78;
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
  map.generateMipmaps = !crisp;
  map.minFilter = crisp ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.anisotropy = crisp ? 1 : 8;
  const sy = commander ? 1.02 : 0.9;
  const sx = Math.min(FILE * 0.9, sy * (width / height));
  return { map, sx, sy };
}

export function Army({ count, names = [], commanders = [], cinematic, duration = 8, skipCommander = false, roster = null, discover = null, mix = false, level = 1, rosterIds = null }: ArmyProps) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const soldierPlumes = useRef<THREE.InstancedMesh>(null);
  const bowHolds = useRef<THREE.InstancedMesh>(null);
  const drawArms = useRef<THREE.InstancedMesh>(null);
  const chiefs = useRef<THREE.InstancedMesh>(null);
  const chiefCapes = useRef<THREE.InstancedMesh>(null);
  const chiefPlumes = useRef<THREE.InstancedMesh>(null);
  const chiefFaces = useRef<THREE.InstancedMesh>(null);
  const swordArms = useRef<THREE.InstancedMesh>(null);
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
  const commanderCapeGeo = useMemo(() => getCommanderCapeGeometry(), []);
  const soldierPlumeGeo = useMemo(() => getSoldierPlumeGeometry(), []);
  const commanderPlumeGeo = useMemo(() => getCommanderPlumeGeometry(), []);
  const commanderFaceGeo = useMemo(() => getCommanderFaceGeometry(), []);
  const bowHoldGeo = useMemo(() => getBowHoldGeometry(), []);
  const drawArmGeo = useMemo(() => getDrawArmGeometry(), []);
  const swordArmGeo = useMemo(() => getSwordArmGeometry(), []);
  const swordGeo = useMemo(() => getSwordGeometry(), []);
  const nockGeo = useMemo(() => getNockArrowGeometry(), []);

  const visible = Math.min(MAX_SOLDIERS, Math.max(0, Math.floor(count)));
  const instanceCap = Math.min(MAX_SOLDIERS, Math.max(visible, 1));
  const chiefsList = useMemo(() => effectiveCommanders(commanders, names), [commanders, names]);
  const layout = useMemo(() => buildLayout(names, chiefsList, visible), [names, chiefsList, visible]);
  const phantom = !skipCommander && layout.cmd.length === 0 && chiefsList.length > 0;
  const form = useMemo(() => ({ sizes: layout.sizes, scale: 1.28 }), [layout.sizes]);
  const steelRough = useMemo(() => {
    if (cinematic) return null;
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
  }, [cinematic]);
  const labeled = useMemo(() => {
    const cap = cinematic ? MAX_REEL_LABELS : MAX_LABELS;
    const ids: number[] = [];
    if (phantom) ids.push(-1);
    for (let i = 0; i < visible && ids.length < cap; i++) {
      if (names[i] && isCommander(names[i], chiefsList)) ids.push(i);
    }
    for (let i = 0; i < visible && ids.length < cap; i++) {
      if (names[i] && !isCommander(names[i], chiefsList)) ids.push(i);
    }
    return ids;
  }, [names, visible, chiefsList, cinematic, phantom]);
  const nameMaps = useMemo(
    () =>
      labeled.map((i) =>
        makeHandleTexture(i < 0 ? DEFAULT_COMMANDER : names[i], i < 0 || isCommander(names[i], chiefsList), Boolean(discover))
      ),
    [labeled, names, chiefsList, discover]
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

  function stampLimb(
    mesh: THREE.InstancedMesh | null,
    i: number,
    shoulder: THREE.Vector3,
    extraRx: number,
    extraRy: number,
    extraRz: number,
    scale: number
  ) {
    if (!mesh) return;
    _limbPos.copy(shoulder).applyQuaternion(_bodyQ).multiplyScalar(scale).add(pos);
    _extraQ.setFromEuler(_limbEul.set(extraRx, extraRy, extraRz, "XYZ"));
    _limbQuat.copy(_bodyQ).multiply(_extraQ);
    _limbScl.set(scale, scale, scale);
    dummy.matrix.compose(_limbPos, _limbQuat, _limbScl);
    mesh.setMatrixAt(i, dummy.matrix);
  }

  function placeBodies(t: number) {
    const { scale } = form;
    const recT = t - REEL_HOLD;
    const huntIds = roster ? (rosterIds?.length ? rosterIds : rosterSoldierIds(names, visible)) : [];
    const beat = roster ? rosterBeat(roster, recT, duration, huntIds) : null;
    const liveIds = beat && beat.id === "pack" ? beat.ids : null;
    const outIds = beat && beat.id === "pack" ? beat.outgoing : null;
    const packSet = liveIds ? new Set([...(outIds ?? []), ...liveIds]) : null;
    const isolate = Boolean(packSet);
    if (bodies.current) {
      const n = layout.rest.length;
      bodies.current.count = n;
      if (soldierPlumes.current) soldierPlumes.current.count = n;
      if (bowHolds.current) bowHolds.current.count = n;
      if (drawArms.current) drawArms.current.count = n;
      if (nocks.current) nocks.current.count = n;
      for (let i = 0; i < n; i++) {
        const soldier = layout.rest[i];
        const onPack = Boolean(packSet && packSet.has(soldier));
        if (isolate && !onPack) {
          dummy.scale.setScalar(0);
          dummy.position.set(0, -40, 0);
          dummy.updateMatrix();
          stamp(bodies.current, i);
          stamp(soldierPlumes.current, i);
          stamp(bowHolds.current, i);
          stamp(drawArms.current, i);
          if (nocks.current) {
            dummy.scale.setScalar(0);
            dummy.updateMatrix();
            nocks.current.setMatrixAt(i, dummy.matrix);
          }
          continue;
        }
        if (isolate && onPack && liveIds && beat && beat.id === "pack") {
          const liveSlot = liveIds.indexOf(soldier);
          const outSlot = outIds ? outIds.indexOf(soldier) : -1;
          if (liveSlot >= 0) stampRosterSoldier(liveSlot, liveIds.length, beat.pack, recT, beat.enter, 0, beat.u, rosterPose);
          else stampRosterSoldier(Math.max(0, outSlot), outIds?.length ?? 1, Math.max(0, beat.pack - 1), recT, 1, beat.exit, 1, rosterPose);
          const raise = liveSlot >= 0 ? beat.enter : 1 - beat.exit;
          const bodyScale = scale * rosterPose.scaleMul;
          pos.set(rosterPose.x, rosterPose.y, rosterPose.z);
          dummy.position.copy(pos);
          dummy.rotation.set(rosterPose.rx, rosterPose.ry, rosterPose.rz);
          dummy.scale.setScalar(bodyScale);
          dummy.updateMatrix();
          stamp(bodies.current, i);
          stamp(soldierPlumes.current, i);
          _bodyQ.setFromEuler(_limbEul.set(rosterPose.rx, rosterPose.ry, rosterPose.rz, "XYZ"));
          const holdRx = (1 - raise) * -1.18 + 0.05 * raise;
          const drawRx = (1 - raise) * -1.08 - 0.02 * raise;
          const drawRy = (1 - raise) * 0.42 - 0.06 * raise;
          const drawRz = (1 - raise) * -0.18 + 0.05 * raise;
          stampLimb(bowHolds.current, i, L_SHOULDER, holdRx, 0.04 * raise, 0.1 * raise, bodyScale);
          stampLimb(drawArms.current, i, R_SHOULDER, drawRx, drawRy, drawRz, bodyScale);
          if (nocks.current) {
            if (raise > 0.18) {
              nockOff.set(-0.08, 1.22, 0.36 - raise * 0.16);
              nockOff.applyQuaternion(_bodyQ);
              nockOff.multiplyScalar(bodyScale);
              dummy.position.set(pos.x + nockOff.x, pos.y + nockOff.y, pos.z + nockOff.z);
              dummy.rotation.set(rosterPose.rx, rosterPose.ry, rosterPose.rz);
              dummy.scale.setScalar(bodyScale);
              dummy.updateMatrix();
              nocks.current.setMatrixAt(i, dummy.matrix);
            } else {
              dummy.scale.setScalar(0);
              dummy.updateMatrix();
              nocks.current.setMatrixAt(i, dummy.matrix);
            }
          }
          continue;
        }
        unitPos(i, t + seeds[soldier], form.sizes, pos);
        const cycle = bowCycle(soldier, t);
        pos.y += cycle.dy;
        pos.z += cycle.dz;
        dummy.position.copy(pos);
        dummy.rotation.set(cycle.rx, cycle.ry, cycle.rz);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        stamp(bodies.current, i);
        stamp(soldierPlumes.current, i);
        _bodyQ.setFromEuler(_limbEul.set(cycle.rx, cycle.ry, cycle.rz, "XYZ"));
        const holdRx = (1 - cycle.raise) * -1.18;
        const drawRx = (1 - cycle.raise) * -1.08 + (1 - cycle.draw) * cycle.raise * 0.32;
        const drawRy = (1 - cycle.draw) * cycle.raise * 0.42;
        const drawRz = (1 - cycle.raise) * -0.18;
        stampLimb(bowHolds.current, i, L_SHOULDER, holdRx, 0.04 * cycle.raise, 0.08 * cycle.raise, scale);
        stampLimb(drawArms.current, i, R_SHOULDER, drawRx, drawRy, drawRz, scale);
        if (nocks.current) {
          const aim = cycle.raise * (1 - cycle.loose);
          if (aim > 0.12) {
            nockOff.set(-0.08, 1.22, 0.36 - cycle.draw * 0.16);
            nockOff.applyQuaternion(_bodyQ);
            nockOff.multiplyScalar(scale);
            dummy.position.set(pos.x + nockOff.x, pos.y + nockOff.y, pos.z + nockOff.z);
            dummy.rotation.set(cycle.rx, cycle.ry, cycle.rz);
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
      if (soldierPlumes.current) soldierPlumes.current.instanceMatrix.needsUpdate = true;
      if (bowHolds.current) bowHolds.current.instanceMatrix.needsUpdate = true;
      if (drawArms.current) drawArms.current.instanceMatrix.needsUpdate = true;
      if (nocks.current) nocks.current.instanceMatrix.needsUpdate = true;
    }
    if (chiefs.current) {
      const n = skipCommander ? 0 : Math.min(MAX_COMMANDERS, Math.max(layout.cmd.length, phantom ? 1 : 0));
      chiefs.current.count = n;
      if (chiefCapes.current) chiefCapes.current.count = n;
      if (chiefPlumes.current) chiefPlumes.current.count = n;
      if (chiefFaces.current) chiefFaces.current.count = 0;
      if (swordArms.current) swordArms.current.count = n;
      if (swords.current) swords.current.count = n;
      const p = sallyLocal(t);
      const swing = swordSwingU(p, Math.max(1, n));
      const cmdScale = scale * 1.26;
      for (let k = 0; k < n; k++) {
        const soldier = layout.cmd[k] ?? 0;
        const onPack = Boolean(packSet && packSet.has(soldier));
        if (isolate && !onPack) {
          dummy.scale.setScalar(0);
          dummy.position.set(0, -40, 0);
          dummy.updateMatrix();
          stamp(chiefs.current, k);
          stamp(chiefCapes.current, k);
          stamp(chiefPlumes.current, k);
          stamp(swordArms.current, k);
          if (swords.current) {
            dummy.scale.setScalar(0);
            dummy.updateMatrix();
            swords.current.setMatrixAt(k, dummy.matrix);
          }
          continue;
        }
        if (isolate && onPack && liveIds && beat && beat.id === "pack") {
          const liveSlot = liveIds.indexOf(soldier);
          const outSlot = outIds ? outIds.indexOf(soldier) : -1;
          if (liveSlot >= 0) stampRosterSoldier(liveSlot, liveIds.length, beat.pack, recT, beat.enter, 0, beat.u, rosterPose);
          else stampRosterSoldier(Math.max(0, outSlot), outIds?.length ?? 1, Math.max(0, beat.pack - 1), recT, 1, beat.exit, 1, rosterPose);
          const bodyScale = scale * rosterPose.scaleMul;
          pos.set(rosterPose.x, rosterPose.y, rosterPose.z);
          dummy.position.copy(pos);
          dummy.rotation.set(rosterPose.rx, rosterPose.ry, rosterPose.rz);
          dummy.scale.setScalar(bodyScale);
          dummy.updateMatrix();
          stamp(chiefs.current, k);
          stamp(chiefCapes.current, k);
          stamp(chiefPlumes.current, k);
          _bodyQ.setFromEuler(_limbEul.set(rosterPose.rx, rosterPose.ry, rosterPose.rz, "XYZ"));
          stampLimb(swordArms.current, k, L_SHOULDER, -0.55, 0.18, 0.12, bodyScale);
          if (swords.current) {
            dummy.scale.setScalar(0);
            dummy.updateMatrix();
            swords.current.setMatrixAt(k, dummy.matrix);
          }
          continue;
        }
        commanderPos(t, soldier, pos);
        dummy.position.copy(pos);
        dummy.rotation.set(0, Math.PI, 0);
        dummy.scale.setScalar(cmdScale);
        dummy.updateMatrix();
        stamp(chiefs.current, k);
        stamp(chiefCapes.current, k);
        stamp(chiefPlumes.current, k);
        const style = swordStyleAt(p, k);
        const [arx, ary, arz] = swordArmPose(style, swing);
        _bodyQ.setFromEuler(_limbEul.set(0, Math.PI, 0, "XYZ"));
        stampLimb(swordArms.current, k, L_SHOULDER, arx, -ary, -arz, cmdScale);
        if (swords.current) {
          handOff.set(-0.1, -0.66, 0.2);
          handOff.applyQuaternion(_limbQuat);
          dummy.position.copy(_limbPos).addScaledVector(handOff, 1);
          dummy.quaternion.copy(_limbQuat);
          dummy.rotateX(-1.05);
          dummy.scale.setScalar(cmdScale);
          dummy.updateMatrix();
          swords.current.setMatrixAt(k, dummy.matrix);
        }
      }
      chiefs.current.instanceMatrix.needsUpdate = true;
      if (chiefCapes.current) chiefCapes.current.instanceMatrix.needsUpdate = true;
      if (chiefPlumes.current) chiefPlumes.current.instanceMatrix.needsUpdate = true;
      if (chiefFaces.current) chiefFaces.current.instanceMatrix.needsUpdate = true;
      if (swordArms.current) swordArms.current.instanceMatrix.needsUpdate = true;
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
      const cmd = idx < 0 || layout.cmdOf[idx] >= 0;
      if (isolate && (idx < 0 || !packSet?.has(idx))) {
        tag.visible = false;
        continue;
      }
      if (isolate && liveIds && beat && beat.id === "pack" && idx >= 0) {
        const liveSlot = liveIds.indexOf(idx);
        const outSlot = outIds ? outIds.indexOf(idx) : -1;
        if (liveSlot >= 0) stampRosterSoldier(liveSlot, liveIds.length, beat.pack, recT, beat.enter, 0, beat.u, rosterPose);
        else stampRosterSoldier(Math.max(0, outSlot), outIds?.length ?? 1, Math.max(0, beat.pack - 1), recT, 1, beat.exit, 1, rosterPose);
        pos.set(rosterPose.x, rosterPose.y, rosterPose.z);
      } else if (idx < 0) commanderPos(t, 0, pos);
      else poseSoldier(idx, t);
      let nameScale = 1;
      if (cinematic && mix) {
        if (recT < 0) {
          tag.visible = false;
          continue;
        }
        nameScale = 1.28;
      } else if (cinematic && discover) {
        if (discover === DISCOVER3_ID) {
          const tBeat = trailerBeat(recT);
          const namesOn = recT >= 3.4 && (tBeat === "army" || tBeat === "volley");
          if (!namesOn) {
            tag.visible = false;
            continue;
          }
          nameScale = 1.45;
        } else if (discover === RAF2_ID) {
          const sBeat = shelfBeat(recT);
          const namesOn = sBeat === "hook" || sBeat === "army";
          if (!namesOn) {
            tag.visible = false;
            continue;
          }
          nameScale = 1.72;
        } else {
          const dBeat = discoverBeat(recT);
          const namesOn = (dBeat === "proof" && recT >= DISCOVER_HOOK_END + 0.8) || dBeat === "hold";
          if (!namesOn) {
            tag.visible = false;
            continue;
          }
          nameScale = dBeat === "proof" ? 1.78 : 1.22;
        }
      } else if (cinematic && roster) {
        if (recT < 0) {
          tag.visible = false;
          continue;
        }
        nameScale = isolate ? 0.7 * (rosterPose.nameMul || 1) : 1.05;
        if (isolate && (rosterPose.nameMul < 0.1 || Math.abs(pos.x) > 2.85)) {
          tag.visible = false;
          continue;
        }
      } else if (cinematic) {
        const beats = reelBeats(duration, skipCommander);
        if (recT < 0) {
          tag.visible = false;
          continue;
        }
        if (skipCommander) nameScale = 1;
        else if (recT < beats.cmd) nameScale = 0.38;
        else {
          const u = Math.min(1, (recT - beats.cmd) / Math.max(0.2, beats.turn * 0.58));
          const e = u * u * (3 - 2 * u);
          nameScale = 0.38 + 0.62 * e;
        }
      }
      tag.visible = true;
      let lift = isolate ? 2.38 : 2.92;
      if (!cmd && !isolate) {
        const slot = layout.slotOf[idx];
        const { row, col } = slotCoord(slot >= 0 ? slot : 0, form.sizes);
        lift = 2.22 + row * 0.5 + (col % 2) * 0.2;
      }
      const sx = isolate ? Math.min(1.18, tagData.sx * nameScale) : tagData.sx * nameScale;
      let nx = pos.x;
      if (isolate) {
        const half = sx * 0.5;
        const lim = 2.12;
        if (nx - half < -lim) nx = -lim + half;
        if (nx + half > lim) nx = lim - half;
      }
      tag.position.set(nx, pos.y + lift * scale, pos.z);
      tag.scale.set(sx, tagData.sy * nameScale, 1);
    }
  }

  useLayoutEffect(() => {
    placeBodies(0);
  }, [visible, instanceCap, labeled]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const { scale } = form;
    const sally = sallyLocal(t);
    const hunt = mix ? false : sallyHunting(sally);
    const enemies = raidCount(visible);
    const door = mix ? castleFrame(level) : null;

    acc.current += dt;
    if (roster || acc.current >= 1 / 40) {
      acc.current = 0;
      placeBodies(t);
    }

    if (!arrows.current) return;
    if (visible <= 0 || roster) {
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
        const cmdN = skipCommander ? 0 : chiefsList.length;
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
          tx: mix ? 0 : prey ? prey.x : GATE.x,
          ty: mix ? 3.55 : prey ? 1.05 : GATE.y,
          tz: mix ? door?.front ?? GATE.z : prey ? prey.z : GATE.z,
          flight: mix ? 2.55 : prey ? 0.46 : ARROW_FLIGHT,
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
        s.sy + (s.ty - s.sy) * fly + Math.sin(fly * Math.PI) * (mix ? 0.55 : s.thin ? 1.15 : 2.6),
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
      <instancedMesh key={`archer-v14-${instanceCap}`} ref={bodies} args={[archerGeo, undefined, instanceCap]} frustumCulled={false} castShadow={!cinematic}>
        {cinematic ? (
          <meshStandardMaterial vertexColors roughness={0.46} metalness={0.72} envMapIntensity={0.9} />
        ) : (
          <meshPhysicalMaterial
            vertexColors
            roughness={0.42}
            metalness={0.82}
            roughnessMap={steelRough ?? undefined}
            envMapIntensity={1.25}
            clearcoat={0.28}
            clearcoatRoughness={0.45}
          />
        )}
      </instancedMesh>
      <instancedMesh ref={soldierPlumes} args={[soldierPlumeGeo, undefined, instanceCap]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.86} metalness={0} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh key="bow-v13" ref={bowHolds} args={[bowHoldGeo, undefined, instanceCap]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.52} metalness={0.28} envMapIntensity={0.7} />
      </instancedMesh>
      <instancedMesh key="draw-v13" ref={drawArms} args={[drawArmGeo, undefined, instanceCap]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.48} metalness={0.32} envMapIntensity={0.75} />
      </instancedMesh>
      <instancedMesh key="cmd-body-v14" ref={chiefs} args={[commanderGeo, undefined, MAX_COMMANDERS]} frustumCulled={false} castShadow>
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
      <instancedMesh key="face-v10" ref={chiefFaces} args={[commanderFaceGeo, undefined, MAX_COMMANDERS]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.62} metalness={0.04} envMapIntensity={0.35} />
      </instancedMesh>
      <instancedMesh key="cmd-arm-v3" ref={swordArms} args={[swordArmGeo, undefined, MAX_COMMANDERS]} frustumCulled={false} castShadow>
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
