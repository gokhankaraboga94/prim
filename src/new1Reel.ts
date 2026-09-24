import { lerpPose, type ShotPose } from "./shotModes";

export const NEW1_ID = "new1" as const;
export type New1Id = typeof NEW1_ID;
export const NEW1_MODE = { id: NEW1_ID, label: "new1" } as const;
export const NEW1_SECONDS = 30;

export type New1Pose = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
};

export function isNew1(id: string | null | undefined): id is New1Id {
  return id === NEW1_ID;
}

export function new1Duration(id: string | null | undefined) {
  return isNew1(id) ? NEW1_SECONDS : 0;
}

const FILE = 2.22;
const RANK = 2.02;
const E_FILE = 1.58;
const E_RANK = 1.38;
const CHARGE = 4.35;
const CLASH = 4.2;

export function new1EnemyCount(soldiers: number) {
  return Math.min(5400, Math.max(2400, Math.floor(Math.max(1, soldiers) * 5.2)));
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

function hash(i: number, salt = 0) {
  const x = Math.sin(i * 127.13 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function pose(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): ShotPose {
  return { x, y: Math.max(8, y), z, lx, ly, lz, fov };
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

function friendCols(n: number) {
  return Math.max(7, Math.ceil(Math.sqrt(Math.max(1, n) * 1.28)));
}

function enemyCols(n: number) {
  return Math.max(14, Math.ceil(Math.sqrt(Math.max(1, n) * 2.15)));
}

function friendSlot(i: number, n: number) {
  const cols = friendCols(n);
  const row = Math.floor(i / cols);
  const col = i % cols;
  const rowN = Math.min(cols, n - row * cols);
  return { x: (col - (rowN - 1) / 2) * FILE, row, col };
}

function foeSlot(i: number, n: number) {
  const cols = enemyCols(n);
  const row = Math.floor(i / cols);
  const col = i % cols;
  const rowN = Math.min(cols, n - row * cols);
  return { x: (col - (rowN - 1) / 2) * E_FILE, row, col };
}

export function new1FriendDieAt(i: number) {
  const h = hash(i, 2);
  if (hash(i, 11) < 0.1) return 3.45 + hash(i, 12) * 1.6;
  return 4.05 + h * 23.4;
}

export function new1EnemyDieAt(i: number) {
  if (hash(i, 4) > 0.11) return 1e9;
  return 8.2 + hash(i, 5) * 18;
}

function crumple(t: number, dieAt: number, knockZ: number, knockX: number, out: New1Pose) {
  const wind = clamp01((t - (dieAt - 0.38)) / 0.38);
  if (wind > 0 && wind < 1) {
    out.x += knockX * wind * 0.55;
    out.z += knockZ * wind * 0.7;
    out.rx += wind * 0.28;
    out.rz += knockX * wind * 0.22;
  }
  const u = clamp01((t - dieAt) / 0.78);
  if (u <= 0) return;
  const g = u * u * (3 - 2 * u);
  out.y = lerp(Math.max(0.08, out.y), 0.1, g);
  out.rx = lerp(out.rx, 1.56, g);
  out.rz = lerp(out.rz, knockX * 0.62, g);
  out.x += knockX * g * 0.85;
  out.z += knockZ * g * 1.15;
}

export function new1FriendAt(i: number, n: number, recT: number, out: New1Pose) {
  const t = Math.max(0, recT);
  const count = Math.max(1, n);
  const s = friendSlot(i, count);
  const ranks = Math.floor((count - 1) / friendCols(count));
  const fear = ease(clamp01((t - 2.4) / 2.1));
  const fight = t > CHARGE ? 1 : 0;
  const faceBack = s.row > ranks * 0.5;
  out.x = s.x + (hash(i, 7) - 0.5) * 0.18 + Math.sin(t * 5.4 + i * 0.31) * (0.06 + fight * 0.2);
  out.y = fight ? Math.abs(Math.sin(t * 10.6 + i)) * 0.07 : 0;
  out.z = (s.row - ranks / 2) * RANK + (hash(i, 8) - 0.5) * 0.16;
  out.rx = fight ? Math.sin(t * 12.2 + i) * 0.16 : 0;
  out.ry = faceBack ? 0 : Math.PI;
  out.rz = 0;
  if (fear > 0) {
    out.z += (faceBack ? 1 : -1) * fear * 0.22;
    out.rx += fear * 0.08;
  }
  crumple(t, new1FriendDieAt(i), faceBack ? 1.15 : -1.15, hash(i, 9) - 0.5, out);
}

export function new1EnemyAt(i: number, soldiers: number, recT: number, out: New1Pose) {
  const total = Math.max(1, new1EnemyCount(soldiers));
  const frontN = Math.ceil(total * 0.5);
  const front = i < frontN;
  const local = front ? i : i - frontN;
  const sideN = front ? frontN : Math.max(1, total - frontN);
  const t = Math.max(0, recT);
  const s = foeSlot(local, sideN);
  const charge = ease(t / (CHARGE + (front ? 0 : 0.18)));
  const press = ease(clamp01((t - CHARGE) / 9.5));
  const startZ = front ? -98 - s.row * E_RANK : 98 + s.row * E_RANK;
  const holdZ = front ? -2.1 - (s.row % 5) * 0.32 : 2.1 + (s.row % 5) * 0.32;
  const pileZ = front ? -0.35 - (s.row % 4) * 0.18 : 0.35 + (s.row % 4) * 0.18;
  const endZ = lerp(holdZ, pileZ, press);
  out.x = s.x * 1.08 + (t > CHARGE ? Math.sin(t * 5.2 + i * 0.27) * 0.22 : 0);
  out.x += (hash(i, 3) - 0.5) * 0.35;
  out.y = t > CHARGE ? Math.abs(Math.sin(t * 8.8 + i)) * 0.08 : 0;
  out.z = lerp(startZ, endZ, charge);
  out.rx = t > CHARGE ? Math.sin(t * 11.1 + i) * 0.14 : 0;
  out.ry = front ? 0 : Math.PI;
  out.rz = 0;
  crumple(t, new1EnemyDieAt(i), front ? -0.45 : 0.45, 0.5 - hash(i, 6), out);
}

export function sampleNew1Cam(recT: number, soldiers: number): ShotPose {
  const n = Math.max(1, soldiers);
  const halfW = friendCols(n) * FILE * 0.38;
  const t = Math.max(0, recT);
  const hit = t > CLASH && t < CLASH + 1.15 ? Math.sin((t - CLASH) * 46) * (1 - (t - CLASH) / 1.15) * 0.7 : 0;
  const p = sampleKeys(t, [
    { t: 0, p: pose(7 + halfW * 0.02, 172, 16, 0, 0.35, 0, 48) },
    { t: 3.1, p: pose(-11, 128, 10, 0.4, 0.45, 0.2, 46) },
    { t: 6.2, p: pose(9, 86, -8, 0.2, 0.7, 0, 42) },
    { t: 10.4, p: pose(-6, 52, 12, 0.8, 1.05, 0.6, 38) },
    { t: 15.2, p: pose(5, 29, 15, 0.4, 1.25, 0.3, 34) },
    { t: 20.4, p: pose(-8, 20.5, 9, 1.6, 1.05, -0.4, 31) },
    { t: 25.2, p: pose(4, 16.8, 11, 0.2, 0.85, 1.2, 30) },
    { t: 30, p: pose(2.4, 15.2, 8, 0, 0.7, 0.4, 30) },
  ]);
  return {
    ...p,
    x: p.x + hit * 0.45,
    y: p.y + Math.abs(hit) * 0.2,
    z: p.z + hit * 0.25,
  };
}
