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
  s?: number;
};

export const NEW2_ID = "new2" as const;
export type New2Id = typeof NEW2_ID;
export const NEW2_MODE = { id: NEW2_ID, label: "new2" } as const;
export const NEW2_SECONDS = 30;

export const NEW3_ID = "new3" as const;
export type New3Id = typeof NEW3_ID;
export const NEW3_MODE = { id: NEW3_ID, label: "new3" } as const;
export const NEW3_SECONDS = 30;

export const NEW4_ID = "new4" as const;
export type New4Id = typeof NEW4_ID;
export const NEW4_MODE = { id: NEW4_ID, label: "new4" } as const;
export const NEW4_SECONDS = 30;

export const NEW5_ID = "new5" as const;
export type New5Id = typeof NEW5_ID;
export const NEW5_MODE = { id: NEW5_ID, label: "new5" } as const;
export const NEW5_SECONDS = 30;

export function isNew1(id: string | null | undefined): id is New1Id {
  return id === NEW1_ID;
}

export function isNew2(id: string | null | undefined): id is New2Id {
  return id === NEW2_ID;
}

export function isNew3(id: string | null | undefined): id is New3Id {
  return id === NEW3_ID;
}

export function isNew4(id: string | null | undefined): id is New4Id {
  return id === NEW4_ID;
}

export function isNew5(id: string | null | undefined): id is New5Id {
  return id === NEW5_ID;
}

export function isNewDuel(id: string | null | undefined): id is New2Id | New3Id | New4Id {
  return id === NEW2_ID || id === NEW3_ID || id === NEW4_ID;
}

export function isNewField(id: string | null | undefined): id is New1Id | New2Id | New3Id | New4Id | New5Id {
  return id === NEW1_ID || id === NEW2_ID || id === NEW3_ID || id === NEW4_ID || id === NEW5_ID;
}

export function new1Duration(id: string | null | undefined) {
  return isNew1(id) ? NEW1_SECONDS : 0;
}

const FILE = 2.38;
const RANK = 2.18;
const CHARGE = 4.35;
const CLASH = 4.2;
const FIGHT_GAP = 2.05;
const BODY_GAP = 0.58;

export const NEW2_VISUAL_FRIENDS = 140;

export function new2VisualFriends(soldiers: number) {
  return Math.min(Math.max(1, Math.floor(soldiers)), NEW2_VISUAL_FRIENDS);
}

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
  out.s = 1;
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
  out.s = 1;
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
  const lunge = Math.max(0, mine) * 0.28;
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
  out.s = 1;
  if (t >= dieAt + 1) {
    out.y = -40;
    out.s = 0;
  }
}

let livingAt = -1;
let livingN = -1;
let livingOf: Int32Array | null = null;
let hopTo: Int32Array | null = null;
let hopSX: Float32Array | null = null;
let hopSZ: Float32Array | null = null;
let hopDX: Float32Array | null = null;
let hopDZ: Float32Array | null = null;
let hopStart: Float32Array | null = null;

