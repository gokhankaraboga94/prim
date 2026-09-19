import { castleFrame, frontWalk } from "./castleLayout";
import { lerpPose, type ShotPose } from "./shotModes";

export const VS_ID = "vs" as const;
export const VS2_ID = "vs2" as const;
export type VsId = typeof VS_ID | typeof VS2_ID;

export const VS_MODE = { id: VS_ID, label: "VS" } as const;
export const VS2_MODE = { id: VS2_ID, label: "VS2" } as const;
export const VS_SECONDS = 30;
export const VS2_SECONDS = 30;
export const VS2_LADDERS = 4;

export type VsPose = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
};

export function isVs(id: string | null | undefined): id is typeof VS_ID {
  return id === VS_ID;
}

export function isVs2(id: string | null | undefined): id is typeof VS2_ID {
  return id === VS2_ID;
}

export function isVsMode(id: string | null | undefined): id is VsId {
  return id === VS_ID || id === VS2_ID;
}

export function vsDuration(id: string | null | undefined) {
  if (isVs2(id)) return VS2_SECONDS;
  return isVs(id) ? VS_SECONDS : 0;
}

export function vsEnemyCount(soldiers: number) {
  return Math.min(3600, Math.max(0, Math.floor(soldiers) * 3));
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

function ease(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function vsHash(i: number, salt = 0) {
  const x = Math.sin(i * 127.13 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function pose(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): ShotPose {
  return { x, y: Math.max(3.2, y), z, lx, ly: Math.max(1.2, ly), lz, fov };
}

function sampleKeys(recT: number, keys: { t: number; p: ShotPose }[]) {
  const t = Math.max(0, recT);
  if (t <= keys[0].t) return keys[0].p;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.p;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1];
      const u = ease((t - a.t) / Math.max(0.05, keys[i].t - a.t));
      return lerpPose(a.p, keys[i].p, u);
    }
  }
  return last.p;
}

const VS_CLASH_Z = 48;
const VS_FILE = 2.12;
const VS_RANK = 2.28;
const VS_CHARGE = 5.15;

function vsCols(n: number) {
  return Math.max(6, Math.ceil(Math.sqrt(Math.max(1, n) * 1.55)));
}

function vsSlot(i: number, n: number) {
  const cols = vsCols(n);
  const row = Math.floor(i / cols);
  const col = i % cols;
  const rowN = Math.min(cols, n - row * cols);
  return { x: (col - (rowN - 1) / 2) * VS_FILE, row };
}

export function vsFriendlyDieAt(i: number) {
  if (vsHash(i, 1) > 0.75) return 1e9;
  return 7.1 + vsHash(i, 2) * 18.6;
}

export function vsEnemyDieAt(i: number) {
  return 6.3 + vsHash(i, 3) * 20.4;
}

function applyFall(t: number, dieAt: number, knock: number, out: VsPose) {
  const u = clamp01((t - dieAt) / 0.58);
  if (u <= 0) return false;
  out.y = lerp(Math.max(0.12, out.y), 0.14, u);
  out.rx = lerp(out.rx, 1.52, u);
  out.rz = lerp(out.rz, knock * 0.45, u);
  out.z += u * knock * 0.7;
  return u > 0.12;
}

export function vsFriendlyAt(i: number, n: number, recT: number, out: VsPose) {
  const t = Math.max(0, recT);
  const slot = vsSlot(i, Math.max(1, n));
  const startZ = 86 + slot.row * VS_RANK;
  const endZ = VS_CLASH_Z + slot.row * 1.05;
  const charge = ease(t / VS_CHARGE);
  out.x = slot.x + (t > VS_CHARGE ? Math.sin(t * 6.1 + i * 0.37) * 0.22 : 0);
  out.y = t > VS_CHARGE ? Math.abs(Math.sin(t * 9.2 + i)) * 0.09 : 0;
  out.z = lerp(startZ, endZ, charge);
  out.rx = t > VS_CHARGE ? Math.sin(t * 11.4 + i) * 0.18 : 0;
  out.ry = Math.PI;
  out.rz = 0;
  applyFall(t, vsFriendlyDieAt(i), vsHash(i, 8) - 0.5, out);
}

export function vsEnemyAt(i: number, friendlies: number, recT: number, out: VsPose) {
  const e = Math.max(1, vsEnemyCount(friendlies));
  const t = Math.max(0, recT);
  const slot = vsSlot(i, e);
  const startZ = 12 + slot.row * 1.72;
  const endZ = VS_CLASH_Z - 2.15 - (slot.row % 3) * 0.35;
  const charge = ease(t / (VS_CHARGE + 0.35));
  out.x = slot.x * 1.04 + (t > VS_CHARGE ? Math.sin(t * 5.7 + i * 0.29) * 0.2 : 0);
  out.y = t > VS_CHARGE ? Math.abs(Math.sin(t * 8.6 + i)) * 0.07 : 0;
  out.z = lerp(startZ, endZ, charge);
  out.rx = t > VS_CHARGE ? Math.sin(t * 10.2 + i) * 0.16 : 0;
  out.ry = 0;
  out.rz = 0;
  applyFall(t, vsEnemyDieAt(i), 0.5 - vsHash(i, 6), out);
}

export type VsLadder = {
  x: number;
  baseY: number;
  baseZ: number;
  topY: number;
  topZ: number;
};

export function vs2Ladder(k: number, level: number): VsLadder {
  const castle = castleFrame(level);
  const walk = frontWalk(level);
  const span = Math.abs(walk.leftX) * 0.82;
  const xs = [-0.78, -0.4, 0.4, 0.78];
  const x = xs[k % VS2_LADDERS] * span;
  return {
    x,
    baseY: 0.08,
    baseZ: castle.front + 9.2,
    topY: walk.y + 0.15,
    topZ: castle.front + 0.7,
  };
}

export function vs2SoldierAt(i: number, n: number, recT: number, level: number, out: VsPose) {
  const t = Math.max(0, recT);
  const ladder = vs2Ladder(i % VS2_LADDERS, level);
  const queue = Math.floor(i / VS2_LADDERS);
  const h = vsHash(i, 9);
  const delay = queue * 0.26 + h * 0.22;
  const runEnd = 3.45 + delay;
  const climbDur = 6.05 + h * 1.7;
  const fall = h < 0.44;
  const fallAt = 0.28 + vsHash(i, 4) * 0.52;
  const cols = vsCols(Math.max(1, n));
  const row = Math.floor(i / cols);
  const col = i % cols;
  const rowN = Math.min(cols, n - row * cols);
  const sx = (col - (rowN - 1) / 2) * VS_FILE;
  const sz = 58 + row * VS_RANK;

  if (t < runEnd) {
    const u = ease(t / Math.max(0.2, runEnd));
    out.x = lerp(sx, ladder.x, u);
    out.y = 0;
    out.z = lerp(sz, ladder.baseZ, u);
    out.rx = 0;
    out.ry = Math.atan2(ladder.x - sx, ladder.baseZ - sz);
    out.rz = 0;
    return;
  }

  const climbU = clamp01((t - runEnd) / climbDur);
  const along = (u: number) => {
    out.x = lerp(ladder.x, ladder.x, u);
    out.y = lerp(0.22, ladder.topY, u);
    out.z = lerp(ladder.baseZ, ladder.topZ, u);
    out.rx = -0.18;
    out.ry = Math.PI;
    out.rz = 0;
  };

  if (fall && climbU >= fallAt) {
    along(fallAt);
    const fu = clamp01((climbU - fallAt) / 0.2);
    const g = fu * fu;
    out.x += (h - 0.5) * 1.1 * fu;
    out.z += g * 4.4;
    out.y = Math.max(0.12, out.y * (1 - g));
    out.rx = lerp(-0.18, 1.48, fu);
    out.rz = (h - 0.5) * fu;
    return;
  }

  along(Math.min(climbU, 1));
  const topT = runEnd + climbDur * 0.97;
  if (t >= topT) {
    const du = clamp01((t - topT) / 0.55);
    out.y = ladder.topY - du * 0.2;
    out.z = ladder.topZ + 0.15;
    out.rx = lerp(-0.18, 1.32, du);
    out.rz = (h - 0.5) * du * 0.4;
  }
}

export function vsSoldierAt(i: number, n: number, recT: number, vs2: boolean, level: number, out: VsPose) {
  if (vs2) vs2SoldierAt(i, n, recT, level, out);
  else vsFriendlyAt(i, n, recT, out);
}

export function sampleVsCam(recT: number, soldiers: number, level: number, id: VsId): ShotPose {
  if (isVs2(id)) return sampleVs2Cam(recT, soldiers, level);
  const n = Math.max(1, soldiers);
  const width = vsCols(n) * VS_FILE * 0.52;
  return sampleKeys(recT, [
    { t: 0, p: pose(4, 86, 118, 0, 4.2, VS_CLASH_Z + 8, 38) },
    { t: 3.6, p: pose(-18, 42, 102, 0, 3.2, VS_CLASH_Z + 6, 40) },
    { t: 7.2, p: pose(22, 14, VS_CLASH_Z + 28, 1.2, 1.8, VS_CLASH_Z, 36) },
    { t: 11.4, p: pose(-8, 9.4, VS_CLASH_Z + 16, 0, 1.55, VS_CLASH_Z - 1, 32) },
    { t: 15.2, p: pose(6, 58, 96, 0, 3.6, VS_CLASH_Z, 42) },
    { t: 19.4, p: pose(-14, 11, VS_CLASH_Z + 12, -2, 1.6, VS_CLASH_Z + 1, 30) },
    { t: 23.6, p: pose(28, 24, VS_CLASH_Z + 34, 0, 2.4, VS_CLASH_Z, 38) },
    { t: 27.2, p: pose(-2, 72, 108, 0, 4.4, VS_CLASH_Z + 4, 40) },
    { t: 30, p: pose(8, 92, 124, 0, 5.2, VS_CLASH_Z + 6, 39) },
  ].map((k) => ({ t: k.t, p: pose(k.p.x + Math.min(10, width * 0.04), k.p.y, k.p.z, k.p.lx, k.p.ly, k.p.lz, k.p.fov) })));
}

function sampleVs2Cam(recT: number, soldiers: number, level: number): ShotPose {
  const castle = castleFrame(level);
  const walk = frontWalk(level);
  const L = vs2Ladder(2, level);
  const wallZ = castle.front;
  void soldiers;
  return sampleKeys(recT, [
    { t: 0, p: pose(18, 48, 92, 0, 10, wallZ + 18, 40) },
    { t: 4.2, p: pose(-22, 22, 64, 0, 8, wallZ + 10, 38) },
    { t: 8.4, p: pose(L.x + 6.5, 8.5, L.baseZ + 14, L.x, 6, wallZ + 4, 34) },
    { t: 13.2, p: pose(L.x + 4.2, walk.y * 0.55, L.baseZ + 9, L.x, walk.y * 0.62, wallZ + 1, 32) },
    { t: 17.6, p: pose(-16, walk.y + 6, wallZ + 28, 0, walk.y * 0.7, wallZ + 2, 40) },
    { t: 21.8, p: pose(vs2Ladder(0, level).x - 3, 14, L.baseZ + 11, vs2Ladder(0, level).x, 8, wallZ + 2, 30) },
    { t: 25.6, p: pose(12, 36, 78, 0, 12, wallZ + 8, 38) },
    { t: 30, p: pose(-8, 52, 96, 0, 14, wallZ + 12, 39) },
  ]);
}
