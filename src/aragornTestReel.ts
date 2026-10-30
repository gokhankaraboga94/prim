export const ARAGORN_ID = "aragorn-test" as const;
export type AragornId = typeof ARAGORN_ID;
export const ARAGORN_MODE = { id: ARAGORN_ID, label: "aragorn test" } as const;
export const ARAGORN_SECONDS = 8;
export const ARAGORN_URL = "/models/aragorn.glb";
export const ARAGORN_RED = "/models/red.glb";
export const ARAGORN_URLS = [ARAGORN_URL, ARAGORN_RED] as const;

/** Red clips, in order, two seconds each. The test is whether Aragorn moves with them. */
export const ARAGORN_CLIPS = ["Sword_Attack", "Sprint", "Sword_Regular_Combo", "Death_B"] as const;

export function aragornClip(t: number) {
  const i = Math.min(ARAGORN_CLIPS.length - 1, Math.floor(Math.max(0, t) / 2));
  return { name: ARAGORN_CLIPS[i], time: Math.max(0, t - i * 2) };
}

export type AragornCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

export function aragornCam(): AragornCam {
  return { x: 0, y: 1.45, z: -4.6, lx: 0, ly: 1.05, lz: 0, fov: 38 };
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