function livingFocus(friend: number, n: number, t: number) {
  if (livingAt !== t || livingN !== n || !livingOf) {
    livingN = n;
    livingAt = t;
    livingOf = new Int32Array(n);
    const alive: number[] = [];
    for (let k = 0; k < n; k++) if (t < new2FriendDieAt(k, n)) alive.push(k);
    for (let k = 0; k < n; k++) {
      if (t < new2FriendDieAt(k, n)) {
        livingOf[k] = k;
        continue;
      }
      const home = friendStand(k, n);
      let best = -1;
      let bestD = 1e12;
      for (let a = 0; a < alive.length; a++) {
        const j = alive[a];
        const p = friendStand(j, n);
        const d = (p.x - home.x) * (p.x - home.x) + (p.z - home.z) * (p.z - home.z);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      livingOf[k] = best;
    }
  }
  return livingOf[friend];
}

function ensureHop(cap: number) {
  if (hopTo && hopTo.length >= cap) return;
  hopTo = new Int32Array(cap);
  hopTo.fill(-2);
  hopSX = new Float32Array(cap);
  hopSZ = new Float32Array(cap);
  hopDX = new Float32Array(cap);
  hopDZ = new Float32Array(cap);
  hopStart = new Float32Array(cap);
}

export function new2EnemyAt(i: number, soldiers: number, recT: number, out: New1Pose) {
  const n = Math.max(1, Math.floor(soldiers));
  const pair = foePair(i, n);
  const t = Math.max(0, recT);
  const side = pair.side;
  const dieAt = new2FriendDieAt(pair.friend, n);
  const focus = t < dieAt ? pair.friend : livingFocus(pair.friend, n, t);
  const target = friendStand(focus >= 0 ? focus : pair.friend, n);
  const lane = (hash(i, 3) - 0.5) * 0.7;
  const destX = target.x + lane;
  const destZ = target.z + side * FIGHT_GAP;
  ensureHop(Math.max(i + 1, new1EnemyCount(n)));
  const fromId = hopTo![i];
  const prevU = fromId < -1 ? 1 : ease(clamp01((t - hopStart![i]) / 0.7));
  const curX = fromId < -1 ? destX : lerp(hopSX![i], hopDX![i], prevU);
  const curZ = fromId < -1 ? destZ : lerp(hopSZ![i], hopDZ![i], prevU);
  if (fromId !== focus) {
    hopSX![i] = curX;
    hopSZ![i] = curZ;
    hopDX![i] = destX;
    hopDZ![i] = destZ;
    hopStart![i] = fromId < -1 ? t - 2 : t;
    hopTo![i] = focus;
  } else {
    hopDX![i] = destX;
    hopDZ![i] = destZ;
  }
  const step = ease(clamp01((t - hopStart![i]) / 0.7));
  const engaged = focus >= 0 && step > 0.82 && t < new2FriendDieAt(focus, n);
  const u = engaged ? duelPhase(t, focus, n) : 0;
  const mine = engaged ? (side < 0 ? windowBlow(u, 0.42, 0.74) : windowBlow(u, 0.76, 1)) : 0;
  const push = Math.max(0, mine) * 0.28;
  out.x = lerp(hopSX![i], hopDX![i], step);
  out.y = 0;
  out.z = lerp(hopSZ![i], hopDZ![i], step) - side * push;
  if (step > 0.96) {
    if (side < 0) out.z = Math.min(out.z, target.z - 1.22);
    else out.z = Math.max(out.z, target.z + 1.22);
  }
  out.rx = engaged ? 0.08 + Math.max(0, mine) * 0.78 : 0.2;
  out.ry = side < 0 ? Math.max(0, mine) * -0.18 : Math.PI + Math.max(0, mine) * 0.18;
  out.rz = Math.max(0, mine) * 0.08;
  out.s = 1;
  const foeDie = new1EnemyDieAt(i);
  if (t >= foeDie && t < foeDie + 1) {
    out.rx = 0;
    out.y = 0;
  } else if (t >= foeDie + 1) {
    out.y = -40;
    out.s = 0;
  }
}

export function new2AliveCounts(soldiers: number, recT: number) {
  const n = Math.max(0, Math.floor(soldiers));
  const foesN = new1EnemyCount(n);
  const t = Math.max(0, recT);
  let friends = 0;
  for (let i = 0; i < n; i++) if (t < new2FriendDieAt(i, n)) friends++;
  let foes = 0;
  for (let i = 0; i < foesN; i++) if (t < new1EnemyDieAt(i)) foes++;
  return { friends, foes };
}

export function sampleNew2Cam(recT: number, soldiers: number): ShotPose {
  const n = new2VisualFriends(soldiers);
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

export const NEW5_FRIENDS = 21;
const NEW5_LANES = 3;
const NEW5_LANE = 1.15;
const NEW5_RANK = 1.46;
const NEW5_SPEED = 7.4;
const NEW5_FOE_GAP = 1.56;
const NEW5_FOE_START = 14.5;
const NEW5_FOE_ROWS = 155;
export const NEW5_FOES = NEW5_LANES * NEW5_FOE_ROWS;
const NEW5_REACH = 0.42;
const NEW5_LOSE = 21;

function new5FriendDieAt(i: number, count: number) {
  const row = Math.floor(i / NEW5_LANES);
  const rows = Math.max(1, Math.ceil(count / NEW5_LANES));
  return NEW5_LOSE + 0.4 + (row / Math.max(1, rows - 1)) * 6.4 + (i % NEW5_LANES) * 0.12;
}

export function new5VisualFriends(soldiers: number) {
  return Math.min(Math.max(1, Math.floor(soldiers)), NEW5_FRIENDS);
}

function new5Front(t: number) {
  const u = Math.max(0, t);
  if (u <= NEW5_LOSE) return NEW5_SPEED * u;
  const extra = Math.min(u - NEW5_LOSE, 1.2);
  return NEW5_SPEED * NEW5_LOSE + NEW5_SPEED * extra * (1 - extra / 2.4);
}

function new5FoeZ(i: number) {
  return NEW5_FOE_START + Math.floor(i / NEW5_LANES) * NEW5_FOE_GAP;
}

export function new5FriendAt(i: number, n: number, recT: number, out: New1Pose) {
  const count = Math.max(1, Math.min(n, NEW5_FRIENDS));
  const col = i % NEW5_LANES;
  const row = Math.floor(i / NEW5_LANES);
  const t = Math.max(0, recT);
  const dieAt = i < count ? new5FriendDieAt(i, count) : 0;
  const alive = i < count && t < dieAt;
  const moveT = Math.min(t, NEW5_LOSE);
  const front = new5Front(moveT);
  const bob = Math.sin(moveT * 16 + row * 0.65 + col * 1.4);
  const gap = new5FoeZ(Math.floor((front - NEW5_FOE_START) / NEW5_FOE_GAP) * NEW5_LANES) - front;
  const hit = alive && row === 0 && gap > -0.2 && gap < 1.15 ? 1 - gap / 1.15 : 0;
  out.x = (col - (NEW5_LANES - 1) / 2) * NEW5_LANE;
  out.y = alive ? Math.abs(bob) * 0.07 : 0;
  out.z = front - row * NEW5_RANK + Math.max(0, hit) * 0.22;
  out.rx = alive ? 0.42 + bob * 0.1 + Math.max(0, hit) * 0.7 : 0;
  out.ry = 0;
  out.rz = alive ? bob * 0.05 : 0;
  out.s = i < count ? 1 : 0;
  if (i >= count || t >= dieAt + 1) {
    out.y = -40;
    out.s = 0;
  }
}

export function new5EnemyAt(i: number, recT: number, out: New1Pose) {
  const col = i % NEW5_LANES;
  const z = new5FoeZ(i);
  const dead = new5Front(Math.min(recT, NEW5_LOSE)) >= z - NEW5_REACH;
  out.x = (col - (NEW5_LANES - 1) / 2) * NEW5_LANE;
  out.y = dead ? -40 : 0;
  out.z = z;
  out.rx = 0.08;
  out.ry = Math.PI;
  out.rz = 0;
  out.s = dead ? 0 : 1;
}

export function new5AliveCounts(soldiers: number, recT: number) {
  const n = new5VisualFriends(soldiers);
  const t = Math.max(0, recT);
  let friends = 0;
  for (let i = 0; i < n; i++) if (t < new5FriendDieAt(i, n)) friends++;
  const front = new5Front(Math.min(t, NEW5_LOSE));
  let foes = 0;
  for (let row = 0; row < NEW5_FOE_ROWS; row++) {
    if (front < NEW5_FOE_START + row * NEW5_FOE_GAP - NEW5_REACH) foes += NEW5_LANES;
  }
  return { friends, foes };
}

export function sampleNew5Cam(recT: number): ShotPose {
  const t = Math.max(0, recT);
  const front = new5Front(Math.min(t, NEW5_LOSE));
  const bob = Math.sin(t * 16) * 0.05;
  return {
    x: 0.4,
    y: 16.5 + bob,
    z: front - 26,
    lx: 0,
    ly: 1.4,
    lz: front + 4,
    fov: 38,
  };
}
