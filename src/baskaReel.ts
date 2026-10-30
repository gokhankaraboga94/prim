export const BASKA_ID = "baska" as const;
export type BaskaId = typeof BASKA_ID;
export const BASKA_MODE = { id: BASKA_ID, label: "başka" } as const;
export const BASKA_SECONDS = 16;
export const BASKA_URL = "/models/knight.glb";

const NAMES_AT = 3.7;
const COLS = 5;
const ROWS = 4;

export type BaskaPose = { x: number; z: number; yaw: number; step: number };

function ease(u: number) {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
}

/** 19 soldiers. The center of the front rank is empty: that is the one who left. */
export function baskaArmyCount() {
  return COLS * ROWS - 1;
}

export function baskaSeat(i: number) {
  let n = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (row === 0 && col === 2) continue;
      if (n === i) return { x: (col - 2) * 1.18, z: row * 1.12, col, row };
      n += 1;
    }
  }
  return { x: 0, z: 0, col: 0, row: 0 };
}

/** The man beside the empty slot. He looks, takes one step, and stops. */
export function baskaNoticer() {
  for (let i = 0; i < baskaArmyCount(); i++) {
    const seat = baskaSeat(i);
    if (seat.row === 0 && seat.col === 3) return i;
  }
  return 0;
}

export function baskaRoster(names: readonly string[]) {
  const trimmed = names.map((name) => name.trim()).filter(Boolean);
  const last = trimmed.length ? trimmed[trimmed.length - 1] : "";
  return last;
}

function leaverZ(t: number) {
  if (t < 1) return -1.85 + (-3.55 - -1.85) * ease(t);
  if (t < 7.5) return -3.55 + (-5.7 - -3.55) * ease((t - 1) / 6.5);
  return -5.7;
}

export function baskaLeaver(t: number): BaskaPose {
  const z = leaverZ(t);
  const turn = t < 7.6 ? 0 : ease((t - 7.6) / 1.8);
  const yaw = Math.PI * (1 - turn);
  return { x: 0, z, yaw, step: 0 };
}

export function baskaMan(i: number, t: number): BaskaPose {
  const seat = baskaSeat(i);
  if (i !== baskaNoticer()) return { x: seat.x, z: seat.z, yaw: 0, step: 0 };
  const look = t < 4 ? 0 : ease((t - 4) / 1.2);
  const step = t < 5.5 ? 0 : ease((t - 5.5) / 1.1);
  return { x: seat.x, z: seat.z - step * 0.72, yaw: look * Math.PI, step };
}

export function baskaNames(t: number) {
  return t >= NAMES_AT;
}

export type BaskaCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

export function baskaCam(t: number): BaskaCam {
  const man = baskaLeaver(t);
  if (t < 1) {
    return { x: 0.06, y: 1.36, z: -4.2, lx: man.x, ly: 1.22, lz: man.z + 0.2, fov: 30 };
  }
  if (t < 3.2) {
    return { x: 0.35, y: 2.35, z: 5.4, lx: 0, ly: 1.15, lz: -2.2, fov: 46 };
  }
  if (t < 8) {
    return { x: 2.15, y: 1.7, z: man.z + 0.15, lx: man.x, ly: 1.2, lz: man.z, fov: 40 };
  }
  if (t < 12) {
    return { x: 2.05, y: 1.72, z: -3.6, lx: 0.1, ly: 1.25, lz: -2.4, fov: 40 };
  }
  return { x: 1.55, y: 1.58, z: -4.35, lx: 0.05, ly: 1.28, lz: -1.4, fov: 36 };
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function baskaMarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function baskaIsReady() {
  return ready;
}

export function baskaWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function baskaHold() {
  playAt = 0;
}

export function baskaStart() {
  playAt = performance.now() / 1000;
}

export function baskaT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function baskaReset() {
  ready = false;
  playAt = 0;
}

export function isBaska(id: string | null | undefined): id is BaskaId {
  return id === BASKA_ID;
}
