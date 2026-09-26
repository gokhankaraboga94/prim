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
export const NEW5_SECONDS = 60;

export const NEW6_ID = "new6" as const;
export type New6Id = typeof NEW6_ID;
export const NEW6_MODE = { id: NEW6_ID, label: "new6" } as const;
export const NEW6_SECONDS = 30;

export const NEW62_ID = "new62" as const;
export type New62Id = typeof NEW62_ID;
export const NEW62_MODE = { id: NEW62_ID, label: "new6/2" } as const;
export const NEW62_SECONDS = 30;

export const NEW7_ID = "new7" as const;
export type New7Id = typeof NEW7_ID;
export const NEW7_MODE = { id: NEW7_ID, label: "new7" } as const;
export const NEW7_SECONDS = 30;

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

export function isNew6(id: string | null | undefined): id is New6Id {
  return id === NEW6_ID;
}

export function isNew62(id: string | null | undefined): id is New62Id {
  return id === NEW62_ID;
}

export function isNew7(id: string | null | undefined): id is New7Id {
  return id === NEW7_ID;
}

export function isNewDuel(id: string | null | undefined): id is New2Id | New3Id | New4Id {
  return id === NEW2_ID || id === NEW3_ID || id === NEW4_ID;
}

export function isNewField(id: string | null | undefined): id is New1Id | New2Id | New3Id | New4Id | New5Id | New6Id | New62Id | New7Id {
  return id === NEW1_ID || id === NEW2_ID || id === NEW3_ID || id === NEW4_ID || id === NEW5_ID || id === NEW6_ID || id === NEW62_ID || id === NEW7_ID;
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

export const NEW5_FRIENDS = 42;
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

function new5Group(i: number) {
  let left = i;
  let g = 0;
  while (left >= 0) {
    const size = g % 2 === 0 ? 3 : 2;
    if (left < size) return g;
    left -= size;
    g += 1;
  }
  return g;
}

function new5FriendDieAt(i: number, count: number) {
  const groups = new5Group(Math.max(0, count - 1)) + 1;
  return NEW5_LOSE + 0.35 + (new5Group(i) / Math.max(1, groups - 1)) * 6.6;
}

export function new5VisualFriends(soldiers: number) {
  return Math.min(Math.max(1, Math.floor(soldiers)), NEW5_FRIENDS);
}

const NEW5_PACK_LOSE = 54;
const NEW5_LANE_GAP = 1.58;
const NEW5_PACK_SPEED = 6.2;

function new5Front(t: number, lose = NEW5_LOSE, speed = NEW5_SPEED) {
  const u = Math.max(0, t);
  if (u <= lose) return speed * u;
  const extra = Math.min(u - lose, 1.2);
  return speed * lose + speed * extra * (1 - extra / 2.4);
}

const NEW5_PACK_GAP = 1.72;

export function new5FoeCount(soldiers: number) {
  return Math.max(1, Math.floor(soldiers)) * 3;
}

function new5FoeZ(i: number, packed = false) {
  return NEW5_FOE_START + Math.floor(i / NEW5_LANES) * (packed ? NEW5_PACK_GAP : NEW5_FOE_GAP);
}

function new5EnemyDieAt(i: number, packed = false) {
  const z = new5FoeZ(i, packed);
  const lose = packed ? NEW5_PACK_LOSE : NEW5_LOSE;
  const reach = packed ? -0.08 : NEW5_REACH;
  const speed = packed ? NEW5_PACK_SPEED : NEW5_SPEED;
  if (new5Front(lose, lose, speed) < z - reach) return 1e9;
  return (z - reach) / speed;
}

const new5QueueDie = new Map<number, Float64Array>();

function new5QueueDieAt(i: number, count: number) {
  const n = Math.max(1, count);
  let table = new5QueueDie.get(n);
  if (!table) {
    const times: number[] = [];
    const foes = n * 3;
    for (let e = 0; e < foes; e++) {
      const at = new5EnemyDieAt(e, true);
      if (at < 1e8) times.push(at);
    }
    times.sort((a, b) => a - b);
    table = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      const mark = k * 2 + 1;
      table[k] = mark < times.length ? times[mark] : 1e9;
    }
    new5QueueDie.set(n, table);
  }
  return i >= 0 && i < table.length ? table[i] : 1e9;
}

