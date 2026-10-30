export const BASKA_ID = "baska" as const;
export type BaskaId = typeof BASKA_ID;
export const BASKA_MODE = { id: BASKA_ID, label: "başka" } as const;
export const BASKA_SECONDS = 12;
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

function ease(u: number) {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
}

/** 0–2 face the lens. Each next trio sits further around the circle. */
function ring(i: number, radius: number) {
  const ang = Math.PI + (i - 1) * ((Math.PI * 2) / 12);
  return { x: Math.sin(ang) * radius, z: Math.cos(ang) * radius };
}

function face(i: number) {
  const spot = ring(i, 1);
  return Math.atan2(spot.x, spot.z);
}

function centerYaw(t: number) {
  const keys = [
    { t: 0, yaw: face(1) },
    { t: 2.3, yaw: face(1) },
    { t: 2.65, yaw: face(4) },
    { t: 5.05, yaw: face(4) },
    { t: 5.4, yaw: face(7) },
    { t: 7.65, yaw: face(7) },
    { t: 8.05, yaw: face(10) },
  ];
  let yaw = keys[0].yaw;
  for (let k = 1; k < keys.length; k++) {
    const prev = keys[k - 1];
    const next = keys[k];
    if (t < next.t) {
      const u = (t - prev.t) / Math.max(0.05, next.t - prev.t);
      return prev.yaw + (next.yaw - prev.yaw) * ease(u);
    }
    yaw = next.yaw;
  }
  return yaw;
}

function dieAt(i: number) {
  if (i === BASKA_CENTER) return 1e9;
  const wave = [0.68, 2.82, 5.52, 8.12][Math.floor(i / 3)];
  return wave + unit(i) * 0.16;
}

export function baskaPose(i: number, t: number): BaskaPose {
  if (i === BASKA_CENTER) {
    return { x: 0, z: 0, yaw: centerYaw(t), rx: 0, time: (t + HIT) % SWING, dead: false };
  }
  const at = dieAt(i);
  const rush = i >= 9 ? ease((t - 5.7) / 1.45) : 0;
  const radius = 2.55 - rush * 1.2;
  const spot = ring(i, t >= at ? 2.55 - Math.min(rush, ease((at - 5.7) / 1.45)) * 1.2 : radius);
  const yaw = Math.atan2(-spot.x, -spot.z);
  if (t >= at) {
    const e = ease((t - at) / 0.62);
    const into = i <= 2 ? e * 1.15 : 0;
    return { x: spot.x, z: spot.z - into, yaw, rx: e * 1.45, time: 0.04, dead: true };
  }
  const swing = (t + HIT) % SWING;
  return { x: spot.x, z: spot.z, yaw, rx: swing > 0.55 && swing < 0.95 ? 0.22 : 0, time: 0.06, dead: false };
}

export type BaskaCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

export function baskaCam(t: number): BaskaCam {
  const front = ring(1, 2.55);
  if (t < 1) return { x: front.x + 0.08, y: 1.12, z: front.z - 1.45, lx: 0, ly: 1.05, lz: -0.35, fov: 26 };
  if (t < 3.3) return { x: 3.7, y: 3.15, z: -2.4, lx: 0, ly: 0.7, lz: 0, fov: 42 };
  if (t < 6.4) return { x: -3.3, y: 1.65, z: 1.6, lx: 0.1, ly: 1.0, lz: -0.3, fov: 44 };
  if (t < 9.2) return { x: 0.15, y: 1.4, z: 3.55, lx: 0, ly: 1.0, lz: 0.2, fov: 40 };
  return { x: 0.3, y: 2.35, z: -4.7, lx: 0, ly: 0.85, lz: 0, fov: 38 };
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
