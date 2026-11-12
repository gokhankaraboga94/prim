export const EPIK_ID = "epik" as const;
export type EpikId = typeof EPIK_ID;
export const EPIK_MODE = { id: EPIK_ID, label: "epik" } as const;
export const EPIK_SECONDS = 20;
export const EPIK_HERO = "/models/savaci.glb";
export const EPIK_KNIGHT = "/models/knight.glb";
export const EPIK_URLS = [EPIK_HERO, EPIK_KNIGHT] as const;
export const EPIK_NAMES = 3;
export const EPIK_ARMY = 280;

/** Premium reel: sharper capture than the default Lambert films. */
export function epikHiRes() {
  return true;
}

export type EpikCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

/**
 * First frame already shows the fortress under a light shaft.
 * 1–3s: drop into the army. Then three named close-ups. Charge to the gate. Black out.
 */
export function epikCam(t: number): EpikCam {
  if (t < 1.15) return { x: 18, y: 72, z: 58, lx: 0, ly: 8, lz: -36, fov: 34 };
  if (t < 3.1) return { x: 10, y: 28, z: 42, lx: 0, ly: 3, lz: -20, fov: 36 };
  if (t < 5) return { x: 2.4, y: 2.1, z: 34, lx: 0, ly: 1.4, lz: 22, fov: 38 };
  if (t < 6.7) return { x: -0.35, y: 1.55, z: 29.2, lx: 0, ly: 1.45, lz: 27.2, fov: 32 };
  if (t < 8.4) return { x: 0.55, y: 1.58, z: 28.6, lx: 0.1, ly: 1.48, lz: 26.6, fov: 32 };
  if (t < 10.1) return { x: -0.2, y: 1.52, z: 27.9, lx: 0, ly: 1.42, lz: 25.9, fov: 31 };
  if (t < 15.2) {
    const u = (t - 10.1) / 5.1;
    const z = 26 - u * 48;
    return { x: 1.8, y: 2.35 + u * 1.2, z: z + 6, lx: 0, ly: 1.6, lz: z - 8, fov: 40 };
  }
  if (t < 17.6) return { x: 0.6, y: 3.2, z: -18, lx: 0, ly: 4, lz: -34, fov: 42 };
  return { x: 0.2, y: 2.4, z: -22, lx: 0, ly: 3.2, lz: -36, fov: 38 };
}

export function epikCharge(t: number) {
  if (t < 10.1) return 0;
  if (t >= 17.6) return 1;
  return Math.min(1, (t - 10.1) / 7);
}

export function epikHeroFocus(t: number) {
  if (t < 5 || t >= 10.1) return -1;
  if (t < 6.7) return 0;
  if (t < 8.4) return 1;
  return 2;
}

export function epikFade(t: number) {
  if (t < 17.8) return 0;
  return Math.min(1, (t - 17.8) / 1.8);
}

export function epikRoster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-EPIK_NAMES);
  const out = Array.from({ length: EPIK_NAMES }, () => "");
  const start = EPIK_NAMES - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

export function epikSpark(t: number) {
  return t >= 10.1 && t < 17.2;
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function epikMarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function epikIsReady() {
  return ready;
}

export function epikWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function epikHold() {
  playAt = 0;
}

export function epikStart() {
  playAt = performance.now() / 1000;
}

export function epikT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function epikReset() {
  ready = false;
  playAt = 0;
}

export function isEpik(id: string | null | undefined): id is EpikId {
  return id === EPIK_ID;
}