function new5LaneAhead(i: number, t: number, count: number) {
  const lane = i % NEW5_LANES;
  let ahead = 0;
  for (let j = lane; j < i; j += NEW5_LANES) {
    if (new5QueueDieAt(j, count) <= t) ahead += 1;
    else break;
  }
  return ahead;
}

export function new5OnScreen(i: number, recT: number, roster = NEW5_FRIENDS) {
  const count = Math.max(1, Math.floor(roster));
  const file = Math.floor(i / NEW5_LANES) - new5LaneAhead(i, Math.max(0, recT), count);
  return file >= 0 && file < NEW5_FRIENDS / NEW5_LANES;
}

export function new5FriendAt(i: number, n: number, recT: number, out: New1Pose, queue = false) {
  const roster = Math.max(1, Math.floor(n));
  const count = queue ? roster : Math.max(1, Math.min(roster, NEW5_FRIENDS));
  const col = queue ? i % NEW5_LANES : i % NEW5_LANES;
  const t = Math.max(0, recT);
  const dieAt = queue ? new5QueueDieAt(i, count) : i < count ? new5FriendDieAt(i, count) : 0;
  const falling = i < count && t >= dieAt && dieAt < 1e8;
  const row = queue ? Math.floor(i / NEW5_LANES) - (falling ? new5LaneAhead(i, dieAt, count) : new5LaneAhead(i, t, count)) : Math.floor(i / NEW5_LANES);
  const alive = i < count && t < dieAt;
  const lose = queue ? NEW5_PACK_LOSE : NEW5_LOSE;
  const moveT = Math.min(falling ? dieAt : t, lose);
  const front = new5Front(moveT, lose, queue ? NEW5_PACK_SPEED : NEW5_SPEED);
  const bob = Math.sin(moveT * 16 + row * 0.65 + col * 1.4);
  const gap = new5FoeZ(Math.floor((front - NEW5_FOE_START) / (queue ? NEW5_PACK_GAP : NEW5_FOE_GAP)) * NEW5_LANES, queue) - front;
  const hit = alive && row === 0 && gap > -0.2 && gap < 1.15 ? 1 - gap / 1.15 : 0;
  out.x = (col - (NEW5_LANES - 1) / 2) * (queue ? NEW5_LANE_GAP : NEW5_LANE);
  out.y = alive ? Math.abs(bob) * 0.07 : 0;
  out.z = front - row * NEW5_RANK + (queue ? -1.15 : Math.max(0, hit) * 0.22);
  out.rx = alive ? 0.42 + bob * 0.1 + Math.max(0, hit) * (queue ? 0.22 : 0.7) : 0;
  out.ry = 0;
  out.rz = alive ? bob * 0.05 : 0;
  out.s = i < count ? 1 : 0;
  if (queue && falling && t < dieAt + 1.5) {
    const u = Math.min(1, (t - dieAt) / 0.42);
    const e = 1 - (1 - u) * (1 - u);
    const dir = col === 0 ? -1 : col === 2 ? 1 : Math.floor(i / NEW5_LANES) % 2 === 0 ? -1 : 1;
    out.x += dir * e * 3.6;
    out.z -= e * 0.9;
    out.rz = dir * e * 1.5;
    out.rx = 0.2 + e * 0.35;
    out.y = Math.sin(u * Math.PI) * 0.9;
    out.s = 1;
  } else if (falling && t < dieAt + 2) {
    const u = Math.min(1, (t - dieAt) / 0.4);
    out.rx = u * 1.45;
    out.y = 0.08;
    out.s = 1;
  } else if (i >= count || t >= dieAt + (queue ? 1.5 : 2)) {
    out.y = -40;
    out.s = 0;
  }
}

