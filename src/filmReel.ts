import type { ShotPose } from "./shotModes";
import type { New1Pose } from "./new1Reel";

export const FILM_ID = "film" as const;
export type FilmId = typeof FILM_ID;
export const FILM_MODE = { id: FILM_ID, label: "film" } as const;

export function isFilm(id: string | null | undefined): id is FilmId {
  return id === FILM_ID;
}

export const FILM_SECONDS = 45;
export const FILM_DOWN = 18;
export const FILM_RELIEF = 150;
export const FILM_FOES = 100;

const CHARGE = 3;
const HOME = 22;
const FOE_FROM = 8.4;
const FOE_TO = 22.5;
const COLS = 6;

type Plan = { die: Float64Array };

let foePlan: Plan | null = null;

function ease(u: number) {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
}

export function filmRoster(names: string[], cap: number): number[] {
  const limit = Math.max(0, Math.floor(cap));
  const down: number[] = [];
  for (let i = limit - 1; i >= 0 && down.length < FILM_DOWN; i--) {
    if (String(names[i] || "").trim()) down.push(i);
  }
  down.reverse();
  for (let i = limit - 1; i >= 0 && down.length < Math.min(FILM_DOWN, limit); i--) {
    if (!down.includes(i)) down.push(i);
  }
  const used = new Set(down);
  const relief: number[] = [];
  for (let i = 0; i < limit && relief.length < FILM_RELIEF; i++) {
    if (used.has(i)) continue;
    relief.push(i);
  }
  return [...down, ...relief];
}

export function filmDownCount(n: number) {
  return Math.min(FILM_DOWN, Math.max(0, Math.floor(n)));
}

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const FALLEN: Array<[number, number, number, number, number]> = [
  [-0.08, -5.76, 1.28, 1.58, 0.19],
  [1.34, -6.5, 1.41, 0.5, -0.29],
  [2.76, -5.42, 1.3, -0.22, -0.04],
  [1.07, 0.57, 1.32, -1.05, 0.06],
  [0.47, -3.91, 1.31, -0.69, -0.04],
  [2.89, -2.66, 1.38, 0.33, 0.23],
  [-2.61, -1.61, 1.33, -0.38, -0.11],
  [-2.48, -4.61, 1.45, -0.57, -0.31],
  [-0.95, -3.57, 1.31, 0.11, 0.08],
  [-1.84, -2.61, 1.39, 0.47, 0.27],
  [0.07, -1.68, 1.35, 0.89, 0.25],
  [-1.03, -0.74, 1.31, -0.39, 0.29],
  [-1.72, -6.07, 1.39, -0.76, 0.27],
  [2.7, -0.62, 1.29, -0.75, 0.22],
  [1.96, -3.96, 1.48, 1.54, 0.09],
  [-1.37, 0.49, 1.45, 0.54, -0.21],
  [1.45, -2.68, 1.26, -0.24, 0.04],
  [-0.85, -4.83, 1.24, 0.41, -0.11],
];

function foeCell(i: number) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return {
    x: (col - (COLS - 1) / 2) * 1.02,
    z: 2.45 + row * 0.82,
    row,
  };
}

function foeDeaths(): Plan {
  if (foePlan) return foePlan;
  const order = Array.from({ length: FILM_FOES }, (_, i) => i);
  order.sort((a, b) => foeCell(a).row - foeCell(b).row || a - b);
  const batches: number[] = [];
  let left = FILM_FOES;
  let swing = 0;
  while (left > 0) {
    let batch = 8 + ((swing * 3) % 5);
    if (left <= 12) batch = left;
    else if (left - batch < 8) batch = left - 8;
    batch = Math.max(1, Math.min(batch, left));
    batches.push(batch);
    left -= batch;
    swing += 1;
  }
  const period = batches.length <= 1 ? 1 : (FOE_TO - FOE_FROM) / (batches.length - 1);
  const die = new Float64Array(FILM_FOES);
  let cursor = 0;
  batches.forEach((batch, index) => {
    const t = FOE_FROM + index * period;
    for (let k = 0; k < batch; k++) die[order[cursor++]] = t;
  });
  foePlan = { die };
  return foePlan;
}

