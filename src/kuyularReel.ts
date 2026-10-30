export const KUYULAR_ID = "kuyular" as const;
export type KuyularId = typeof KUYULAR_ID;
export const KUYULAR_MODE = { id: KUYULAR_ID, label: "kuyular" } as const;
export const KUYULAR_SECONDS = 61;
export const KUYULAR_BLUE = "/models/blue.glb";
export const KUYULAR_URLS = [KUYULAR_BLUE] as const;
export const BLUE_N = 70;

const INNER_N = 30;
const OUTER_N = 40;
const INNER_R = 5;
const OUTER_R = 7.8;
const STEP = 0.8;
const OPEN0 = -0.2;

export type Side = "blue";
export type Seat = { x: number; z: number; yaw: number; live: boolean };

type Well = { t: number; x: number; z: number; soldier: number };

export type KuyularHit = { open: number; order: number; stagger: number; well: number };

const hits = new Map<number, KuyularHit>();
let wells: Well[] = [];
let alive = 0;

function ease(u: number) {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
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

function apart(a: number, b: number) {
  const A = blueSeat(a);
  const B = blueSeat(b);
  return Math.hypot(A.x - B.x, A.z - B.z);
}

/** One random soldier stays. The rest drop in an order that jumps across the ring. */
function buildCast() {
  hits.clear();
  alive = Math.floor(Math.random() * BLUE_N);
  const unused: number[] = [];
  for (let i = 0; i < BLUE_N; i++) if (i !== alive) unused.push(i);
  const front = unused.filter((i) => i >= INNER_N).sort((a, b) => blueSeat(a).z - blueSeat(b).z);
  const first = front[Math.floor(Math.random() * Math.min(3, front.length))];
  const order = [first];
  unused.splice(unused.indexOf(first), 1);
  while (unused.length) {
    const prev = order[order.length - 1];
    const ranked = unused.map((i) => ({ i, d: apart(prev, i) })).sort((a, b) => b.d - a.d);
    const band = ranked.slice(0, Math.min(5, ranked.length));
    const pick = band[Math.floor(Math.random() * band.length)].i;
    order.push(pick);
    unused.splice(unused.indexOf(pick), 1);
  }
  wells = order.map((soldier, index) => {
    const seat = blueSeat(soldier);
    return { t: OPEN0 + index * STEP, x: seat.x, z: seat.z, soldier };
  });
  wells.forEach((well, wi) => {
    hits.set(well.soldier, { open: well.t, order: 0, stagger: 0, well: wi });
  });
}

buildCast();

export function kuyularHit(_side: Side, i: number) {
  return hits.get(i) ?? null;
}

export function kuyularFall(side: Side, i: number, t: number) {
  const hit = kuyularHit(side, i);
  if (!hit) return 0;
  if (t < hit.open) return 0;
  return ease((t - hit.open) / 0.72);
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

export function kuyularAlive() {
  return alive;
}

export function kuyularFocus(t: number) {
  let idx = 0;
  for (let i = 0; i < wells.length; i++) {
    if (wells[i].t <= t + 0.02) idx = i;
  }
  const well = wells[idx];
  const last = wells[wells.length - 1];
  const winAt = (last?.t ?? 0) + 0.7;
  if (t >= winAt && last) {
    return { index: alive, prev: last.soldier, u: Math.min(1, (t - winAt) / 0.34), fade: 0 };
  }
  const prev = idx > 0 ? wells[idx - 1].soldier : well.soldier;
  const u = idx === 0 ? 1 : Math.max(0, Math.min(1, (t - well.t) / 0.28));
  return { index: well.soldier, prev, u, fade: 0 };
}

export function kuyularShowPlates(t: number) {
  const last = wells[wells.length - 1]?.t ?? 0;
  return t < last + 0.7;
}

export type KuyularCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u;
}

export function kuyularCam(t: number): KuyularCam {
  const first = wells[0];
  const last = wells[wells.length - 1]?.t ?? 0;
  if (t < 1 && first) return { x: first.x * 0.3, y: 12, z: first.z - 5.2, lx: first.x, ly: 0.6, lz: first.z, fov: 46 };
  const high = t < 3.2 ? { x: 0, y: 30, z: 0.6, lx: 0, ly: 0, lz: 0, fov: 56 } : { x: 0, y: 32, z: 0.4, lx: 0, ly: 0, lz: 0, fov: 58 };
  const start = last + 0.5;
  if (t <= start) return high;
  const seat = blueSeat(alive);
  const span = Math.hypot(seat.x, seat.z) || 1;
  const fx = -seat.x / span;
  const fz = -seat.z / span;
  const close = {
    x: seat.x + fx * 3.15,
    y: 1.12,
    z: seat.z + fz * 3.15,
    lx: seat.x,
    ly: 0.92,
    lz: seat.z,
    fov: 30,
  };
  const u = ease(Math.min(1, (t - start) / 1.35));
  return {
    x: lerp(high.x, close.x, u),
    y: lerp(high.y, close.y, u),
    z: lerp(high.z, close.z, u),
    lx: lerp(high.lx, close.lx, u),
    ly: lerp(high.ly, close.ly, u),
    lz: lerp(high.lz, close.lz, u),
    fov: lerp(high.fov, close.fov, u),
  };
}

export function kuyularWells() {
  return wells.map((well) => ({ ...well, radius: 0.5 }));
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
  buildCast();
}

export function isKuyular(id: string | null | undefined): id is KuyularId {
  return id === KUYULAR_ID;
}
