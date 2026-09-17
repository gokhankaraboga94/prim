import { castleFrame } from "./castleLayout";
import { lerpPose, type ShotPose } from "./shotModes";

export const DEFEND_ID = "savunma" as const;
export const DEFEND2_ID = "savunma2" as const;
export type DefendId = typeof DEFEND_ID | typeof DEFEND2_ID;

export const DEFEND_MODE = { id: DEFEND_ID, label: "Savunma" } as const;
export const DEFEND2_MODE = { id: DEFEND2_ID, label: "Savunma 2" } as const;

export const DEFEND_PULL_END = 0.96;
export const DEFEND_MAIN_SECONDS = 14;
export const DEFEND_SECONDS = DEFEND_PULL_END + DEFEND_MAIN_SECONDS;
export const DEFEND2_SORTIE = 6.4;
export const DEFEND2_SECONDS = DEFEND2_SORTIE + DEFEND_SECONDS;

export const DEFEND_CX = 0;
export const DEFEND_CZ = 0;
export const DEFEND2_CX = 0;
export const DEFEND2_CZ = 88;
export const DEFEND_SPACING = 2.05;
export const DEFEND_RINGS = 8;
export const DEFEND_RING_GAP = 1.12;
export const DEFEND_RING_SPACING = 0.98;
export const DEFEND_MAX_ENEMIES = 1400;
export const DEFEND2_RINGS = 5;
export const DEFEND2_RING_GAP = 1.3;
export const DEFEND2_RING_SPACING = 1.42;
export const DEFEND2_MAX_ENEMIES = 420;
export const DEFEND_INNER_GAP = 4.2;
export const DEFEND_APPROACH = 26;

export const DEFEND_HOOK_END = 2.2;
export const DEFEND_PROOF_END = 7.6;
export const DEFEND_HOLD_END = 11.8;

export type DefendBeat = "hook" | "proof" | "hold" | "cta" | "sortieGate" | "sortieSplit" | "sortieWrap";

export type DefendRingSpec = {
  ring: number;
  n: number;
  offset: number;
};

export type DefendRingLayout = {
  armyR: number;
  rings: DefendRingSpec[];
  cap: number;
  gap: number;
};

export function isDefend(id: string | null | undefined): id is DefendId {
  return id === DEFEND_ID || id === DEFEND2_ID;
}

export function isDefend2(id: string | null | undefined): id is typeof DEFEND2_ID {
  return id === DEFEND2_ID;
}

export function defendDuration(id: string | null | undefined) {
  return isDefend2(id) ? DEFEND2_SECONDS : DEFEND_SECONDS;
}

export function defendOrigin(id?: string | null) {
  if (isDefend2(id)) return { x: DEFEND2_CX, z: DEFEND2_CZ };
  return { x: DEFEND_CX, z: DEFEND_CZ };
}

export function defendPlayhead(recT: number, id?: string | null) {
  if (isDefend2(id)) return Math.max(0, recT - DEFEND2_SORTIE);
  return Math.max(0, recT);
}

