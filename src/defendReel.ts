import { castleFrame } from "./castleLayout";
import { lerpPose, type ShotPose } from "./shotModes";

export const DEFEND_ID = "savunma" as const;
export const DEFEND2_ID = "savunma2" as const;
export const DEFEND3_ID = "savunma3" as const;
export const DEFEND4_ID = "savunma4" as const;
export const DEFEND5_ID = "savunma5" as const;
export type DefendId = typeof DEFEND_ID | typeof DEFEND2_ID | typeof DEFEND3_ID | typeof DEFEND4_ID | typeof DEFEND5_ID;

export const DEFEND_MODE = { id: DEFEND_ID, label: "Savunma" } as const;
export const DEFEND2_MODE = { id: DEFEND2_ID, label: "Savunma 2" } as const;
export const DEFEND3_MODE = { id: DEFEND3_ID, label: "Savunma 3" } as const;
export const DEFEND4_MODE = { id: DEFEND4_ID, label: "Savunma 4" } as const;
export const DEFEND5_MODE = { id: DEFEND5_ID, label: "Savunma 5" } as const;

export const DEFEND_PULL_END = 0.96;
export const DEFEND_MAIN_SECONDS = 14;
export const DEFEND_SECONDS = DEFEND_PULL_END + DEFEND_MAIN_SECONDS;
export const DEFEND2_SORTIE = 6.4;
export const DEFEND2_SECONDS = DEFEND2_SORTIE + DEFEND_SECONDS;
export const DEFEND3_ZOOM_END = 13;
export const DEFEND3_ORBIT = 14;
export const DEFEND3_SECONDS = DEFEND3_ZOOM_END + DEFEND3_ORBIT;
export const DEFEND4_SECONDS = DEFEND3_SECONDS;
export const DEFEND5_SECONDS = DEFEND4_SECONDS;
export const DEFEND5_RINGS = 64;
export const DEFEND5_RING_GAP = 0.62;
export const DEFEND5_RING_SPACING = 0.58;
export const DEFEND5_SPREAD = 1.45;

export const DEFEND_CX = 0;
export const DEFEND_CZ = 0;
export const DEFEND2_CX = 0;
export const DEFEND2_CZ = 88;
export const DEFEND_SPACING = 2.05;
export const DEFEND_RINGS = 8;
export const DEFEND_RING_GAP = 1.12;
export const DEFEND_RING_SPACING = 0.98;
export const DEFEND_MAX_ENEMIES = 1400;
export const DEFEND2_RINGS = 8;
export const DEFEND2_RING_GAP = 1.12;
export const DEFEND2_RING_SPACING = 0.98;
export const DEFEND2_MAX_ENEMIES = 1400;
export const DEFEND3_RINGS = 28;
export const DEFEND3_RING_GAP = 0.52;
export const DEFEND3_RING_SPACING = 0.72;
export const DEFEND3_MAX_ENEMIES = 7800;
export const DEFEND_INNER_GAP = 4.2;
export const DEFEND3_INNER_GAP = 0.52;
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
  return id === DEFEND_ID || id === DEFEND2_ID || id === DEFEND3_ID || id === DEFEND4_ID || id === DEFEND5_ID;
}

export function isDefend2(id: string | null | undefined): id is typeof DEFEND2_ID {
  return id === DEFEND2_ID;
}

export function isDefend3(id: string | null | undefined): id is typeof DEFEND3_ID | typeof DEFEND4_ID | typeof DEFEND5_ID {
  return id === DEFEND3_ID || id === DEFEND4_ID || id === DEFEND5_ID;
}

export function isDefend4(id: string | null | undefined): id is typeof DEFEND4_ID {
  return id === DEFEND4_ID;
}

export function isDefend5(id: string | null | undefined): id is typeof DEFEND5_ID {
  return id === DEFEND5_ID;
}

