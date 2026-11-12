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

/** Fallback / dance2 grid — wide enough that name plates don’t stack. */
export function danceSpot(i: number) {
  const row = Math.floor(i / 5);
  const col = i % 5;
  const x = (col - 2) * 1.25 + (row % 2) * 0.22;
  const z = -row * 1.4;
  return { x, z, yaw: Math.PI };
}

/**
 * Baked open-plaza feet for mekan.glb after fitMekan(DANCE_MEKAN_SPAN).
 * Flat cleared deck (no props), same Y, ~1.5×1.55 spacing so names don’t stack.
 */
export const DANCE_MEKAN_SPAN = 34;
export const DANCE_STREET_FEET: ReadonlyArray<{ x: number; y: number; z: number }> = [
  { x: 0.5, y: 2.5, z: 11.5 },
  { x: 2.25, y: 2.5, z: 11.5 },
  { x: 4.0, y: 2.5, z: 11.5 },
  { x: 5.75, y: 2.5, z: 11.5 },
  { x: 7.5, y: 2.5, z: 11.5 },
  { x: 0.72, y: 2.5, z: 9.7 },
  { x: 2.47, y: 2.5, z: 9.7 },
  { x: 4.22, y: 2.5, z: 9.7 },
  { x: 5.97, y: 2.5, z: 9.7 },
  { x: 7.72, y: 2.5, z: 9.7 },
  { x: 0.5, y: 2.5, z: 7.9 },
  { x: 2.25, y: 2.5, z: 7.9 },
  { x: 4.0, y: 2.5, z: 7.9 },
  { x: 5.75, y: 2.5, z: 7.9 },
  { x: 7.5, y: 2.5, z: 7.9 },
];

export type DanceCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

/** Orbit target — DanceBattle updates these after street placement. */
let camCx = 0;
let camCz = -1.6;
const CAM_R = 11.2;
const CAM_Y = 3.55;
const CAM_LOOK_Y = 1.45;

export function danceSetCamTarget(x: number, z: number) {
  camCx = x;
  camCz = z;
}

export function danceResetCamTarget() {
  camCx = 0;
  camCz = -1.6;
}

/**
 * Same distance the whole time — full 360° orbit so every dancer enters frame.
 * First frame already shows the front row dancing.
 */
export function danceCam(t: number): DanceCam {
  const u = Math.min(1, Math.max(0, t) / DANCE_SECONDS);
  const ang = u * Math.PI * 2;
  return {
    x: camCx + Math.sin(ang) * CAM_R,
    y: CAM_Y,
    z: camCz + Math.cos(ang) * CAM_R,
    lx: camCx,
    ly: CAM_LOOK_Y,
    lz: camCz,
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
