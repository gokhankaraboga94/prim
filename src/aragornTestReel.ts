export const ARAGORN_ID = "aragorn-test" as const;
export type AragornId = typeof ARAGORN_ID;
export const ARAGORN_MODE = { id: ARAGORN_ID, label: "aragorn test (2)" } as const;
export const ARAGORN_SECONDS = 16;
export const ARAGORN_ISKELET = "/models/islelet.glb";
export const ARAGORN_URLS = [ARAGORN_ISKELET] as const;

export type AragornCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

export function aragornCam(): AragornCam {
  return { x: 0, y: 1.25, z: -6.2, lx: 0, ly: 0.95, lz: 0, fov: 36 };
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function aragornMarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function aragornIsReady() {
  return ready;
}

export function aragornWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function aragornHold() {
  playAt = 0;
}

export function aragornStart() {
  playAt = performance.now() / 1000;
}

export function aragornT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function aragornReset() {
  ready = false;
  playAt = 0;
}

export function isAragorn(id: string | null | undefined): id is AragornId {
  return id === ARAGORN_ID;
}
