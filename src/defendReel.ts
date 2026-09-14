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
export const DEFEND_RING_GAP = 1.35;
export const DEFEND_RING_SPACING = 1.22 / 3;
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

function lerpLinear(a: ShotPose, b: ShotPose, t: number): ShotPose {
  const u = clamp01(t);
  return pose(
    a.x + (b.x - a.x) * u,
    a.y + (b.y - a.y) * u,
    a.z + (b.z - a.z) * u,
    a.lx + (b.lx - a.lx) * u,
    a.ly + (b.ly - a.ly) * u,
    a.lz + (b.lz - a.lz) * u,
    a.fov + (b.fov - a.fov) * u
  );
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

/** Previous opening pose — punch-in lands here, then the old 14s path continues. */
function defendMainCam(mainT: number, soldiers: number): ShotPose {
  const t = Math.max(0, mainT);
  const u = easeInOut(clamp01(t / DEFEND_MAIN_SECONDS));
  const armyR = defendArmyRadius(Math.max(1, soldiers));
  const outer = defendOuterAt(t + DEFEND_PULL_END, armyR);
  const az = -0.18 + u * 0.42 + Math.sin(t * 0.15) * 0.05;
  const polar = 0.7 + u * 0.3;
  const dist = outer + 15 - u * 2.8;
  const x = DEFEND_CX + Math.sin(polar) * Math.sin(az) * dist;
  const y = Math.cos(polar) * dist;
  const z = DEFEND_CZ + Math.sin(polar) * Math.cos(az) * dist;
  return pose(x, y, z, DEFEND_CX, 1.85 + u * 0.35, DEFEND_CZ, 48 - u * 6);
}

function defendWideCam(soldiers: number): ShotPose {
  const armyR = defendArmyRadius(Math.max(1, soldiers));
  const outer = defendOuterAt(0, armyR);
  const polar = 0.28;
  const dist = outer * 4.6 + 24;
  const az = -0.05;
  const x = DEFEND_CX + Math.sin(polar) * Math.sin(az) * dist;
  const y = Math.cos(polar) * dist;
  const z = DEFEND_CZ + Math.sin(polar) * Math.cos(az) * dist;
  return pose(x, y, z, DEFEND_CX, 1.5, DEFEND_CZ, 52);
}

export function sampleDefend(recT: number, soldiers: number): ShotPose {
  const t = Math.max(0, recT);
  const here = defendMainCam(Math.max(0, t - DEFEND_PULL_END), soldiers);
  if (t >= DEFEND_PULL_END) return here;
  return lerpLinear(defendWideCam(soldiers), here, easeOutCubic(t / DEFEND_PULL_END));
}