export function new5EnemyAt(i: number, recT: number, out: New1Pose, roster = 0) {
  const t = Math.max(0, recT);
  const packed = roster > 0;
  const col = i % NEW5_LANES;
  const z = new5FoeZ(i, packed);
  const dieAt = new5EnemyDieAt(i, packed);
  out.x = (col - (NEW5_LANES - 1) / 2) * (packed ? NEW5_LANE_GAP : NEW5_LANE);
  out.z = z;
  out.ry = Math.PI;
  out.rz = 0;
  out.y = 0;
  out.rx = 0.08;
  out.s = 1;
  if (packed && t >= dieAt && t < dieAt + 1) {
    const u = Math.min(1, (t - dieAt) / 0.42);
    const e = 1 - (1 - u) * (1 - u);
    const dir = col === 0 ? -1 : col === 2 ? 1 : Math.floor(i / NEW5_LANES) % 2 === 0 ? -1 : 1;
    out.x += dir * e * 3.6;
    out.z += e * 0.9;
    out.rz = dir * e * 1.5;
    out.rx = 0.2 + e * 0.35;
    out.y = Math.sin(u * Math.PI) * 0.9;
  } else if (!packed && t >= dieAt && t < dieAt + 1) {
    const u = Math.min(1, (t - dieAt) / 0.4);
    out.rx = u * 1.55;
    out.y = -u * 1.85;
  } else if (t >= dieAt + 1) {
    out.y = -40;
    out.s = 0;
  }
}

export function new5AliveCounts(soldiers: number, recT: number, queue = false) {
  const n = queue ? Math.max(1, Math.floor(soldiers)) : new5VisualFriends(soldiers);
  const t = Math.max(0, recT);
  let friends = 0;
  for (let i = 0; i < n; i++) {
    const dieAt = queue ? new5QueueDieAt(i, n) : new5FriendDieAt(i, n);
    if (t < dieAt) friends++;
  }
  let foes = 0;
  if (queue) {
    const foeN = new5FoeCount(soldiers);
    for (let i = 0; i < foeN; i++) if (t < new5EnemyDieAt(i, true)) foes++;
  } else {
    const front = new5Front(Math.min(t, NEW5_LOSE));
    for (let row = 0; row < NEW5_FOE_ROWS; row++) {
      if (front < NEW5_FOE_START + row * NEW5_FOE_GAP - NEW5_REACH) foes += NEW5_LANES;
    }
  }
  return { friends, foes };
}

export const NEW7_SPAWN = 24;
export const NEW7_SPAWN_AT = 19.6;

export function new7VisualFriends(soldiers: number) {
  return new5VisualFriends(soldiers) + NEW7_SPAWN;
}

export function new7FriendAt(i: number, n: number, recT: number, out: New1Pose) {
  const base = Math.max(0, n - NEW7_SPAWN);
  if (i < base) {
    new5FriendAt(i, base, recT, out);
    return;
  }
  const t = Math.max(0, recT);
  const si = i - base;
  if (t < NEW7_SPAWN_AT) {
    out.x = 0;
    out.y = -40;
    out.z = 0;
    out.rx = 0;
    out.ry = 0;
    out.rz = 0;
    out.s = 0;
    return;
  }
  const col = si % NEW5_LANES;
  const row = Math.floor(si / NEW5_LANES);
  const u = Math.min(1, (t - NEW7_SPAWN_AT) / 1.15);
  const ease = u * u * (3 - 2 * u);
  const front = new5Front(Math.min(t, NEW5_LOSE));
  const back = front - 6 * NEW5_RANK;
  const bob = Math.sin(t * 16 + si);
  out.x = (col - (NEW5_LANES - 1) / 2) * NEW5_LANE;
  out.y = Math.abs(bob) * 0.07;
  out.z = back - 10 + ease * 6 - row * NEW5_RANK;
  out.rx = 0.42 + bob * 0.1;
  out.ry = 0;
  out.rz = bob * 0.05;
  out.s = 1;
}

