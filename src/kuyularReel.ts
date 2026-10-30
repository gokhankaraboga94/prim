export const KUYULAR_ID = "kuyular" as const;
export type KuyularId = typeof KUYULAR_ID;
export const KUYULAR_MODE = { id: KUYULAR_ID, label: "kuyular" } as const;
export const KUYULAR_SECONDS = 48;
export const KUYULAR_BLUE = "/models/blue.glb";
export const KUYULAR_RED = "/models/red.glb";
export const KUYULAR_URLS = [KUYULAR_BLUE, KUYULAR_RED] as const;
export const BLUE_N = 200;
export const RED_N = 300;

export type Side = "blue" | "red";
export type Seat = { x: number; z: number; yaw: number; live: boolean };

type Well = {
  t: number;
  x: number;
  z: number;
  n: number;
  side: Side | "both";
  stagger: number;
  reach: number;
};

/** Circles on the field. Negative open time means the first hole is already eating at frame 0. */
const WELLS: Well[] = [
  { t: -0.22, x: 0.2, z: -0.9, n: 5, side: "blue", stagger: 0, reach: 2.4 },
  { t: 1.35, x: 0.4, z: 1.15, n: 1, side: "red", stagger: 0, reach: 2.2 },
  { t: 4.6, x: -4.2, z: -3.4, n: 10, side: "blue", stagger: 0.16, reach: 4.2 },
  { t: 9.2, x: 4.6, z: 3.8, n: 5, side: "red", stagger: 0, reach: 3.2 },
  { t: 13.5, x: 0.1, z: -6.2, n: 1, side: "blue", stagger: 0, reach: 2.4 },
  { t: 18, x: -3.4, z: 6.4, n: 10, side: "red", stagger: 0.14, reach: 4.4 },
  { t: 23, x: 3.8, z: -4.8, n: 5, side: "blue", stagger: 0.18, reach: 3.4 },
  { t: 28, x: 0, z: 8.2, n: 1, side: "red", stagger: 0, reach: 2.6 },
  { t: 33, x: -1.2, z: 0.15, n: 10, side: "both", stagger: 0.1, reach: 3.6 },
  { t: 38.5, x: 2.2, z: -8.4, n: 5, side: "blue", stagger: 0, reach: 3.2 },
  { t: 43, x: -0.4, z: 2.4, n: 10, side: "red", stagger: 0, reach: 4 },
];

export type KuyularHit = { open: number; order: number; stagger: number; well: number };

const hits = new Map<string, KuyularHit>();

function ease(u: number) {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
}

const FRONT = [5, 6, 4, 7, 3, 8, 2, 9, 1, 10, 0, 11];

export function blueSeat(i: number): Seat {
  const front = BLUE_N - 1 - i;
  if (front < 12) return { x: (FRONT[front] - 5.5) * 1.12, z: -0.82, yaw: 0, live: true };
  const k = front - 12;
  const col = k % 10;
  const row = Math.floor(k / 10);
  return { x: (col - 4.5) * 1.32, z: -2.35 - row * 1.18, yaw: 0, live: false };
}

export function redSeat(i: number): Seat {
  if (i < 12) return { x: (i - 5.5) * 1.12, z: 0.95, yaw: Math.PI, live: true };
  const k = i - 12;
  const col = k % 15;
  const row = Math.floor(k / 15);
  return { x: (col - 7) * 1.18, z: 2.45 + row * 1.12, yaw: Math.PI, live: false };
}

function seatOf(side: Side, i: number) {
  return side === "blue" ? blueSeat(i) : redSeat(i);
}

function buildHits() {
  const used = new Set<string>();
  WELLS.forEach((well, wi) => {
    const pool: { side: Side; i: number; d: number }[] = [];
    const consider = (side: Side, n: number) => {
      if (well.side !== "both" && well.side !== side) return;
      for (let i = 0; i < n; i++) {
        const s = seatOf(side, i);
        const dx = s.x - well.x;
        const dz = s.z - well.z;
        pool.push({ side, i, d: dx * dx + dz * dz });
      }
    };
    consider("blue", BLUE_N);
    consider("red", RED_N);
    pool.sort((a, b) => a.d - b.d);
    let got = 0;
    for (const man of pool) {
      if (got >= well.n) break;
      if (man.d > well.reach * well.reach) break;
      const id = `${man.side}:${man.i}`;
      if (used.has(id)) continue;
      used.add(id);
      hits.set(id, { open: well.t, order: got, stagger: well.stagger, well: wi });
      got += 1;
    }
  });
}

buildHits();

export function kuyularHit(side: Side, i: number) {
  return hits.get(`${side}:${i}`) ?? null;
}

export function kuyularFall(side: Side, i: number, t: number) {
  const hit = kuyularHit(side, i);
  if (!hit) return 0;
  const at = hit.open + hit.order * hit.stagger;
  if (t < at) return 0;
  return ease((t - at) / 0.78);
}

export function kuyularRoster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-BLUE_N);
  const out = Array.from({ length: BLUE_N }, () => "");
  const start = BLUE_N - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

export function kuyularNamed(i: number) {
  const seat = blueSeat(i);
  if (seat.live || seat.z > -4.2) return true;
  return kuyularHit("blue", i) != null;
}

export type KuyularCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

function focusWell(t: number) {
  let well = WELLS[0];
  for (const next of WELLS) {
    if (t + 0.35 >= next.t) well = next;
  }
  return well;
}

export function kuyularCam(t: number): KuyularCam {
  const well = focusWell(t);
  if (t < 1) return { x: well.x, y: 2.8, z: well.z - 5.6, lx: well.x, ly: 0.35, lz: well.z, fov: 40 };
  if (t < 3.2) return { x: 0, y: 7.4, z: -13.5, lx: 0, ly: 0.4, lz: 0.2, fov: 48 };
  return { x: well.x * 0.35, y: 6.6, z: well.z - 11.5, lx: well.x, ly: 0.3, lz: well.z, fov: 46 };
}

export function kuyularWells() {
  return WELLS.map((well) => ({ ...well, radius: well.n >= 10 ? 2.35 : well.n >= 5 ? 1.6 : 0.9 }));
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