export function defendBeat(recT: number, id?: string | null): DefendBeat {
  if (isDefend2(id) && recT < DEFEND2_SORTIE) {
    if (recT < 1.8) return "sortieGate";
    if (recT < 4.1) return "sortieSplit";
    return "sortieWrap";
  }
  const t = defendPlayhead(recT, id);
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

function offsetPose(p: ShotPose, ox: number, oz: number): ShotPose {
  if (!ox && !oz) return p;
  return pose(p.x + ox, p.y, p.z + oz, p.lx + ox, p.ly, p.lz + oz, p.fov);
}

export function defendArmyRadius(n: number) {
  return Math.max(3.4, Math.sqrt(Math.max(1, n) / Math.PI) * DEFEND_SPACING);
}

function ringCount(id?: string | null) {
  return isDefend2(id) ? DEFEND2_RINGS : DEFEND_RINGS;
}

function ringGap(id?: string | null) {
  return isDefend2(id) ? DEFEND2_RING_GAP : DEFEND_RING_GAP;
}

function ringSpacing(id?: string | null) {
  return isDefend2(id) ? DEFEND2_RING_SPACING : DEFEND_RING_SPACING;
}

function ringCap(id?: string | null) {
  return isDefend2(id) ? DEFEND2_MAX_ENEMIES : DEFEND_MAX_ENEMIES;
}

function ringBand(id?: string | null) {
  return (ringCount(id) - 1) * ringGap(id);
}

export function defendOuterAt(recT: number, armyR: number, id?: string | null) {
  const t = Math.max(0, recT - DEFEND_PULL_END);
  const u = easeInOut(clamp01(t / DEFEND_MAIN_SECONDS));
  const end = armyR + DEFEND_INNER_GAP + ringBand(id);
  const start = end + (isDefend2(id) ? 12 : DEFEND_APPROACH);
  return start + (end - start) * u;
}

export function defendRingLayout(soldiers: number, id: DefendId = DEFEND_ID): DefendRingLayout {
  const armyR = defendArmyRadius(Math.max(1, soldiers));
  const gap = ringGap(id);
  const spacing = ringSpacing(id);
  const maxE = ringCap(id);
  const outer0 = defendOuterAt(0, armyR, id);
  const rings: DefendRingSpec[] = [];
  let cap = 0;
  for (let ring = 0; ring < ringCount(id); ring++) {
    const r0 = outer0 - ring * gap;
    if (r0 < armyR + DEFEND_INNER_GAP - 0.4) continue;
    const n = Math.max(16, Math.round((2 * Math.PI * r0) / spacing));
    if (cap + n > maxE) break;
    rings.push({ ring, n, offset: (ring % 2) * (Math.PI / n) });
    cap += n;
  }
  return { armyR, rings, cap: Math.max(1, cap), gap };
}

export function defendSoldierPos(
  index: number,
  count: number,
  t: number,
  out: { set: (x: number, y: number, z: number) => void },
  cx = DEFEND_CX,
  cz = DEFEND_CZ
) {
  const n = Math.max(1, count);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const rMax = defendArmyRadius(n);
  const r = n <= 1 ? 0 : rMax * Math.sqrt((index + 0.5) / n);
  const a = index * golden;
  void t;
  out.set(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r);
}

export function defendYawOut(x: number, z: number, cx = DEFEND_CX, cz = DEFEND_CZ) {
  return Math.atan2(x - cx, z - cz) + Math.PI;
}

export function defendEnemyAt(
  layout: DefendRingLayout,
  recT: number,
  ringIndex: number,
  i: number,
  t: number,
  out: { x: number; y: number; z: number; yaw: number },
  id: DefendId = DEFEND_ID,
  gateZ = 16
) {
  const spec = layout.rings[ringIndex];
  const { x: cx, z: cz } = defendOrigin(id);
  const play = defendPlayhead(recT, id);
  const outer = defendOuterAt(play, layout.armyR, id);
  const r = outer - spec.ring * layout.gap;
  const aFinal = (i / spec.n) * Math.PI * 2 + spec.offset;
  const step = ((i * 13 + ringIndex * 7) % 10) * 0.004;
  out.y = step;

  if (isDefend2(id) && recT < DEFEND2_SORTIE) {
    const k = spec.ring * spec.n + i;
    const delay = (k / Math.max(1, layout.cap)) * 2.05;
    if (recT < delay) {
      const lane = (i % 11 - 5) * 0.62;
      out.x = cx + lane;
      out.y = -40;
      out.z = gateZ + 0.6;
      out.yaw = 0;
      return;
    }
    const u = easeInOut(clamp01((recT - delay) / 4.05));
    const pour = clamp01(u / 0.3);
    const wrap = easeInOut(clamp01((u - 0.22) / 0.78));
    const aNow = Math.PI + wrap * (aFinal - Math.PI);
    const xRing = cx + Math.sin(aNow) * r;
    const zRing = cz + Math.cos(aNow) * r;
    const lane = (i % 11 - 5) * 0.62;
    const gx = cx + lane;
    const gz = gateZ + 1.35 + (spec.ring % 4) * 0.45;
    out.x = gx + (xRing - gx) * pour;
    out.z = gz + (zRing - gz) * pour;
    out.yaw = wrap > 0.38 ? Math.atan2(cx - out.x, cz - out.z) : Math.atan2(xRing - gx, zRing - gz);
    return;
  }

  const x = cx + Math.sin(aFinal) * r;
  const z = cz + Math.cos(aFinal) * r;
  out.x = x;
  out.z = z;
  out.yaw = Math.atan2(cx - x, cz - z);
}

function distToFitRing(outer: number, polar: number, fovDeg: number, pad: number) {
  const vfov = (fovDeg * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (9 / 16));
  const radius = Math.max(6, outer) * pad;
  const y = radius / Math.tan(hfov / 2);
  return y / Math.max(0.22, Math.cos(polar));
}

export function sampleDefend(recT: number, soldiers: number, id: DefendId = DEFEND_ID): ShotPose {
  const t = Math.max(0, recT);
  const armyR = defendArmyRadius(Math.max(1, soldiers));
  const outer = defendOuterAt(t, armyR, id);
  const pull = easeOutCubic(clamp01(t / DEFEND_PULL_END));
  const zoomU = easeOutCubic(clamp01((t - DEFEND_PULL_END) / (DEFEND_MAIN_SECONDS * 0.8)));
  if (isDefend2(id)) {
    const polar = 0.09 + pull * 0.1 + zoomU * 0.16;
    const fov = 44 - pull * 1 - zoomU * 3;
    const dist = distToFitRing(Math.max(outer, armyR + 6), polar, fov, 1.26);
    const az = 0.02;
    const x = DEFEND_CX + Math.sin(polar) * Math.sin(az) * dist;
    const y = Math.cos(polar) * dist;
    const z = DEFEND_CZ + Math.sin(polar) * Math.cos(az) * dist;
    return pose(x, y, z, DEFEND_CX, 1.55, DEFEND_CZ, fov);
  }
  const polar = 0.07 + pull * 0.2 + zoomU * 0.7;
  const pad = 1.343 - pull * 0.12 - zoomU * 0.2;
  const fov = 46 - pull * 2 - zoomU * 12;
  const az = 0.015 + zoomU * 0.12;
  const ringDist = distToFitRing(outer, polar, fov, pad);
  const closeDist = 15.8 + Math.min(5.5, armyR * 0.08);
  const dist = (ringDist * (1 - zoomU) + closeDist * zoomU) * 0.9;
  const lookR = zoomU * Math.min(armyR * 0.55, Math.max(0, armyR - 0.9));
  const lx = DEFEND_CX + Math.sin(az) * lookR;
  const lz = DEFEND_CZ + Math.cos(az) * lookR;
  const x = DEFEND_CX + Math.sin(polar) * Math.sin(az) * dist;
  const y = Math.cos(polar) * dist;
  const z = DEFEND_CZ + Math.sin(polar) * Math.cos(az) * dist;
  return pose(x, y, z, lx, 1.45 + zoomU * 0.18, lz, fov);
}

function sampleDefendSortie(recT: number, soldiers: number, level: number): ShotPose {
  const t = Math.max(0, recT);
  const armyR = defendArmyRadius(Math.max(1, soldiers));
  const gateZ = castleFrame(level).front;
  const oz = DEFEND2_CZ;
  const u = clamp01(t / DEFEND2_SORTIE);
  const nearZ = Math.min(gateZ - 8, oz - armyR);
  const farZ = oz + armyR + 10;
  const lookZ = (nearZ + farZ) * (0.48 + u * 0.06);
  const span = Math.max((farZ - nearZ) * 0.52, armyR + 16);
  const polar = 0.055 + u * 0.025;
  const fov = 42;
  const dist = distToFitRing(span, polar, fov, 1.3);
  const az = 0.02;
  const x = Math.sin(polar) * Math.sin(az) * dist;
  const y = Math.cos(polar) * dist;
  const z = lookZ + Math.sin(polar) * Math.cos(az) * dist;
  return pose(x, y, z, 0, 1.55, lookZ, fov);
}

export function sampleDefendCam(recT: number, soldiers: number, id: DefendId, level: number): ShotPose {
  const { x: ox, z: oz } = defendOrigin(id);
  if (!isDefend2(id)) return sampleDefend(recT, soldiers, id);
  const play = recT - DEFEND2_SORTIE;
  const shrink = offsetPose(sampleDefend(Math.max(0, play), soldiers, id), ox, oz);
  if (play >= 0) return shrink;
  const bird = sampleDefendSortie(recT, soldiers, level);
  const blend = easeOutCubic(clamp01((recT - (DEFEND2_SORTIE - 0.75)) / 0.75));
  if (blend <= 0) return bird;
  return lerpPose(bird, offsetPose(sampleDefend(0, soldiers, id), ox, oz), blend);
}
