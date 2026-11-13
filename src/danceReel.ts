export const DANCE_ID = "dance" as const;
export const DANCE2_ID = "dance2" as const;
export const DANCE3_ID = "dance3" as const;
export type DanceId = typeof DANCE_ID;
export type Dance2Id = typeof DANCE2_ID;
export type Dance3Id = typeof DANCE3_ID;
export type DanceAnyId = DanceId | Dance2Id | Dance3Id;
export const DANCE_MODE = { id: DANCE_ID, label: "dance" } as const;
export const DANCE2_MODE = { id: DANCE2_ID, label: "dance2" } as const;
export const DANCE3_MODE = { id: DANCE3_ID, label: "dance3" } as const;
export const DANCE_SECONDS = 30;
export const DANCE2_SECONDS = 18;
/** Quick single-subject cuts on the club stage. */
export const DANCE3_SECONDS = 36;
export const DANCE_N = 15;

/** User drops these into public/models (or repo root → copy there). */
export const DANCE_MODELS = [
  "/models/dans1.glb",
  "/models/dans2.glb",
  "/models/dans3.glb",
] as const;

export const DANCE_MEKAN = "/models/mekan.glb";
export const DANCE_URLS = [...DANCE_MODELS, DANCE_MEKAN];
/** dance2 / dance3: same dancers, procedural neon club (no mekan.glb). */
export const DANCE2_URLS = [...DANCE_MODELS];
export const DANCE3_URLS = [...DANCE_MODELS];

export function isDance(id: string | null | undefined): id is DanceId {
  return id === DANCE_ID;
}

export function isDance2(id: string | null | undefined): id is Dance2Id {
  return id === DANCE2_ID;
}

export function isDance3(id: string | null | undefined): id is Dance3Id {
  return id === DANCE3_ID;
}

export function isDanceAny(id: string | null | undefined): id is DanceAnyId {
  return id === DANCE_ID || id === DANCE2_ID || id === DANCE3_ID;
}

/** Phones: coarse pointer or short edge — used to lighten dance GPU/RAM. */
export function danceIsPhone() {
  if (typeof window === "undefined") return false;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 860;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  return narrow || coarse;
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
 * Open street plaza feet in mekan.glb space after fitMekan(DANCE_MEKAN_SPAN).
 * DanceBattle shifts the venue so this pack sits at world origin (frame center).
 */
export const DANCE_MEKAN_SPAN = 48;
export const DANCE_STREET_FEET: ReadonlyArray<{ x: number; y: number; z: number }> = [
  { x: 0.706, y: 3.529, z: 16.235 },
  { x: 3.176, y: 3.529, z: 16.235 },
  { x: 5.647, y: 3.529, z: 16.235 },
  { x: 8.118, y: 3.529, z: 16.235 },
  { x: 10.588, y: 3.529, z: 16.235 },
  { x: 1.016, y: 3.529, z: 13.694 },
  { x: 3.487, y: 3.529, z: 13.694 },
  { x: 5.958, y: 3.529, z: 13.694 },
  { x: 8.428, y: 3.529, z: 13.694 },
  { x: 10.899, y: 3.529, z: 13.694 },
  { x: 0.706, y: 3.529, z: 11.153 },
  { x: 3.176, y: 3.529, z: 11.153 },
  { x: 5.647, y: 3.529, z: 11.153 },
  { x: 8.118, y: 3.529, z: 11.153 },
  { x: 10.588, y: 3.529, z: 11.153 },
];

export type DanceCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

export type Dance3Cut = { i: number; at: number; dur: number };

/**
 * Hold pattern: 0.5 → 1 → 0.5 → … short cuts.
 * Model index = dancer i % 3 — never the same model twice in a row.
 */
export function buildDance3Cuts(seconds = DANCE3_SECONDS): Dance3Cut[] {
  const pattern = [0.5, 1.0, 0.5, 0.75, 0.55, 0.9, 0.5, 1.0, 0.6, 0.85];
  const byModel: number[][] = [[], [], []];
  for (let i = 0; i < DANCE_N; i++) byModel[i % 3].push(i);
  const cursor = [0, 0, 0];
  const out: Dance3Cut[] = [];
  let t = 0;
  let model = 0;
  let prevModel = -1;
  while (t < seconds - 0.05) {
    if (model === prevModel) model = (model + 1) % 3;
    const pool = byModel[model];
    const i = pool[cursor[model] % pool.length];
    cursor[model] += 1;
    const dur = Math.min(pattern[out.length % pattern.length], seconds - t);
    out.push({ i, at: t, dur });
    prevModel = model;
    model = (model + 1) % 3;
    t += dur;
  }
  return out;
}

let dance3Cuts: Dance3Cut[] = buildDance3Cuts();

export function dance3FocusAt(t: number): Dance3Cut {
  const list = dance3Cuts;
  if (!list.length) return { i: 0, at: 0, dur: 0.5 };
  for (let k = list.length - 1; k >= 0; k--) {
    if (t >= list[k].at) return list[k];
  }
  return list[0];
}

export function dance3FocusIndex(t: number) {
  return dance3FocusAt(t).i;
}

/** Orbit target — DanceBattle updates these after street placement. */
let camCx = 0;
let camCz = -1.6;
/** street = tight inside mekan; club = wider neon stage; solo = dance3 one-at-a-time. */
let camMode: "street" | "club" | "solo" = "club";
const CAM = {
  street: { r: 8.2, y: 4.2, lookY: 1.55, fov: 32 },
  club: { r: 8.33, y: 3.2, lookY: 1.25, fov: 40 },
  solo: { r: 2.9, y: 1.45, lookY: 1.05, fov: 34 },
} as const;

export function danceSetCamTarget(x: number, z: number, mode: "street" | "club" | "solo" = "club") {
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
 * Club: full 360°. Street: short arc into the city.
 * Solo: hard cut to one dancer — never same GLB model back-to-back.
 */
export function danceCam(t: number): DanceCam {
  if (camMode === "solo") {
    const cut = dance3FocusAt(t);
    const spot = danceSpot(cut.i);
    const shot = CAM.solo;
    // Face the dancer (they look −Z); slight yaw variety per cut index.
    const cutIdx = Math.max(0, dance3Cuts.findIndex((c) => c.at === cut.at && c.i === cut.i));
    const yaw = ((cutIdx % 5) - 2) * 0.18;
    const dist = shot.r;
    // Dancers face −Z (rotation.y = π); stand in front of them.
    return {
      x: spot.x + Math.sin(yaw) * dist,
      y: shot.y,
      z: spot.z - Math.cos(yaw) * dist,
      lx: spot.x,
      ly: shot.lookY,
      lz: spot.z,
      fov: shot.fov,
    };
  }
  const seconds = camMode === "street" ? DANCE_SECONDS : DANCE2_SECONDS;
  const u = Math.min(1, Math.max(0, t) / seconds);
  const shot = CAM[camMode];
  // street: stay on +Z side of pack (outside edge) and look inward (−Z into streets)
  const ang = camMode === "street" ? (u - 0.5) * 1.55 : u * Math.PI * 2;
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
  dance3Cuts = buildDance3Cuts();
}
