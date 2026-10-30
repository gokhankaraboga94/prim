export const BASKA_ID = "baska" as const;
export type BaskaId = typeof BASKA_ID;
export const BASKA_MODE = { id: BASKA_ID, label: "başka" } as const;
export const BASKA_SECONDS = 14;
export const BASKA_URL = "/models/blue.glb";
export const BASKA_N = 13;
export const BASKA_CENTER = 12;

const SWING = 2.71;
const HIT = 0.62;

export type BaskaPose = {
  x: number;
  z: number;
  yaw: number;
  rx: number;
  time: number;
  dead: boolean;
};

function unit(i: number) {
  const x = Math.sin(i * 91.7 + 17.3) * 43758.5453;
  return x - Math.floor(x);
}

/** Last joined names sit at the end. The newest name is the one still standing. */
export function baskaRoster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-BASKA_N);
  const out = Array.from({ length: BASKA_N }, () => "");
  const start = BASKA_N - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

function dieAt(i: number) {
  if (i === BASKA_CENTER) return 1e9;
  return 0.85 + Math.floor(i / 3) * 1.7 + unit(i) * 0.28;
}

export function baskaPose(i: number, t: number): BaskaPose {
  if (i === BASKA_CENTER) {
    return { x: 0, z: 0, yaw: Math.PI, rx: 0, time: (t + HIT) % SWING, dead: false };
  }
  const ang = (i / (BASKA_N - 1)) * Math.PI * 2;
  const x = Math.sin(ang) * 2.55;
  const z = Math.cos(ang) * 2.55;
  const yaw = Math.atan2(-x, -z);
  const at = dieAt(i);
  if (t >= at) {
    const u = Math.min(1, (t - at) / 0.65);
    const e = u * u * (3 - 2 * u);
    return { x, z, yaw, rx: e * 1.45, time: 0.04, dead: true };
  }
  const swing = (t + HIT) % SWING;
  return { x, z, yaw, rx: swing > 0.55 && swing < 0.95 ? 0.2 : 0, time: 0.06, dead: false };
}

export type BaskaCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

export function baskaCam(t: number): BaskaCam {
  if (t < 1) return { x: 0.12, y: 1.18, z: -2.15, lx: 0, ly: 1.02, lz: -0.05, fov: 28 };
  if (t < 3.2) return { x: 0.15, y: 6.8, z: -5.1, lx: 0, ly: 0.3, lz: 0.15, fov: 44 };
  if (t < 8) return { x: -2.6, y: 2.35, z: -3.4, lx: 0.15, ly: 1.05, lz: 0.35, fov: 46 };
  return { x: 0.35, y: 2.9, z: -5.4, lx: 0, ly: 1.05, lz: 0, fov: 40 };
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
