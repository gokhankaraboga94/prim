/**
 * mafya — yeni_Modeller lineup inceleme.
 * Yan yana 1..N numaralı modeller; ateş animasyonu + el silahı.
 * Geri bildirimle eleme / çoğaltma için.
 */
export const MAFYA_ID = "mafya" as const;
export type MafyaId = typeof MAFYA_ID;
export const MAFYA_MODE = { id: MAFYA_ID, label: "mafya" } as const;
export const MAFYA_SECONDS = 18;

/** public/models/mafya/m01..m09 — sıra = numara. */
export const MAFYA_MODELS = [
  "/models/mafya/m01.glb",
  "/models/mafya/m02.glb",
  "/models/mafya/m03.glb",
  "/models/mafya/m04.glb",
  "/models/mafya/m05.glb",
  "/models/mafya/m06.glb",
  "/models/mafya/m07.glb",
  "/models/mafya/m08.glb",
  "/models/mafya/m09.glb",
] as const;

export const MAFYA_N = MAFYA_MODELS.length;
export const MAFYA_URLS = [...MAFYA_MODELS] as const;

/** pistol | m4 — ateş animasyonuna göre. */
export type MafyaGun = "pistol" | "m4";

export function mafyaGunFor(i: number): MafyaGun {
  // Çift numaralar M4 (koşarak ateş), tekler tabanca — görsel çeşit.
  return i % 2 === 0 ? "m4" : "pistol";
}

export function isMafya(id: string | null | undefined): id is MafyaId {
  return id === MAFYA_ID;
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function mafyaMarkReady() {
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}
export function mafyaIsReady() {
  return ready;
}
export function mafyaWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}
export function mafyaHold() {
  playAt = 0;
}
export function mafyaStart() {
  playAt = performance.now() / 1000;
}
export function mafyaT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}
export function mafyaReset() {
  ready = false;
  playAt = 0;
}

/** Yan yana, kameraya bakacak şekilde. */
export function mafyaSpot(i: number) {
  const n = MAFYA_N;
  const gap = 1.55;
  const x = (i - (n - 1) / 2) * gap;
  return { x, z: 0, yaw: Math.PI };
}

export function mafyaFar() {
  return 80;
}

export function mafyaHaze() {
  return { near: 28, far: 70 };
}

type Cam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

/** Tüm hattı gören sabit bakış. */
export function mafyaCam(t: number): Cam {
  const swing = Math.sin(t * 0.15) * 0.8;
  const n = MAFYA_N;
  const half = ((n - 1) / 2) * 1.55;
  return {
    x: swing,
    y: 2.35,
    z: Math.max(7.5, half * 1.15 + 5.2),
    lx: 0,
    ly: 1.05,
    lz: 0,
    fov: 38,
  };
}
