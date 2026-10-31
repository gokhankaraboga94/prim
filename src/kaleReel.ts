import { castleAxes, castleGrow } from "./castleLayout";

export const KALE_ID = "kale" as const;
export type KaleId = typeof KALE_ID;
export const KALE_MODE = { id: KALE_ID, label: "kale savunması" } as const;
export const KALE_SECONDS = 18;
export const KALE_HERO = "/models/savaci.glb";
export const KALE_ROMAN = "/models/roman.glb";
export const KALE_URLS = [KALE_HERO, KALE_ROMAN] as const;
export const KALE_OURS = 100;
export const KALE_ROMANS = 5000;
export const KALE_PLATE = 3.4;

/** Defensive-stance face at the held frame, atan2(x, z). Chest points +Z when yaw is 0. */
const GUARD = -0.02;

export type KalePost = { x: number; y: number; z: number; yaw: number };
export type KaleCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

type Local = { x: number; y: number; z: number; yaw: number };

function wallH(level: number) {
  return 3.85 + ((((Math.max(1, level) - 1) % 5) + 1) * 0.18);
}

function blocked(x: number, z: number) {
  const blocks = [
    { x: -2.4, z: -2.6, r: 2.5 },
    { x: 4.8, z: -8.8, r: 2.2 },
    { x: -5.6, z: -8.4, r: 1.9 },
    { x: -5.2, z: -5.4, r: 3.2 },
    { x: 1.2, z: -1.2, r: 4.3 },
  ];
  for (const b of blocks) {
    const dx = x - b.x;
    const dz = z - b.z;
    if (dx * dx + dz * dz < b.r * b.r) return true;
  }
  return false;
}

function yard(n: number, yaw: number): Local[] {
  const got: Local[] = [];
  for (let row = 0; row < 16 && got.length < n; row++) {
    for (let col = 0; col < 12 && got.length < n; col++) {
      const x = -8.6 + col * 1.58;
      const z = -10.6 + row * 1.05;
      if (blocked(x, z)) continue;
      got.push({ x, y: 0.16, z, yaw });
    }
  }
  let extra = 0;
  while (got.length < n && extra < n) {
    got.push({ x: -7.5 + (extra % 10) * 1.6, y: 0.16, z: 3.4, yaw });
    extra += 1;
  }
  return got;
}

function line(xs: number[], z: number, y: number, yaw: number): Local[] {
  return xs.map((x) => ({ x, y, z, yaw }));
}

/** 100 posts. Newest roster slots are the gatehouse, facing the army. */
export function kalePosts(level: number): KalePost[] {
  const h = wallH(level);
  const feet = h + 0.12;
  const face = 0 - GUARD;
  const back = Math.PI - GUARD;
  const left = -Math.PI / 2 - GUARD;
  const right = Math.PI / 2 - GUARD;
  const locals: Local[] = [
    ...yard(51, face),
    ...line([-11.2, -8.6, -6.2, -3.8, -1.4, 1.1, 3.4, 5.5], -9.85, feet, left).map((p) => ({ ...p, x: -9.85, z: p.x + 1.3 })),
    ...line([-11.2, -8.6, -6.2, -3.8, -1.4, 1.1, 3.4, 5.5], 9.85, feet, right).map((p) => ({ ...p, x: 9.85, z: p.x + 1.3 })),
    ...line([-8, -6, -4, -2, 0, 2, 4, 6, 8], -12.15, feet, back),
    ...line([-10.2, -8.9, -7.6, -6.3, -5, -3.7], 5.85, feet, face),
    ...line([3.7, 5, 6.3, 7.6, 8.9, 10.2], 5.85, feet, face),
    ...line([-2.4, -1.5, 1.5, 2.4, -0.75, 0], 7.05, h + 2.48, face),
    ...line([-3.2, 3.2, -2.2, 2.2, -1.45, 1.45], 5.85, feet, face),
  ];
  const { sx, sy, sz, zShift } = castleAxes(castleGrow(level));
  return locals.slice(0, KALE_OURS).map((p) => ({
    x: p.x * sx,
    y: p.y * sy,
    z: p.z * sz + zShift,
    yaw: p.yaw,
  }));
}

/** Outer face of the shut gate, world z. Romans stop in front of it. */
export function kaleDoor(level: number) {
  const { sz, zShift } = castleAxes(castleGrow(level));
  return (6.85 + 1.75) * sz + zShift;
}

const COLS = 50;

/** Smooth march onto the gate. Front ranks are already there. Nobody steps through the door. */
export function kaleRoman(i: number, t: number, door: number) {
  const col = i % COLS;
  const rank = (i - col) / COLS;
  const jitter = ((i * 13) % 7) - 3;
  const x = (col - (COLS - 1) / 2) * 1.32 + jitter * 0.05;
  const goal = door + 1.35 + rank * 1.02;
  const extra = Math.max(0, rank - 8) * 2.4;
  const start = goal + extra;
  const dur = 2.2 + Math.max(0, rank - 8) * 0.09;
  const u = extra <= 0 ? 1 : Math.min(1, Math.max(0, t) / dur);
  const press = rank < 18 ? Math.sin(Math.min(1, Math.max(0, (t - 6) / 3)) * Math.PI) * 0.42 : 0;
  return {
    x,
    z: start + (goal - start) * u - press,
    s: 0.94 + (i % 7) * 0.015,
  };
}

export function kaleRoster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-KALE_OURS);
  const out = Array.from({ length: KALE_OURS }, () => "");
  const start = KALE_OURS - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

/**
 * First second: names beside the gate are large, and the front rank is already on the door.
 * Then the view slides across the wall so more names pass, while the column keeps packing.
 */
export function kaleCam(t: number, level: number): KaleCam {
  const door = kaleDoor(level);
  const open = { x: 0, y: 24, z: door + 37, lx: 0, ly: 14, lz: door - 5, fov: 50 };
  if (t < 1) return open;
  const u = Math.min(1, (t - 1) / 14);
  const sway = Math.sin(u * Math.PI);
  return {
    x: open.x + sway * 6,
    y: open.y + sway * 2,
    z: open.z,
    lx: open.lx + sway * 4,
    ly: open.ly,
    lz: open.lz,
    fov: open.fov,
  };
}

/** How hard the doors shudder. Stays under the break threshold so the gate holds. */
export function kaleShake(t: number) {
  const u = Math.min(1, Math.max(0, (t - 6) / 3));
  return Math.sin(u * Math.PI) * 0.07;
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function kaleMarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function kaleIsReady() {
  return ready;
}

export function kaleWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function kaleHold() {
  playAt = 0;
}

export function kaleStart() {
  playAt = performance.now() / 1000;
}

export function kaleT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function kaleReset() {
  ready = false;
  playAt = 0;
}

export function isKale(id: string | null | undefined): id is KaleId {
  return id === KALE_ID;
}