export function new7AliveCounts(soldiers: number, recT: number) {
  const base = new5AliveCounts(soldiers, recT);
  const extra = Math.max(0, recT) >= NEW7_SPAWN_AT ? NEW7_SPAWN : 0;
  return { friends: base.friends + extra, foes: base.foes };
}

export function sampleNew7Cam(recT: number): ShotPose {
  const cam = sampleNew5Cam(recT);
  return { ...cam, y: cam.y + 11, z: cam.z - 18, fov: 46 };
}

export function sampleNew5Cam(recT: number, pack = false): ShotPose {
  const t = Math.max(0, recT);
  const lose = pack ? NEW5_PACK_LOSE : NEW5_LOSE;
  const front = new5Front(Math.min(t, lose), lose, pack ? NEW5_PACK_SPEED : NEW5_SPEED);
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

export const NEW6_FRIENDS = 100;
const NEW6_RING_N = [16, 22, 28, 34];
export const NEW6_ARCHERS = NEW6_RING_N[0];
export const NEW62_FRIENDS = 150;
const NEW62_RING_N = [24, 33, 42, 51];
export const NEW62_ARCHERS = NEW62_RING_N[0];
const NEW6_RING_R = [2.2, 4.1, 6.0, 8.0];
const NEW6_RING_TW = [0, 0.18, 0.07, 0.28];
const NEW6_ARMS = 4;
const NEW6_LANES = 3;
const NEW6_LANE = 1.15;
const NEW6_GAP = 1.56;
const NEW6_SPEED = 5.6;
const NEW6_RIM = 9.5;
const NEW6_ROWS = 72;
const NEW62_ROWS = 90;
const NEW6_CORE = 12;
const NEW6_REPULSE_ROWS = 40;
const NEW62_REPULSE_ROWS = 50;
export const NEW6_FOES = NEW6_ARMS * NEW6_LANES * NEW6_ROWS;
export const NEW62_FOES = NEW6_ARMS * NEW6_LANES * NEW62_ROWS;

function new6Tune(wide: boolean) {
  return wide
    ? { friends: NEW62_FRIENDS, rings: NEW62_RING_N, rows: NEW62_ROWS, repulse: NEW62_REPULSE_ROWS, foes: NEW62_FOES }
    : { friends: NEW6_FRIENDS, rings: NEW6_RING_N, rows: NEW6_ROWS, repulse: NEW6_REPULSE_ROWS, foes: NEW6_FOES };
}

export function new6VisualFriends(soldiers: number, wide = false) {
  return Math.min(Math.max(1, Math.floor(soldiers)), new6Tune(wide).friends);
}

function new6Group(i: number) {
  let left = i;
  let g = 0;
  while (left >= 0) {
    const size = g % 2 === 0 ? 3 : 2;
    if (left < size) return g;
    left -= size;
    g += 1;
  }
  return g;
}

function new6Rings(count: number, wide = false) {
  const rings: { start: number; n: number; r: number; twist: number }[] = [];
  const table = new6Tune(wide).rings;
  let left = count;
  let start = 0;
  for (let r = 0; r < table.length && left > 0; r++) {
    const n = r === table.length - 1 ? left : Math.min(table[r], left);
    rings.push({ start, n, r: NEW6_RING_R[r], twist: NEW6_RING_TW[r] });
    start += n;
    left -= n;
  }
  return rings;
}

function new6DeathRank(i: number, count: number, wide = false) {
  const rings = new6Rings(count, wide);
  let rank = 0;
  for (let r = rings.length - 1; r >= 0; r--) {
    const ring = rings[r];
    if (i >= ring.start && i < ring.start + ring.n) return rank + (i - ring.start);
    rank += ring.n;
  }
  return Math.max(0, count - 1);
}

function new6FriendDieAt(i: number, count: number, wide = false) {
  const rank = new6DeathRank(i, count, wide);
  const core = Math.min(NEW6_CORE, count);
  const trickle = count - core;
  if (rank >= trickle) return 25.2;
  const groups = new6Group(Math.max(0, trickle - 1)) + 1;
  return 0.9 + (new6Group(rank) / Math.max(1, groups - 1)) * 21;
}

export function new6SwordPitch(i: number, recT: number, fallen: boolean) {
  if (fallen) return 0;
  const t = Math.max(0, recT);
  return Math.max(0, Math.sin(t * 7 + i * 1.7)) * 0.95;
}

function new6OnArm(dist: number, lane: number, arm: number) {
  const ang = arm * (Math.PI / 2);
  const side = (lane - 1) * NEW6_LANE;
  return {
    x: Math.sin(ang) * dist + Math.cos(ang) * side,
    z: Math.cos(ang) * dist - Math.sin(ang) * side,
    ry: ang + Math.PI,
  };
}

function new6EnemyParts(i: number, wide = false) {
  const per = NEW6_LANES * new6Tune(wide).rows;
  const arm = Math.floor(i / per);
  const local = i % per;
  return { arm, lane: local % NEW6_LANES, row: Math.floor(local / NEW6_LANES) };
}

const new6ThinCache = new Map<string, number>();
const new6LateCache = new Map<string, number[]>();

function new6ThinAt(limit: number, wide = false) {
  const key = `${wide ? 1 : 0}:${limit}`;
  const cached = new6ThinCache.get(key);
  if (cached != null) return cached;
  const count = new6Tune(wide).friends;
  const times: number[] = [];
  for (let i = 0; i < count; i++) times.push(new6FriendDieAt(i, count, wide));
  times.sort((a, b) => a - b);
  let alive = count;
  for (let i = 0; i < times.length; ) {
    const t = times[i];
    while (i < times.length && times[i] === t) {
      alive -= 1;
      i += 1;
    }
    if (alive <= limit) {
      new6ThinCache.set(key, t);
      return t;
    }
  }
  new6ThinCache.set(key, 1e9);
  return 1e9;
}

function new6EnemyDieAt(i: number, wide = false) {
  const tune = new6Tune(wide);
  const { row } = new6EnemyParts(i, wide);
  if (row >= tune.repulse) return 1e9;
  const scheduled = 0.45 + (row / (tune.repulse - 1)) * 26;
  const under20 = new6ThinAt(19, wide);
  const at10 = new6ThinAt(10, wide);
  if (scheduled >= at10 || scheduled >= 18) return 1e9;
  if (scheduled < under20) return scheduled;
  const late = new6LatePair(wide);
  return late[0] === i || late[1] === i ? scheduled : 1e9;
}

function new6LatePair(wide = false) {
  const key = wide ? "w" : "n";
  const cached = new6LateCache.get(key);
  if (cached) return cached;
  const tune = new6Tune(wide);
  const under20 = new6ThinAt(19, wide);
  const at10 = new6ThinAt(10, wide);
  const pick: number[] = [];
  for (let i = 0; i < tune.foes && pick.length < 2; i++) {
    const { row } = new6EnemyParts(i, wide);
    if (row >= tune.repulse) continue;
    const scheduled = 0.45 + (row / (tune.repulse - 1)) * 26;
    if (scheduled >= under20 && scheduled < at10 && scheduled < 18) pick.push(i);
  }
  new6LateCache.set(key, pick);
  return pick;
}

export function new6FriendAt(i: number, n: number, recT: number, out: New1Pose, wide = false) {
  const count = Math.max(1, Math.min(n, new6Tune(wide).friends));
  const t = Math.max(0, recT);
  const dieAt = i < count ? new6FriendDieAt(i, count, wide) : 0;
  const rings = new6Rings(count, wide);
  const ring = rings.find((item) => i >= item.start && i < item.start + item.n) ?? rings[rings.length - 1];
  const ang = ((i - ring.start) / Math.max(1, ring.n)) * Math.PI * 2 + ring.twist;
  const rad = ring.r;
  out.x = Math.sin(ang) * rad;
  out.z = Math.cos(ang) * rad;
  out.y = 0;
  out.rx = 0;
  out.ry = ang;
  out.rz = 0;
  out.s = i < count ? 1 : 0;
  if (i < count && t >= dieAt && t < dieAt + 2) {
    const u = Math.min(1, (t - dieAt) / 0.4);
    out.rx = u * 1.45;
    out.y = 0.08;
    out.s = 1;
  } else if (i >= count || t >= dieAt + 2) {
    out.y = -40;
    out.s = 0;
  }
}

export function new6EnemyAt(i: number, recT: number, out: New1Pose, wide = false) {
  const t = Math.max(0, recT);
  const { arm, lane, row } = new6EnemyParts(i, wide);
  const hitAt = new6EnemyDieAt(i, wide);
  const killed = hitAt < 1e8 && t >= hitAt;
  const travel = NEW6_SPEED * (killed ? hitAt : t);
  const dist = NEW6_RIM + row * NEW6_GAP - travel;
  const slot = row * NEW6_LANES + lane;
  const u = (slot * 0.61803398875) % 1;
  const ang = arm * (Math.PI / 2) + (u - 0.5) * (Math.PI / 2);
  const close = Math.min(1, Math.max(0, (t - 12) / 4));
  const farRad = NEW6_RIM - 0.15 + lane * 0.38;
  const nearRad = 6.55 + lane * 0.28;
  const rad = farRad + (nearRad - farRad) * close;
  const armPos = new6OnArm(Math.max(NEW6_RIM, dist), lane, arm);
  const circle = {
    x: Math.sin(ang) * rad,
    z: Math.cos(ang) * rad,
    ry: ang + Math.PI,
  };
  const blend = dist > NEW6_RIM ? close : 1;
  const p = {
    x: armPos.x + (circle.x - armPos.x) * blend,
    z: armPos.z + (circle.z - armPos.z) * blend,
    ry: armPos.ry + (circle.ry - armPos.ry) * blend,
  };
  const onRing = dist <= NEW6_RIM;
  const bob = onRing ? 0 : Math.sin(t * 14 + row + lane);
  out.x = p.x;
  out.z = p.z;
  out.ry = p.ry;
  out.rz = 0;
  out.y = onRing ? 0 : Math.abs(bob) * 0.05;
  out.rx = onRing ? 0 : 0.28 + bob * 0.08;
  out.s = 1;
  if (killed && t < hitAt + 1) {
    const u = Math.min(1, (t - hitAt) / 0.35);
    out.rx = u * 1.45;
    out.y = 0.08;
  } else if (killed) {
    out.y = -40;
    out.s = 0;
  }
}

export function new6AliveCounts(soldiers: number, recT: number, wide = false) {
  const n = new6VisualFriends(soldiers, wide);
  const t = Math.max(0, recT);
  let friends = 0;
  for (let i = 0; i < n; i++) if (t < new6FriendDieAt(i, n, wide)) friends++;
  let foes = 0;
  const foeCount = new6Tune(wide).foes;
  for (let i = 0; i < foeCount; i++) {
    if (t < new6EnemyDieAt(i, wide)) foes++;
  }
  return { friends, foes };
}

export function sampleNew62Cam(recT: number): ShotPose {
  const cam = sampleNew6Cam(recT);
  const pull = 1.28;
  return { ...cam, x: cam.x * pull, y: cam.y * pull, z: cam.z * pull };
}

export function sampleNew6Cam(recT: number): ShotPose {
  const t = Math.max(0, recT);
  const u = t <= 1.5 ? 0 : Math.min(1, (t - 1.5) / 26.5);
  const e = u * u * (3 - 2 * u);
  const dist = 54 * (1 + e * 0.55);
  return {
    x: (14 / 38.26) * dist,
    y: (28 / 38.26) * dist,
    z: (22 / 38.26) * dist,
    lx: 0,
    ly: 1.2,
    lz: 0,
    fov: 42,
  };
}
