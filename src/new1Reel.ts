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

export const NEW2_ID = "new2" as const;
export type New2Id = typeof NEW2_ID;
export const NEW2_MODE = { id: NEW2_ID, label: "new2" } as const;
export const NEW2_SECONDS = 30;

export function isNew1(id: string | null | undefined): id is New1Id {
  return id === NEW1_ID;
}

export function isNew2(id: string | null | undefined): id is New2Id {
  return id === NEW2_ID;
}

export function isNewField(id: string | null | undefined): id is New1Id | New2Id {
  return id === NEW1_ID || id === NEW2_ID;
}

export function new1Duration(id: string | null | undefined) {
  return isNew1(id) ? NEW1_SECONDS : 0;
}

const FILE = 2.38;
const RANK = 2.18;
const CHARGE = 4.35;
const CLASH = 4.2;
const FIGHT_GAP = 1.62;
const BODY_GAP = 0.58;

export function new1EnemyCount(soldiers: number) {
  const n = Math.max(1, Math.floor(soldiers));
  return Math.min(4800, n * 2);
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
  return Math.max(7, Math.ceil(Math.sqrt(Math.max(1, n) * 1.22)));
}

function friendStand(i: number, n: number) {
  const count = Math.max(1, n);
  const cols = friendCols(count);
  const row = Math.floor(i / cols);
  const col = i % cols;
  const rowN = Math.min(cols, count - row * cols);
  const ranks = Math.floor((count - 1) / cols);
  return {
    x: (col - (rowN - 1) / 2) * FILE,
    z: (row - ranks / 2) * RANK,
    row,
    col,
    faceBack: row > ranks * 0.5,
  };
}

type FoePair = {
  friend: number;
  side: -1 | 1;
  mate: 0 | 1;
};

function foePair(i: number, soldiers: number): FoePair {
  const n = Math.max(1, Math.floor(soldiers));
  if (i < n) return { friend: i, side: -1, mate: 0 };
  if (i < n * 2) return { friend: i - n, side: 1, mate: 0 };
  const extra = i - n * 2;
  return { friend: extra % n, side: extra % 2 === 0 ? -1 : 1, mate: 1 };
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
    out.x += knockX * wind * 0.22;
    out.z += knockZ * wind * 0.18;
    out.rx += wind * 0.22;
    out.rz += knockX * wind * 0.14;
  }
  const u = clamp01((t - dieAt) / 0.78);
  if (u <= 0) return;
  const g = u * u * (3 - 2 * u);
  out.y = lerp(Math.max(0.08, out.y), 0.1, g);
  out.rx = lerp(out.rx, 1.56, g);
  out.rz = lerp(out.rz, knockX * 0.62, g);
  out.x += knockX * g * 0.42;
  out.z += knockZ * g * 0.38;
}

export function new1FriendAt(i: number, n: number, recT: number, out: New1Pose) {
  const t = Math.max(0, recT);
  const s = friendStand(i, n);
  const dieAt = new1FriendDieAt(i);
  const fight = t > CHARGE - 0.35 && t < dieAt ? 1 : 0;
  out.x = s.x + Math.sin(t * 6.2 + i * 0.31) * (0.04 + fight * 0.11);
  out.y = fight ? Math.abs(Math.sin(t * 11.4 + i)) * 0.06 : 0;
  out.z = s.z + Math.sin(t * 5.1 + i * 0.19) * fight * 0.08;
  out.rx = fight ? Math.sin(t * 13.2 + i) * 0.14 : 0;
  out.ry = s.faceBack ? 0 : Math.PI;
  out.rz = 0;
  crumple(t, dieAt, s.faceBack ? 0.55 : -0.55, hash(i, 9) - 0.5, out);
}

export function new1EnemyAt(i: number, soldiers: number, recT: number, out: New1Pose) {
  const n = Math.max(1, Math.floor(soldiers));
  const pair = foePair(i, n);
  const target = friendStand(pair.friend, n);
  const t = Math.max(0, recT);
  const side = pair.side;
  const dieAt = new1FriendDieAt(pair.friend);
  const dropped = t >= dieAt + 0.28;
  const laneX = pair.mate === 1 ? 0.92 : 0;
  const startZ = target.z + side * (92 + pair.mate * 3.2 + target.row * 0.15);
  const fightZ = target.z + side * FIGHT_GAP;
  const holdZ = dropped ? target.z + side * BODY_GAP : fightZ;
  const arrive = CHARGE + target.row * 0.035 + hash(i, 1) * 0.22;
  const charge = ease(t / Math.max(0.35, arrive));
  const stepIn = dropped ? ease(clamp01((t - dieAt - 0.28) / 0.55)) : 0;
  const stopZ = lerp(fightZ, holdZ, stepIn);
  const clampedZ = side < 0 ? Math.min(stopZ, target.z - BODY_GAP) : Math.max(stopZ, target.z + BODY_GAP);
  out.x = lerp(target.x + (hash(i, 3) - 0.5) * 0.08, target.x + laneX * (pair.friend % 2 === 0 ? 1 : -1), charge);
  out.y = charge > 0.92 ? Math.abs(Math.sin(t * 9.4 + i)) * 0.07 : 0;
  out.z = lerp(startZ, clampedZ, charge);
  out.rx = charge > 0.92 && !dropped ? Math.sin(t * 12.4 + i) * 0.16 : 0;
  out.ry = side < 0 ? 0 : Math.PI;
  out.rz = 0;
  crumple(t, new1EnemyDieAt(i), side * 0.22, 0.35 - hash(i, 6), out);
}

