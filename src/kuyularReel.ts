export const KUYULAR_ID = "kuyular" as const;
export type KuyularId = typeof KUYULAR_ID;
export const KUYULAR_MODE = { id: KUYULAR_ID, label: "kuyular" } as const;
export const KUYULAR_SECONDS = 42;
export const KUYULAR_BLUE = "/models/blue.glb";
export const KUYULAR_URLS = [KUYULAR_BLUE] as const;
export const BLUE_N = 100;

const INNER_N = 40;
const OUTER_N = 60;
const INNER_R = 6.6;
const OUTER_R = 10.2;

export type Side = "blue";
export type Seat = { x: number; z: number; yaw: number; live: boolean };

type Well = { t: number; x: number; z: number; soldier: number };

/** One soldier per hole. Steps are around the ring from the front; negatives wrap. */
const PLAN: { t: number; outer: boolean; steps: number }[] = [
  { t: -0.22, outer: true, steps: -2 },
  { t: 1.4, outer: false, steps: 20 },
  { t: 3.7, outer: true, steps: 18 },
  { t: 6.0, outer: false, steps: -8 },
  { t: 8.4, outer: true, steps: -22 },
  { t: 10.8, outer: false, steps: 6 },
  { t: 13.2, outer: true, steps: 32 },
  { t: 15.6, outer: false, steps: 2 },
  { t: 18.0, outer: true, steps: -30 },
  { t: 20.4, outer: false, steps: 0 },
  { t: 22.8, outer: true, steps: -12 },
  { t: 25.2, outer: false, steps: 12 },
  { t: 27.6, outer: true, steps: -15 },
  { t: 30.0, outer: false, steps: 8 },
  { t: 32.4, outer: true, steps: -16 },
  { t: 34.8, outer: false, steps: 16 },
  { t: 37.2, outer: true, steps: 12 },
];

export type KuyularHit = { open: number; order: number; stagger: number; well: number };

const hits = new Map<number, KuyularHit>();

function ease(u: number) {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
}

function wrap(k: number, n: number) {
  return ((k % n) + n) % n;
}

function soldierIndex(outer: boolean, steps: number) {
  if (outer) return INNER_N + wrap(OUTER_N - 1 + steps, OUTER_N);
  return wrap(Math.floor(INNER_N / 2) + steps, INNER_N);
}

export function blueSeat(i: number): Seat {
  const outer = i >= INNER_N;
  const n = outer ? OUTER_N : INNER_N;
  const k = outer ? i - INNER_N : i;
  const front = outer ? OUTER_N - 1 : Math.floor(INNER_N / 2);
  const stagger = outer ? 0 : 0.5;
  const angle = Math.PI + ((k - front + stagger) * Math.PI * 2) / n;
  const r = outer ? OUTER_R : INNER_R;
  const x = Math.sin(angle) * r;
  const z = Math.cos(angle) * r;
  return { x, z, yaw: Math.atan2(-x, -z), live: false };
}

const WELLS: Well[] = PLAN.map((step) => {
  const soldier = soldierIndex(step.outer, step.steps);
  const seat = blueSeat(soldier);
  return { t: step.t, x: seat.x, z: seat.z, soldier };
});

function buildHits() {
  const used = new Set<number>();
  WELLS.forEach((well, wi) => {
    if (used.has(well.soldier)) return;
    used.add(well.soldier);
    hits.set(well.soldier, { open: well.t, order: 0, stagger: 0, well: wi });
  });
}

buildHits();

export function kuyularHit(_side: Side, i: number) {
  return hits.get(i) ?? null;
}

export function kuyularFall(side: Side, i: number, t: number) {
  const hit = kuyularHit(side, i);
  if (!hit) return 0;
  if (t < hit.open) return 0;
  return ease((t - hit.open) / 0.78);
}

export function kuyularRoster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-BLUE_N);
  const out = Array.from({ length: BLUE_N }, () => "");
  const start = BLUE_N - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

export function kuyularNamed(_i: number) {
  return true;
}

export type KuyularCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

function focusWell(t: number) {
  let well = WELLS[0];
  for (const next of WELLS) {
    if (next.t <= t + 0.45) well = next;
  }
  return well;
}

export function kuyularCam(t: number): KuyularCam {
  const well = focusWell(t);
  const i = WELLS.indexOf(well);
  if (t < 1) return { x: well.x * 0.35, y: 14, z: well.z - 6, lx: well.x * 0.5, ly: 0.7, lz: well.z, fov: 50 };
  if (t < 3.2 || t > 39.2) return { x: 0, y: 36, z: 1.2, lx: 0, ly: 0, lz: 0, fov: 62 };
  if (i % 2 === 0) return { x: well.x * 0.3, y: 18, z: well.z - 4.2, lx: well.x, ly: 0.2, lz: well.z, fov: 46 };
  return { x: well.x * 0.15, y: 11, z: well.z - 2.8, lx: well.x, ly: 0.45, lz: well.z, fov: 40 };
}

export function kuyularWells() {
  return WELLS.map((well) => ({ ...well, radius: 0.55 }));
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function kuyularMarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function kuyularIsReady() {
  return ready;
}

export function kuyularWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function kuyularHold() {
  playAt = 0;
}

export function kuyularStart() {
  playAt = performance.now() / 1000;
}

export function kuyularT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function kuyularReset() {
  ready = false;
  playAt = 0;
}

export function isKuyular(id: string | null | undefined): id is KuyularId {
  return id === KUYULAR_ID;
}
