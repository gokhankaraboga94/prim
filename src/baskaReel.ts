export const BASKA_ID = "baska" as const;
export type BaskaId = typeof BASKA_ID;
export const BASKA_MODE = { id: BASKA_ID, label: "başka" } as const;
export const BASKA_SECONDS = 12;
export const BASKA_URL = "/models/blue.glb";
export const BASKA_N = 8;

const LAST = BASKA_N - 1;
const DROP = [0.28, 1.35, 2.2, 3.7, 4.85, 6.05, 7.4];

export type BaskaPose = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  rx: number;
  time: number;
  dead: boolean;
};

function ease(u: number) {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
}

export function baskaX(i: number) {
  return (i - 3.5) * 1.9;
}

/** Last joined names sit at the end. The newest name is the one the crack does not reach. */
export function baskaRoster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-BASKA_N);
  const out = Array.from({ length: BASKA_N }, () => "");
  const start = BASKA_N - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

function dropAt(i: number) {
  if (i >= LAST) return 1e9;
  return DROP[i];
}

export function baskaPose(i: number, t: number): BaskaPose {
  const x = baskaX(i);
  if (i === LAST) {
    const stamp = Math.max(0, t - 8.5);
    return { x, y: 0, z: 0, yaw: Math.PI, rx: 0, time: Math.min(1.05, stamp), dead: false };
  }
  const at = dropAt(i);
  if (t < at) return { x, y: 0, z: 0, yaw: Math.PI, rx: 0, time: 0.08, dead: false };
  const e = ease((t - at) / 0.7);
  const into = i === 0 ? e * 1.6 : e * 0.55;
  return { x, y: -e * 2.4, z: -into, yaw: Math.PI, rx: e * 1.35, time: 0.08, dead: e > 0.35 };
}

/** Dark split in the ground. It grows with each fall and stops before the last name. */
export function baskaGap(t: number) {
  let to = baskaX(0) + 0.85;
  for (let i = 0; i < LAST; i++) {
    if (t >= DROP[i]) to = baskaX(i) + 1.15;
  }
  return { from: baskaX(0) - 0.95, to: Math.min(to, baskaX(LAST) - 1.15) };
}

export type BaskaCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

export function baskaCam(t: number): BaskaCam {
  const first = baskaPose(0, t);
  if (t < 1) return { x: first.x, y: 2.4, z: -8.5, lx: first.x, ly: 0.7, lz: 0.2, fov: 42 };
  if (t < 3.2) return { x: 0, y: 8.2, z: -24, lx: 0, ly: 0.5, lz: 0, fov: 48 };
  if (t < 8.2) {
    const i = DROP.findIndex((at) => t < at + 0.7);
    const man = baskaPose(i < 0 ? 6 : i, t);
    return { x: man.x * 0.35, y: 6.4, z: -18, lx: man.x, ly: 0.5, lz: 0, fov: 46 };
  }
  return { x: baskaX(LAST) * 0.25, y: 7.2, z: -20, lx: baskaX(LAST) * 0.4, ly: 0.55, lz: 0, fov: 46 };
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
