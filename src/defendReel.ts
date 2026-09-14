import { type ShotPose } from "./shotModes";

export const DEFEND_ID = "savunma" as const;
export type DefendId = typeof DEFEND_ID;

export const DEFEND_MODE = { id: DEFEND_ID, label: "Savunma" } as const;
export const DEFEND_PULL_END = 1.2;
export const DEFEND_MAIN_SECONDS = 14;
export const DEFEND_SECONDS = DEFEND_PULL_END + DEFEND_MAIN_SECONDS;

export const DEFEND_CX = 0;
export const DEFEND_CZ = 0;
export const DEFEND_SPACING = 2.05;
export const DEFEND_RINGS = 16;
export const DEFEND_RING_GAP = 1.02;
export const DEFEND_RING_SPACING = 0.74;
export const DEFEND_MAX_ENEMIES = 5400;
export const DEFEND_INNER_GAP = 5.4;
export const DEFEND_APPROACH = 26;

export const DEFEND_HOOK_END = 2.2;
export const DEFEND_PROOF_END = 7.6;
export const DEFEND_HOLD_END = 11.8;

export type DefendBeat = "hook" | "proof" | "hold" | "cta";

export type DefendRingSpec = {
  ring: number;
  n: number;
  offset: number;
};

export type DefendRingLayout = {
  armyR: number;
  rings: DefendRingSpec[];
  cap: number;
};

export function isDefend(id: string | null | undefined): id is DefendId {
  return id === DEFEND_ID;
}

export function defendBeat(recT: number): DefendBeat {
  const t = Math.max(0, recT);
  if (t < DEFEND_HOOK_END) return "hook";
  if (t < DEFEND_PROOF_END) return "proof";
  if (t < DEFEND_HOLD_END) return "hold";
  return "cta";
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

function easeInOut(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function easeOutCubic(t: number) {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

function pose(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): ShotPose {
  return { x, y: Math.max(3.4, y), z, lx, ly: Math.max(1.45, ly), lz, fov };
}

export function defendArmyRadius(n: number) {
  return Math.max(3.4, Math.sqrt(Math.max(1, n) / Math.PI) * DEFEND_SPACING);
}

function ringBand() {
  return (DEFEND_RINGS - 1) * DEFEND_RING_GAP;
}

export function defendOuterAt(recT: number, armyR: number) {
  const t = Math.max(0, recT - DEFEND_PULL_END);
  const u = easeInOut(clamp01(t / DEFEND_MAIN_SECONDS));
  const end = armyR + DEFEND_INNER_GAP + ringBand();
  const start = end + DEFEND_APPROACH;
  return start + (end - start) * u;
}

export function defendRingLayout(soldiers: number): DefendRingLayout {
  const armyR = defendArmyRadius(Math.max(1, soldiers));
  const outer0 = defendOuterAt(0, armyR);
  const rings: DefendRingSpec[] = [];
  let cap = 0;
  for (let ring = 0; ring < DEFEND_RINGS; ring++) {
    const r0 = outer0 - ring * DEFEND_RING_GAP;
    if (r0 < armyR + DEFEND_INNER_GAP - 0.4) continue;
    const n = Math.max(16, Math.round((2 * Math.PI * r0) / DEFEND_RING_SPACING));
    if (cap + n > DEFEND_MAX_ENEMIES) break;
    rings.push({ ring, n, offset: (ring % 2) * (Math.PI / n) });
    cap += n;
  }
  return { armyR, rings, cap: Math.max(1, cap) };
}

export function defendSoldierPos(
  index: number,
  count: number,
  t: number,
  out: { set: (x: number, y: number, z: number) => void }
) {
  const n = Math.max(1, count);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const rMax = defendArmyRadius(n);
  const r = n <= 1 ? 0 : rMax * Math.sqrt((index + 0.5) / n);
  const a = index * golden;
  const bob = Math.abs(Math.sin(t * 7.2 + index * 0.37)) * 0.06;
  out.set(DEFEND_CX + Math.cos(a) * r, bob, DEFEND_CZ + Math.sin(a) * r);
}

export function defendYawOut(x: number, z: number) {
  return Math.atan2(x - DEFEND_CX, z - DEFEND_CZ) + Math.PI;
}

export function defendEnemyAt(
  layout: DefendRingLayout,
  recT: number,
  ringIndex: number,
  i: number,
  t: number,
  out: { x: number; y: number; z: number; yaw: number }
) {
  const spec = layout.rings[ringIndex];
  const outer = defendOuterAt(Math.max(0, recT), layout.armyR);
  const r = outer - spec.ring * DEFEND_RING_GAP;
  const a = (i / spec.n) * Math.PI * 2 + spec.offset;
  const x = DEFEND_CX + Math.cos(a) * r;
  const z = DEFEND_CZ + Math.sin(a) * r;
  const step = Math.abs(Math.sin(t * 9.2 + i * 0.51 + ringIndex)) * 0.05;
  out.x = x;
  out.y = step;
  out.z = z;
  out.yaw = Math.atan2(DEFEND_CX - x, DEFEND_CZ - z);
}

function distToFitRing(outer: number, polar: number, fovDeg: number, pad: number) {
  const vfov = (fovDeg * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (9 / 16));
  const radius = Math.max(6, outer) * pad;
  const y = radius / Math.tan(hfov / 2);
  return y / Math.max(0.22, Math.cos(polar));
}

export function sampleDefend(recT: number, soldiers: number): ShotPose {
  const t = Math.max(0, recT);
  const armyR = defendArmyRadius(Math.max(1, soldiers));
  const outer = defendOuterAt(t, armyR);
  const pull = easeOutCubic(clamp01(t / DEFEND_PULL_END));
  const mainU = easeInOut(clamp01((t - DEFEND_PULL_END) / DEFEND_MAIN_SECONDS));
  const polar = 0.07 + pull * 0.12 + mainU * 0.16;
  const pad = 1.58 - pull * 0.2 - mainU * 0.08;
  const fov = 46 - pull * 2 - mainU * 2;
  const az = 0.015 + mainU * 0.08;
  const dist = distToFitRing(outer, polar, fov, pad);
  const x = DEFEND_CX + Math.sin(polar) * Math.sin(az) * dist;
  const y = Math.cos(polar) * dist;
  const z = DEFEND_CZ + Math.sin(polar) * Math.cos(az) * dist;
  return pose(x, y, z, DEFEND_CX, 1.5, DEFEND_CZ, fov);
}