const STRIKE = 1.16;

function duelPhase(t: number, friendIndex: number, n: number) {
  const mid = Math.floor((Math.max(1, n) - 1) / 2);
  const shift = friendIndex === mid ? 0.26 : hash(friendIndex, 4) * 0.42;
  return ((Math.max(0, t) + shift) % STRIKE) / STRIKE;
}

function windowBlow(u: number, a: number, b: number) {
  if (u < a || u > b) return 0;
  const x = (u - a) / Math.max(0.05, b - a);
  if (x < 0.28) return -0.55 * (x / 0.28);
  if (x < 0.55) return -0.55 + 1.55 * ((x - 0.28) / 0.27);
  return 1 - (x - 0.55) / 0.45;
}

export function new2FriendDieAt(i: number, n: number) {
  const mid = Math.floor((Math.max(1, n) - 1) / 2);
  if (i === mid) return 8.2;
  return 5.4 + hash(i, 2) * 21.5;
}

export function new2FriendAt(i: number, n: number, recT: number, out: New1Pose) {
  const t = Math.max(0, recT);
  const count = Math.max(1, n);
  const s = friendStand(i, count);
  const dieAt = new2FriendDieAt(i, count);
  const u = duelPhase(t, i, count);
  const mine = windowBlow(u, 0.02, 0.4);
  const front = windowBlow(u, 0.42, 0.74);
  const back = windowBlow(u, 0.76, 1);
  const lunge = Math.max(0, mine) * 0.46;
  const wind = Math.max(0, -mine) * 0.16;
  const shoveF = Math.max(0, front) * 0.22;
  const shoveB = Math.max(0, back) * 0.22;
  const alive = t < dieAt;
  out.x = s.x + (alive ? Math.sin(u * Math.PI * 2) * 0.04 : 0);
  out.y = 0;
  out.z = s.z - lunge + wind + shoveF - shoveB;
  out.rx = alive ? 0.12 + Math.max(0, mine) * 0.82 - Math.max(0, front) * 0.38 - Math.max(0, back) * 0.28 : 0;
  out.ry = alive && u >= 0.76 ? 0.18 : Math.PI - Math.max(0, mine) * 0.22;
  out.rz = alive ? Math.max(0, mine) * 0.16 - Math.max(0, front) * 0.1 : 0;
  crumple(t, dieAt, 0.28, hash(i, 9) - 0.5, out);
}

export function new2EnemyAt(i: number, soldiers: number, recT: number, out: New1Pose) {
  const n = Math.max(1, Math.floor(soldiers));
  const pair = foePair(i, n);
  const target = friendStand(pair.friend, n);
  const t = Math.max(0, recT);
  const side = pair.side;
  const dieAt = new2FriendDieAt(pair.friend, n);
  const dropped = t >= dieAt + 0.22;
  const u = duelPhase(t, pair.friend, n);
  const mine = side < 0 ? windowBlow(u, 0.42, 0.74) : windowBlow(u, 0.76, 1);
  const reach = FIGHT_GAP;
  const push = Math.max(0, mine) * 0.7;
  const wind = Math.max(0, -mine) * 0.26;
  let z = target.z + side * (reach + wind - push);
  if (dropped) z = target.z + side * 0.95;
  if (side < 0) z = Math.min(z, target.z - 0.78);
  else z = Math.max(z, target.z + 0.78);
  out.x = target.x + (pair.friend % 2 === 0 ? 0.12 : -0.12) * (side < 0 ? 1 : -1);
  out.y = 0;
  out.z = z;
  out.rx = dropped ? 0.35 : 0.08 + Math.max(0, mine) * 0.78;
  out.ry = side < 0 ? Math.max(0, mine) * -0.18 : Math.PI + Math.max(0, mine) * 0.18;
  out.rz = Math.max(0, mine) * 0.08;
  crumple(t, new1EnemyDieAt(i), side * 0.16, 0.28 - hash(i, 6), out);
}

export function sampleNew2Cam(recT: number, soldiers: number): ShotPose {
  const n = Math.max(1, soldiers);
  const mid = Math.floor((n - 1) / 2);
  const s = friendStand(mid, n);
  const lx = s.x;
  const lz = s.z - FIGHT_GAP * 0.42;
  const ly = 1.35;
  const t = Math.max(0, recT);
  const hit = t > 0.15 && t < 0.55 ? Math.sin(t * 48) * 0.12 : 0;
  const p = sampleKeys(t, [
    { t: 0, p: pose(lx + 1.15, 3.55, lz + 4.35, lx, ly, lz, 30) },
    { t: 2.6, p: pose(lx - 1.8, 4.2, lz + 4.7, lx + 0.15, ly, lz - 0.1, 32) },
    { t: 5.2, p: pose(lx + 2.4, 11, lz + 12, lx, 1.4, s.z, 36) },
    { t: 10, p: pose(6, 36, 16, 0, 0.9, 0, 42) },
    { t: 16, p: pose(-7, 72, 10, 0, 0.55, 0, 46) },
    { t: 23, p: pose(4, 112, 6, 0, 0.4, 0, 48) },
    { t: 30, p: pose(2, 150, 4, 0, 0.32, 0, 48) },
  ]);
  return { ...p, x: p.x + hit, z: p.z + hit * 0.4 };
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