export function isDefendSortie(id: string | null | undefined): id is typeof DEFEND2_ID | typeof DEFEND3_ID | typeof DEFEND4_ID | typeof DEFEND5_ID {
  return id === DEFEND2_ID || id === DEFEND3_ID || id === DEFEND4_ID || id === DEFEND5_ID;
}

export function defendShownFriends(id: string | null | undefined, soldiers: number) {
  const n = Math.max(1, Math.floor(soldiers));
  if (isDefend5(id)) return Math.max(1, Math.floor(n / 2));
  return n;
}

export function defendDuration(id: string | null | undefined) {
  if (isDefend3(id)) return DEFEND3_SECONDS;
  return isDefendSortie(id) ? DEFEND2_SECONDS : DEFEND_SECONDS;
}

export function defendOrigin(id?: string | null) {
  if (isDefendSortie(id)) return { x: DEFEND2_CX, z: DEFEND2_CZ };
  return { x: DEFEND_CX, z: DEFEND_CZ };
}

export function defendPlayhead(recT: number, id?: string | null) {
  if (isDefendSortie(id)) return Math.max(0, recT - DEFEND2_SORTIE);
  return Math.max(0, recT);
}

export function defendBeat(recT: number, id?: string | null): DefendBeat {
  if (isDefendSortie(id) && recT < DEFEND2_SORTIE) {
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

function roamOverArmy(base: ShotPose, recT: number, soldiers: number, ox: number, oz: number, spread = 1): ShotPose {
  const t = Math.max(0, recT - DEFEND3_ZOOM_END);
  const u = clamp01(t / DEFEND3_ORBIT);
  const fade = easeInOut(clamp01(t / 1.05));
  const armyR = defendArmyRadius(Math.max(1, soldiers), spread);
  const rx = armyR * 0.56;
  const rz = armyR * 0.56;
  const lookX = ox + Math.sin(u * Math.PI * 2.05 + 0.35) * rx;
  const lookZ = oz + Math.sin(u * Math.PI * 1.35 + 1.2) * rz;
  const offX = base.x - base.lx;
  const offZ = base.z - base.lz;
  const yaw = u * 0.72 + 0.2 * Math.sin(u * Math.PI * 1.85);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const camX = lookX + offX * c - offZ * s;
  const camZ = lookZ + offX * s + offZ * c;
  const y = base.y + Math.sin(u * Math.PI * 1.55) * 1.15;
  const roam = pose(camX, y, camZ, lookX, base.ly + 0.12, lookZ, base.fov);
  if (fade <= 0) return base;
  if (fade >= 1) return roam;
  return lerpPose(base, roam, fade);
}

export function defendArmyRadius(n: number, spread = 1) {
  return Math.max(3.4, Math.sqrt(Math.max(1, n) / Math.PI) * DEFEND_SPACING * spread);
}

function ringCount(id?: string | null) {
  if (isDefend5(id)) return DEFEND5_RINGS;
  if (isDefend3(id)) return DEFEND3_RINGS;
  return isDefendSortie(id) ? DEFEND2_RINGS : DEFEND_RINGS;
}

function ringGap(id?: string | null) {
  if (isDefend5(id)) return DEFEND5_RING_GAP;
  if (isDefend3(id)) return DEFEND3_RING_GAP;
  return isDefendSortie(id) ? DEFEND2_RING_GAP : DEFEND_RING_GAP;
}

function ringSpacing(id?: string | null) {
  if (isDefend5(id)) return DEFEND5_RING_SPACING;
  if (isDefend3(id)) return DEFEND3_RING_SPACING;
  return isDefendSortie(id) ? DEFEND2_RING_SPACING : DEFEND_RING_SPACING;
}

function ringCap(id?: string | null) {
  if (isDefend3(id)) return DEFEND3_MAX_ENEMIES;
  return isDefendSortie(id) ? DEFEND2_MAX_ENEMIES : DEFEND_MAX_ENEMIES;
}

function innerGap(id?: string | null) {
  return isDefend3(id) ? DEFEND3_INNER_GAP : DEFEND_INNER_GAP;
}

function ringBand(id?: string | null) {
  return (ringCount(id) - 1) * ringGap(id);
}

export function defendOuterAt(recT: number, armyR: number, id?: string | null) {
  const t = Math.max(0, recT - DEFEND_PULL_END);
  const u = easeInOut(clamp01(t / DEFEND_MAIN_SECONDS));
  const end = armyR + innerGap(id) + ringBand(id);
  const start = end + (isDefend3(id) ? 16 : isDefendSortie(id) ? 12 : DEFEND_APPROACH);
  return start + (end - start) * u;
}

function packRings(armyR: number, spacing: number, want: number, id: DefendId): DefendRingLayout {
  const gap = ringGap(id);
  const outer0 = defendOuterAt(0, armyR, id);
  const minR = armyR + innerGap(id) - 0.4;
  const ringsN = ringCount(id);
  const specs: DefendRingSpec[] = [];
  for (let ring = 0; ring < ringsN; ring++) {
    const r0 = outer0 - ring * gap;
    if (r0 < minR) continue;
    const innerU = ring / Math.max(1, ringsN - 1);
    const pack = Math.max(0.34, 1 - Math.pow(innerU, 1.25) * 0.58);
    const sp = spacing * pack;
    const n = Math.max(22, Math.round((2 * Math.PI * r0) / sp));
    specs.push({ ring, n, offset: (ring % 2) * (Math.PI / Math.max(1, n)) });
  }
  specs.sort((a, b) => b.ring - a.ring);
  const rings: DefendRingSpec[] = [];
  let cap = 0;
  for (const spec of specs) {
    if (cap >= want) break;
    if (cap + spec.n > want) {
      const take = want - cap;
      if (take < 12) break;
      rings.push({ ring: spec.ring, n: take, offset: spec.offset });
      cap += take;
      break;
    }
    rings.push(spec);
    cap += spec.n;
  }
  rings.sort((a, b) => a.ring - b.ring);
  return { armyR, rings, cap: Math.max(1, cap), gap };
}

function defend5RingLayout(soldiers: number): DefendRingLayout {
  const base = defendRingLayout(Math.max(1, soldiers), DEFEND4_ID);
  const want = Math.max(24, base.cap * 2);
  const armyR = defendArmyRadius(defendShownFriends(DEFEND5_ID, soldiers), DEFEND5_SPREAD);
  let spacing = DEFEND5_RING_SPACING;
  let laid = packRings(armyR, spacing, want, DEFEND5_ID);
  while (laid.cap < want && spacing > 0.48) {
    spacing *= 0.86;
    laid = packRings(armyR, spacing, want, DEFEND5_ID);
  }
  return laid;
}

export function defendRingLayout(soldiers: number, id: DefendId = DEFEND_ID): DefendRingLayout {
  if (id === DEFEND5_ID) return defend5RingLayout(soldiers);
  const armyR = defendArmyRadius(Math.max(1, soldiers));
  const gap = ringGap(id);
  const spacing = ringSpacing(id);
  const maxE = ringCap(id);
  const outer0 = defendOuterAt(0, armyR, id);
  const minR = armyR + innerGap(id) - 0.4;
  const specs: DefendRingSpec[] = [];
  for (let ring = 0; ring < ringCount(id); ring++) {
    const r0 = outer0 - ring * gap;
    if (r0 < minR) continue;
    const innerU = ring / Math.max(1, ringCount(id) - 1);
    const pack = isDefend3(id) ? Math.max(0.34, 1 - Math.pow(innerU, 1.25) * 0.58) : 1;
    const sp = spacing * pack;
    const n = Math.max(isDefend3(id) ? 22 : 16, Math.round((2 * Math.PI * r0) / sp));
    specs.push({ ring, n, offset: (ring % 2) * (Math.PI / Math.max(1, n)) });
  }
  if (isDefend3(id)) specs.sort((a, b) => b.ring - a.ring);
  const rings: DefendRingSpec[] = [];
  let cap = 0;
  for (const spec of specs) {
    if (cap >= maxE) break;
    if (cap + spec.n > maxE) {
      const take = maxE - cap;
      if (take < 12) break;
      rings.push({ ring: spec.ring, n: take, offset: spec.offset });
      cap += take;
      break;
    }
    rings.push(spec);
    cap += spec.n;
  }
  rings.sort((a, b) => a.ring - b.ring);
  return { armyR, rings, cap: Math.max(1, cap), gap };
}

function defendRingCap(ring: number) {
  return ring <= 0 ? 1 : 6 * ring;
}

function defendSymLoc(index: number, n: number) {
  let ring = 0;
  let start = 0;
  let loc = { ring: 0, start: 0, take: 1 };
  let maxRing = 0;
  while (start < n) {
    const take = Math.min(defendRingCap(ring), n - start);
    if (index >= start && index < start + take) loc = { ring, start, take };
    maxRing = ring;
    start += take;
    ring += 1;
  }
  return { ...loc, maxRing };
}

export function defendSoldierPos(
  index: number,
  count: number,
  t: number,
  out: { set: (x: number, y: number, z: number) => void },
  cx = DEFEND_CX,
  cz = DEFEND_CZ,
  symmetric = false,
  spread = 1
) {
  const n = Math.max(1, count);
  const rMax = defendArmyRadius(n, spread);
  void t;
  if (symmetric) {
    const loc = defendSymLoc(Math.max(0, Math.min(index, n - 1)), n);
    const r = loc.ring === 0 || loc.maxRing === 0 ? 0 : (loc.ring / loc.maxRing) * rMax;
    const k = index - loc.start;
    const a = loc.take <= 1 ? Math.PI / 2 : Math.PI / 2 + (k / loc.take) * Math.PI * 2;
    out.set(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r);
    return;
  }
  const golden = Math.PI * (3 - Math.sqrt(5));
  const r = n <= 1 ? 0 : rMax * Math.sqrt((index + 0.5) / n);
  const a = index * golden;
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

  if (isDefendSortie(id) && recT < DEFEND2_SORTIE) {
    const once = isDefend5(id);
    const k = spec.ring * spec.n + i;
    const delay = once ? (k % 36) * 0.01 : (k / Math.max(1, layout.cap)) * 2.05;
    if (recT < delay) {
      const lane = once ? ((i % 19) - 9) * 0.46 : (i % 11 - 5) * 0.62;
      out.x = cx + lane;
      out.y = -40;
      out.z = gateZ + 0.6;
      out.yaw = 0;
      return;
    }
    const u = easeInOut(clamp01((recT - delay) / (once ? 2.7 : 4.05)));
    const pour = clamp01(u / (once ? 0.2 : 0.3));
    const wrap = easeInOut(clamp01((u - (once ? 0.14 : 0.22)) / (once ? 0.86 : 0.78)));
    const aNow = Math.PI + wrap * (aFinal - Math.PI);
    const xRing = cx + Math.sin(aNow) * r;
    const zRing = cz + Math.cos(aNow) * r;
    const lane = once ? ((i % 19) - 9) * 0.46 : (i % 11 - 5) * 0.62;
    const gx = cx + lane;
    const gz = once ? gateZ + 1.15 : gateZ + 1.35 + (spec.ring % 4) * 0.45;
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
  const tight = isDefend3(id);
  const armyR = defendArmyRadius(Math.max(1, soldiers), isDefend5(id) ? DEFEND5_SPREAD : 1);
  const outer = defendOuterAt(t, armyR, id);
  const pull = easeOutCubic(clamp01(t / DEFEND_PULL_END));
  const zoomU = easeOutCubic(clamp01((t - DEFEND_PULL_END) / (DEFEND_MAIN_SECONDS * 0.8)));
  const polar = (tight ? 0.11 : 0.07) + pull * 0.2 + zoomU * (tight ? 0.7 : 0.74);
  const pad = (tight ? 1.22 : 1.343) - pull * 0.12 - zoomU * 0.22;
  const fov = (tight ? 44 : 46) - pull * 2 - zoomU * 13;
  const az = 0.015 + zoomU * 0.12;
  const ringDist = distToFitRing(outer, polar, fov, pad);
  const closeDist = 13.2 + Math.min(4.5, armyR * 0.07);
  const dist = (ringDist * (1 - zoomU) + closeDist * zoomU) * (tight ? 0.8 : 0.86);
  const lookR = zoomU * Math.min(armyR * 0.55, Math.max(0, armyR - 0.9));
  const lx = DEFEND_CX + Math.sin(az) * lookR;
  const lz = DEFEND_CZ + Math.cos(az) * lookR;
  const x = DEFEND_CX + Math.sin(polar) * Math.sin(az) * dist;
  const y = Math.cos(polar) * dist;
  const z = DEFEND_CZ + Math.sin(polar) * Math.cos(az) * dist;
  return pose(x, y, z, lx, 1.45 + zoomU * 0.18, lz, fov);
}

function sampleDefendSortie(recT: number, soldiers: number, level: number, id: DefendId): ShotPose {
  const close = isDefend3(id);
  const t = Math.max(0, recT);
  const armyR = defendArmyRadius(Math.max(1, soldiers), isDefend5(id) ? DEFEND5_SPREAD : 1);
  const gateZ = castleFrame(level).front;
  const oz = DEFEND2_CZ;
  const u = clamp01(t / DEFEND2_SORTIE);
  const nearZ = Math.min(gateZ - 8, oz - armyR);
  const farZ = oz + armyR + 10;
  const wrapR = armyR + innerGap(id) + ringBand(id) + 8;
  const lookZ = close ? oz + armyR * 0.08 : (nearZ + farZ) * (0.48 + u * 0.06);
  const span = close ? wrapR : Math.max((farZ - nearZ) * 0.52, armyR + 16);
  const polar = close ? 0.13 + u * 0.04 : 0.055 + u * 0.025;
  const fov = close ? 40 : 42;
  const dist = distToFitRing(span, polar, fov, close ? 1.16 : 1.3) * (close ? 0.9 : 1);
  const az = 0.02;
  const x = Math.sin(polar) * Math.sin(az) * dist;
  const y = Math.cos(polar) * dist;
  const z = lookZ + Math.sin(polar) * Math.cos(az) * dist;
  return pose(x, y, z, 0, 1.55, lookZ, fov);
}

function sampleDefendPath(recT: number, soldiers: number, id: DefendId, level: number): ShotPose {
  const { x: ox, z: oz } = defendOrigin(id);
  if (!isDefendSortie(id)) return sampleDefend(recT, soldiers, id);
  const play = recT - DEFEND2_SORTIE;
  const shrink = offsetPose(sampleDefend(Math.max(0, play), soldiers, id), ox, oz);
  if (play >= 0) return shrink;
  const bird = sampleDefendSortie(recT, soldiers, level, id);
  const blend = easeOutCubic(clamp01((recT - (DEFEND2_SORTIE - 0.75)) / 0.75));
  if (blend <= 0) return bird;
  return lerpPose(bird, offsetPose(sampleDefend(0, soldiers, id), ox, oz), blend);
}

export function sampleDefendCam(recT: number, soldiers: number, id: DefendId, level: number): ShotPose {
  if (!isDefend3(id)) return sampleDefendPath(recT, soldiers, id, level);
  const frozen = sampleDefendPath(Math.min(recT, DEFEND3_ZOOM_END), soldiers, id, level);
  if (recT <= DEFEND3_ZOOM_END) return frozen;
  const { x: ox, z: oz } = defendOrigin(id);
  return roamOverArmy(frozen, recT, soldiers, ox, oz, isDefend5(id) ? DEFEND5_SPREAD : 1);
}