export function filmFriendAt(slot: number, n: number, recT: number, out: New1Pose) {
  const count = Math.max(0, Math.floor(n));
  const t = Math.max(0, recT);
  const downN = filmDownCount(count);
  if (slot < 0 || slot >= count) {
    out.x = 0;
    out.y = -40;
    out.z = 0;
    out.rx = 0;
    out.ry = 0;
    out.rz = 0;
    out.s = 0;
    return;
  }
  if (slot < downN) {
    const pose = FALLEN[slot] ?? FALLEN[0];
    out.x = pose[0];
    out.z = pose[1];
    out.y = 0.06;
    out.rx = pose[2];
    out.ry = pose[3];
    out.rz = pose[4];
    out.s = 1;
    return;
  }
  const r = slot - downN;
  const relief = Math.max(1, count - downN);
  const h1 = hash(r * 3 + 1);
  const h2 = hash(r * 5 + 9);
  const h3 = hash(r * 7 + 17);
  const u = Math.max(0, Math.min(1, (r + 0.37 + (h1 - 0.5) * 0.7) / relief));
  const ang = -1.18 + u * 2.36 + (h2 - 0.5) * 0.1;
  const wing = ang >= 0 ? 1 : -1;
  const mag = 0.62 + (Math.abs(ang) / 1.18) * 0.7;
  const startA = wing * mag;
  const startR = 18 + h1 * 9;
  const startX = Math.sin(startA) * startR;
  const startZ = -1 + h2 * 14 + (1 - Math.cos(startA)) * 4;
  const band = h3;
  const homeR = 3.2 + band * 6.4;
  const homeX = Math.sin(ang) * homeR * (0.88 + h1 * 0.2);
  const homeZ = Math.max(1.35, 1.7 + (1 - Math.cos(ang)) * (2.1 + band * 3.2) + (h2 - 0.5) * 0.85);
  const depart = CHARGE + h1 * 1.15;
  const arrive = HOME - h2 * 2.4;
  const run = t <= depart ? 0 : ease(Math.min(1, (t - depart) / Math.max(0.8, arrive - depart)));
  out.x = startX + (homeX - startX) * run;
  out.z = startZ + (homeZ - startZ) * run;
  const moving = run < 1;
  const bob = Math.sin(t * 9 + slot);
  out.y = moving ? Math.abs(bob) * 0.05 : 0;
  out.rx = moving ? 0.22 + bob * 0.04 : 0.04;
  out.ry = run > 0.97 ? Math.atan2(-out.x, -2.2 - out.z) : Math.atan2(homeX - startX, homeZ - startZ);
  out.rz = 0;
  out.s = 1;
}

export function filmFoeAt(i: number, recT: number, out: New1Pose) {
  const t = Math.max(0, recT);
  if (i < 0 || i >= FILM_FOES) {
    out.x = 0;
    out.y = -40;
    out.z = 0;
    out.rx = 0;
    out.ry = 0;
    out.rz = 0;
    out.s = 0;
    return;
  }
  const cell = foeCell(i);
  const dieAt = foeDeaths().die[i];
  out.ry = Math.PI;
  out.rz = 0;
  if (t < dieAt) {
    out.x = cell.x;
    out.z = cell.z;
    out.y = 0;
    out.rx = 0;
    out.s = 1;
    return;
  }
  const age = t - dieAt;
  if (age > 1.4) {
    out.x = cell.x;
    out.z = cell.z;
    out.y = -40;
    out.rx = 1.4;
    out.s = 0;
    return;
  }
  const u = Math.min(1, age / 0.45);
  out.x = cell.x;
  out.z = cell.z;
  out.y = 0.05;
  out.rx = u * 1.4;
  out.s = 1;
}

function mixPose(a: ShotPose, b: ShotPose, u: number): ShotPose {
  const e = ease(u);
  return {
    x: a.x + (b.x - a.x) * e,
    y: a.y + (b.y - a.y) * e,
    z: a.z + (b.z - a.z) * e,
    lx: a.lx + (b.lx - a.lx) * e,
    ly: a.ly + (b.ly - a.ly) * e,
    lz: a.lz + (b.lz - a.lz) * e,
    fov: a.fov + (b.fov - a.fov) * e,
  };
}

export function sampleFilmCam(recT: number): ShotPose {
  const t = Math.max(0, recT);
  const open: ShotPose = { x: 0, y: 13, z: -19, lx: 0, ly: 0.7, lz: 1.5, fov: 46 };
  const wide: ShotPose = { x: 0, y: 34, z: -50, lx: 0, ly: 1.2, lz: 6, fov: 56 };
  const end: ShotPose = { x: -0.4, y: 13.2, z: -19.2, lx: 0, ly: 0.75, lz: 2.2, fov: 46 };
  if (t <= 2.15) return open;
  if (t < 7.2) return mixPose(open, wide, (t - 2.15) / 5.05);
  if (t < 27) return wide;
  if (t < 36) return mixPose(wide, end, (t - 27) / 9);
  return end;
}
