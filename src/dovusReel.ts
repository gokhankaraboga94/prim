export const DOVUS_ID = "dovus" as const;
export type DovusId = typeof DOVUS_ID;
export const DOVUS_MODE = { id: DOVUS_ID, label: "dövüş" } as const;
export const DOVUS_SECONDS = 20;
export const DOVUS_HERO = "/models/islelet.glb";
export const DOVUS_RED = "/models/red.glb";
export const DOVUS_URLS = [DOVUS_HERO, DOVUS_RED] as const;

export const DOVUS_FALL = [2.4, 12] as const;

export type DovusCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

export function dovusCam(t: number): DovusCam {
  if (t < 1) return { x: 0.08, y: 1.32, z: -3.2, lx: 0, ly: 1.12, lz: -0.12, fov: 36 };
  if (t < 3.2) return { x: 0, y: 1.8, z: -5.5, lx: 0, ly: 1.02, lz: -0.05, fov: 42 };
  if (t < 12) return { x: 0.4, y: 1.65, z: -5.1, lx: 0.12, ly: 1.02, lz: -0.08, fov: 40 };
  return { x: 0, y: 2.05, z: -6.3, lx: 0, ly: 0.82, lz: 0, fov: 42 };
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function dovusMarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function dovusIsReady() {
  return ready;
}

export function dovusWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function dovusHold() {
  playAt = 0;
}

export function dovusStart() {
  playAt = performance.now() / 1000;
}

export function dovusT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function dovusReset() {
  ready = false;
  playAt = 0;
}

export function isDovus(id: string | null | undefined): id is DovusId {
  return id === DOVUS_ID;
}
