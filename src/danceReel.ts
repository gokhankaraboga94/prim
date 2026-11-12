export const DANCE_ID = "dance" as const;
export type DanceId = typeof DANCE_ID;
export const DANCE_MODE = { id: DANCE_ID, label: "dance" } as const;
export const DANCE_SECONDS = 18;
export const DANCE_N = 15;

/** User drops these into public/models (or repo root → copy there). */
export const DANCE_MODELS = [
  "/models/dans1.glb",
  "/models/dans2.glb",
  "/models/dans3.glb",
] as const;

export const DANCE_URLS = [...DANCE_MODELS];

export function isDance(id: string | null | undefined): id is DanceId {
  return id === DANCE_ID;
}

export function danceRoster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-DANCE_N);
  const out = Array.from({ length: DANCE_N }, () => "");
  const start = DANCE_N - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

/** 3 rows × 5 — front row closest to camera. */
export function danceSpot(i: number) {
  const row = Math.floor(i / 5);
  const col = i % 5;
  const x = (col - 2) * 1.55 + (row % 2) * 0.35;
  const z = -row * 1.85;
  return { x, z, yaw: Math.PI };
}

export type DanceCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

/**
 * 0s: group already dancing (motion in frame 1).
 * 1–3s: push in so names read.
 * Then slow sweep across the floor; pull back for the end.
 */
export function danceCam(t: number): DanceCam {
  if (t < 1.1) return { x: 0.2, y: 3.4, z: 9.2, lx: 0, ly: 1.2, lz: -1.4, fov: 42 };
  if (t < 3.2) return { x: 0.1, y: 2.55, z: 7.2, lx: 0, ly: 1.35, lz: -1.2, fov: 38 };
  if (t < 8) {
    const u = (t - 3.2) / 4.8;
    return { x: -3.2 + u * 6.4, y: 2.4, z: 6.4, lx: -1.2 + u * 2.4, ly: 1.4, lz: -1.1, fov: 36 };
  }
  if (t < 13) {
    const u = (t - 8) / 5;
    return { x: 2.4 - u * 2.2, y: 2.2 + u * 0.4, z: 5.6 + u * 1.2, lx: 0.4 - u * 0.4, ly: 1.45, lz: -1.5, fov: 34 };
  }
  return { x: 0.15, y: 3.6, z: 10.2, lx: 0, ly: 1.25, lz: -1.6, fov: 44 };
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function danceMarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function danceIsReady() {
  return ready;
}

export function danceWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function danceHold() {
  playAt = 0;
}

export function danceStart() {
  playAt = performance.now() / 1000;
}

export function danceT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function danceReset() {
  playAt = 0;
  ready = false;
  waiters.length = 0;
}
