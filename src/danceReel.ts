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
/** dance2: same dancers, procedural neon club (no mekan.glb). */
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

/** dance2 pack on the club stage — spaced so name plates stay readable. */
export function danceSpot(i: number) {
  const row = Math.floor(i / 5);
  const col = i % 5;
  const x = (col - 2) * 1.55 + (row % 2) * 0.28;
  const z = -row * 1.65;
  return { x, z, yaw: Math.PI };
}

/**
 * Baked open-plaza feet for mekan.glb after fitMekan(DANCE_MEKAN_SPAN).
 * Centered in the venue (not the map edge) so orbit stays inside the model.
 */
export const DANCE_MEKAN_SPAN = 34;
export const DANCE_STREET_FEET: ReadonlyArray<{ x: number; y: number; z: number }> = [
  { x: -3.1, y: 2.5, z: -1.6 },
  { x: -1.55, y: 2.5, z: -1.6 },
  { x: 0, y: 2.5, z: -1.6 },
  { x: 1.55, y: 2.5, z: -1.6 },
  { x: 3.1, y: 2.5, z: -1.6 },
  { x: -2.9, y: 2.5, z: -3.2 },
  { x: -1.35, y: 2.5, z: -3.2 },
  { x: 0.2, y: 2.5, z: -3.2 },
  { x: 1.75, y: 2.5, z: -3.2 },
  { x: 3.3, y: 2.5, z: -3.2 },
  { x: -3.1, y: 2.5, z: -4.8 },
  { x: -1.55, y: 2.5, z: -4.8 },
  { x: 0, y: 2.5, z: -4.8 },
  { x: 1.55, y: 2.5, z: -4.8 },
  { x: 3.1, y: 2.5, z: -4.8 },
];

export type DanceCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

/** Orbit target — DanceBattle updates these after street placement. */
let camCx = 0;
let camCz = -1.6;
/** street = tight inside mekan; club = wider neon stage. */
let camMode: "street" | "club" = "club";
const CAM = {
  street: { r: 6.8, y: 2.85, lookY: 1.15, fov: 36 },
  club: { r: 9.8, y: 3.35, lookY: 1.25, fov: 40 },
} as const;

export function danceSetCamTarget(x: number, z: number, mode: "street" | "club" = "club") {
  camCx = x;
  camCz = z;
  camMode = mode;
}

export function danceResetCamTarget() {
  camCx = 0;
  camCz = -1.6;
  camMode = "club";
}

/**
 * Same distance the whole time — full 360° orbit so every dancer enters frame.
 * Street mode keeps the lens inside mekan so the void outside never reads.
 */
export function danceCam(t: number): DanceCam {
  const seconds = camMode === "street" ? DANCE_SECONDS : DANCE2_SECONDS;
  const u = Math.min(1, Math.max(0, t) / seconds);
  const ang = u * Math.PI * 2;
  const shot = CAM[camMode];
  return {
    x: camCx + Math.sin(ang) * shot.r,
    y: shot.y,
    z: camCz + Math.cos(ang) * shot.r,
    lx: camCx,
    ly: shot.lookY,
    lz: camCz,
    fov: shot.fov,
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
