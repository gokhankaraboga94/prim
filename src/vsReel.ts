import { frontWalk, frontWallFace } from "./castleLayout";
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
  const face = frontWallFace(level);
  const localX = [-9.55, -4.35, 4.35, 9.55][k % VS2_LADDERS];
  return {
    x: localX * face.sx,
    baseY: 0.06,
    baseZ: face.z + 12.4,
    topY: face.y + 0.08,
    topZ: face.z + 0.85,
  };
}

export function vs2SoldierAt(i: number, n: number, recT: number, level: number, out: VsPose) {
  const t = Math.max(0, recT);
  const ladder = vs2Ladder(i % VS2_LADDERS, level);
  const walk = frontWalk(level);
  const face = frontWallFace(level);
  const queue = Math.floor(i / VS2_LADDERS);
  const h = vsHash(i, 9);
  const delay = queue * 0.22 + h * 0.2;
  const runEnd = 3.2 + delay;
  const climbDur = 7.4 + h * 1.6;
  const crestDur = 0.85;
  const fall = h < 0.4;
  const fallAt = 0.22 + vsHash(i, 4) * 0.55;
  const knockOff = !fall && h > 0.78;
  const cols = vsCols(Math.max(1, n));
  const row = Math.floor(i / cols);
  const col = i % cols;
  const rowN = Math.min(cols, n - row * cols);
  const sx = (col - (rowN - 1) / 2) * VS_FILE;
  const sz = 58 + row * VS_RANK;
  const stand = 0.42;

  if (t < runEnd) {
    const u = ease(t / Math.max(0.2, runEnd));
    out.x = lerp(sx, ladder.x, u);
    out.y = 0;
    out.z = lerp(sz, ladder.baseZ + stand, u);
    out.rx = 0;
    out.ry = Math.atan2(ladder.x - sx, ladder.baseZ - sz);
    out.rz = 0;
    return;
  }

  const climbU = clamp01((t - runEnd) / climbDur);
  const along = (u: number) => {
    out.x = ladder.x;
    out.y = lerp(0.18, ladder.topY, u);
    out.z = lerp(ladder.baseZ, ladder.topZ, u) + stand;
    out.rx = -0.22;
    out.ry = Math.PI;
    out.rz = 0;
  };

  if (fall && climbU >= fallAt) {
    along(fallAt);
    const fu = clamp01((climbU - fallAt) / 0.22);
    const g = fu * fu;
    out.x += (h - 0.5) * 1.25 * fu;
    out.z += g * 5.2;
    out.y = Math.max(0.12, out.y * (1 - g));
    out.rx = lerp(-0.22, 1.5, fu);
    out.rz = (h - 0.5) * fu;
    return;
  }

  if (climbU < 1) {
    along(climbU);
    return;
  }

  const crestT = t - runEnd - climbDur;
  const crestU = clamp01(crestT / crestDur);
  out.x = ladder.x;
  out.y = walk.y;
  out.z = lerp(face.z + 0.55, walk.z + 0.35, ease(crestU));
  out.rx = -0.08;
  out.ry = Math.PI;
  out.rz = 0;

  const hitT = t - runEnd - climbDur - crestDur;
  if (hitT < 0) return;
  const struck = clamp01(hitT / 0.28);
  out.rx = lerp(-0.08, 0.55, struck);
  out.z += struck * 0.45;
  if (hitT < 0.28) return;

  const dieU = clamp01((hitT - 0.28) / 0.7);
  if (knockOff) {
    const g = dieU * dieU;
    out.z = walk.z + 0.35 + g * 7.5;
    out.y = Math.max(0.12, walk.y * (1 - g));
    out.rx = lerp(0.55, 1.52, dieU);
    out.rz = (h - 0.5) * dieU;
    return;
  }
  out.y = walk.y;
  out.z = walk.z + 0.2;
  out.rx = lerp(0.55, 1.38, dieU);
  out.rz = (h - 0.5) * dieU * 0.35;
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
  const face = frontWallFace(level);
  const L = vs2Ladder(2, level);
  const midZ = (L.baseZ + L.topZ) * 0.5;
  void soldiers;
  return sampleKeys(recT, [
    { t: 0, p: pose(26, face.y + 18, L.baseZ + 28, 0, face.y * 0.55, midZ, 40) },
    { t: 4.4, p: pose(-24, face.y * 0.7, L.baseZ + 22, 0, face.y * 0.45, midZ, 38) },
    { t: 8.6, p: pose(L.x + 16, face.y * 0.52, L.baseZ + 18, L.x, face.y * 0.48, midZ, 34) },
    { t: 13.4, p: pose(L.x + 11, face.y * 0.72, L.baseZ + 14, L.x, face.y * 0.7, L.topZ + 2, 32) },
    { t: 18, p: pose(-14, face.y + 8, face.z + 22, 0, face.y * 0.92, face.z - 2, 38) },
    { t: 22.2, p: pose(vs2Ladder(0, level).x - 8, face.y * 0.85, L.baseZ + 16, vs2Ladder(0, level).x, face.y * 0.7, midZ, 32) },
    { t: 26, p: pose(18, face.y + 10, L.baseZ + 24, 0, face.y * 0.6, midZ, 38) },
    { t: 30, p: pose(-10, face.y + 16, L.baseZ + 30, 0, face.y * 0.55, midZ, 39) },
  ]);
}
