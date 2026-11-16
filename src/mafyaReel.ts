/**
 * mafya — lineup inceleme: adamlar + arabalar, numaralı.
 * Geri bildirimle eleme / çoğaltma için.
 */
export const MAFYA_ID = "mafya" as const;
export type MafyaId = typeof MAFYA_ID;
export const MAFYA_MODE = { id: MAFYA_ID, label: "mafya" } as const;
export const MAFYA_SECONDS = 40;

export type MafyaKind = "man" | "car";
export type MafyaEntry = { url: string; kind: MafyaKind; num: number };

/** 1–9 adam, 10–12 araba. */
export const MAFYA_ENTRIES: readonly MafyaEntry[] = [
  { url: "/models/mafya/m01.glb", kind: "man", num: 1 },
  { url: "/models/mafya/m02.glb", kind: "man", num: 2 },
  { url: "/models/mafya/m03.glb", kind: "man", num: 3 },
  { url: "/models/mafya/m04.glb", kind: "man", num: 4 },
  { url: "/models/mafya/m05.glb", kind: "man", num: 5 },
  { url: "/models/mafya/m06.glb", kind: "man", num: 6 },
  { url: "/models/mafya/m07.glb", kind: "man", num: 7 },
  { url: "/models/mafya/m08.glb", kind: "man", num: 8 },
  { url: "/models/mafya/m09.glb", kind: "man", num: 9 },
  { url: "/models/mafya/c01.glb", kind: "car", num: 10 },
  { url: "/models/mafya/c02.glb", kind: "car", num: 11 },
  { url: "/models/mafya/c03.glb", kind: "car", num: 12 },
] as const;

export const MAFYA_N = MAFYA_ENTRIES.length;
export const MAFYA_URLS = MAFYA_ENTRIES.map((e) => e.url);

/** pistol | m4 — ateş animasyonuna göre. */
export type MafyaGun = "pistol" | "m4";

export function mafyaGunFor(i: number): MafyaGun {
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

/** Yan yana; arabalar daha geniş aralık. */
export function mafyaSpot(i: number) {
  let x = 0;
  for (let k = 0; k < i; k++) {
    x += MAFYA_ENTRIES[k].kind === "car" ? 4.2 : 1.55;
  }
  const kind = MAFYA_ENTRIES[i]?.kind ?? "man";
  x += kind === "car" ? 2.1 : 0.75;

  let total = 0;
  for (let k = 0; k < MAFYA_N; k++) {
    total += MAFYA_ENTRIES[k].kind === "car" ? 4.2 : 1.55;
  }
  return { x: x - total / 2, z: kind === "car" ? 0.4 : 0, yaw: Math.PI };
}

export function mafyaFar() {
  return 120;
}

export function mafyaHaze() {
  return { near: 18, far: 42 };
}

type Cam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

function clamp01(u: number) {
  return Math.max(0, Math.min(1, u));
}
function easeInOut(u: number) {
  const x = clamp01(u);
  return x * x * (3 - 2 * x);
}

/** Baştan sona yatay tarama — her model görünür. */
export function mafyaCam(t: number): Cam {
  const first = mafyaSpot(0);
  const last = mafyaSpot(MAFYA_N - 1);
  const u = easeInOut(clamp01(t / Math.max(0.01, MAFYA_SECONDS - 0.8)));
  const lx = first.x + (last.x - first.x) * u;
  const kind = MAFYA_ENTRIES[Math.min(MAFYA_N - 1, Math.floor(u * MAFYA_N))]?.kind ?? "man";
  const dist = kind === "car" ? 6.2 : 4.4;
  return {
    x: lx,
    y: kind === "car" ? 2.8 : 2.15,
    z: dist,
    lx,
    ly: kind === "car" ? 1.15 : 1.05,
    lz: 0,
    fov: kind === "car" ? 42 : 36,
  };
}
