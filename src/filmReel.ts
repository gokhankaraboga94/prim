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
const MEET = 8;
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
    const cols = 3;
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    out.x = (col - 1) * 2.2;
    out.z = -row * 1.62;
    out.y = 0.06;
    out.rx = 1.42;
    out.ry = (slot % 3 - 1) * 0.04;
    out.rz = slot % 2 ? 0.1 : -0.08;
    out.s = 1;
    return;
  }
  const r = slot - downN;
  const relief = Math.max(1, count - downN);
  const leftN = Math.ceil(relief / 2);
  const side = r < leftN ? -1 : 1;
  const local = side < 0 ? r : r - leftN;
  const file = 4;
  const col = local % file;
  const row = Math.floor(local / file);
  const startX = side * (22 + row * 0.04);
  const startZ = 2.2 + row * 0.78 + (col % 2) * 0.1;
  const flankX = side * (4.7 + col * 0.12);
  const flankZ = startZ;
  const homeCol = side < 0 ? col : col + file;
  const homeX = (homeCol - 3.5) * 1.02;
  const homeZ = 2.2 + row * 0.78;
  const run = t <= CHARGE ? 0 : ease(Math.min(1, (t - CHARGE) / (MEET - CHARGE)));
  const close = t <= MEET ? 0 : ease(Math.min(1, (t - MEET) / (HOME - MEET)));
  const midX = startX + (flankX - startX) * run;
  const midZ = startZ + (flankZ - startZ) * run;
  out.x = midX + (homeX - midX) * close;
  out.z = midZ + (homeZ - midZ) * close;
  const moving = run < 1 || close < 1;
  const bob = Math.sin(t * 9 + slot);
  out.y = moving ? Math.abs(bob) * 0.05 : 0;
  out.rx = moving ? 0.22 + bob * 0.04 : 0.04;
  const aimX = run < 1 ? flankX : homeX;
  const aimZ = run < 1 ? flankZ : homeZ;
  out.ry = close > 0.94 ? Math.PI : Math.atan2(aimX - out.x, aimZ - out.z || 0.001);
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
