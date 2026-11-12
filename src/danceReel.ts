export const DANCE_ID = "dance" as const;
export const DANCE2_ID = "dance2" as const;
export type DanceId = typeof DANCE_ID;
export type Dance2Id = typeof DANCE2_ID;
export type DanceAnyId = DanceId | Dance2Id;
export const DANCE_MODE = { id: DANCE_ID, label: "dance" } as const;
export const DANCE2_MODE = { id: DANCE2_ID, label: "dance2" } as const;
export const DANCE_SECONDS = 30;
export const DANCE2_SECONDS = 18;
export const DANCE_N = 15;

/** User drops these into public/models (or repo root → copy there). */
export const DANCE_MODELS = [
  "/models/dans1.glb",
  "/models/dans2.glb",
  "/models/dans3.glb",
] as const;

export const DANCE_MEKAN = "/models/mekan.glb";
export const DANCE_URLS = [...DANCE_MODELS, DANCE_MEKAN];
/** dance2: same dancers, no venue — white floor only. */
export const DANCE2_URLS = [...DANCE_MODELS];

export function isDance(id: string | null | undefined): id is DanceId {
  return id === DANCE_ID;
}

export function isDance2(id: string | null | undefined): id is Dance2Id {
  return id === DANCE2_ID;
}

export function isDanceAny(id: string | null | undefined): id is DanceAnyId {
  return id === DANCE_ID || id === DANCE2_ID;
}

export function danceRoster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-DANCE_N);
  const out = Array.from({ length: DANCE_N }, () => "");
  const start = DANCE_N - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

/** 3 rows × 5 — tighter pack so everyone reads in the orbit. */
export function danceSpot(i: number) {
  const row = Math.floor(i / 5);
  const col = i % 5;
  const x = (col - 2) * 0.95 + (row % 2) * 0.2;
  const z = -row * 1.05;
  return { x, z, yaw: Math.PI };
}

export type DanceCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

const CAM_CX = 0;
const CAM_CZ = -1.6;
const CAM_R = 9.4;
const CAM_Y = 3.15;
const CAM_LOOK_Y = 1.35;

/**
 * Same distance the whole time — full 360° orbit so every dancer enters frame.
 * First frame already shows the front row dancing.
 */
export function danceCam(t: number): DanceCam {
  const u = Math.min(1, Math.max(0, t) / DANCE_SECONDS);
  const ang = u * Math.PI * 2;
  return {
    x: CAM_CX + Math.sin(ang) * CAM_R,
    y: CAM_Y,
    z: CAM_CZ + Math.cos(ang) * CAM_R,
    lx: CAM_CX,
    ly: CAM_LOOK_Y,
    lz: CAM_CZ,
    fov: 40,
  };
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
