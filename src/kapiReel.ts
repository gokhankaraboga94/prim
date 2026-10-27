import { frontWalk, frontWallFace } from "./castleLayout";

export const KAPI_ID = "kapi" as const;
export type KapiId = typeof KAPI_ID;
export const KAPI_MODE = { id: KAPI_ID, label: "kapi" } as const;
export const KAPI_SECONDS = 20;

export const KAPI_HEROES = [
  "/models/arena3/armored.glb",
  "/models/arena3/fantasy.glb",
  "/models/arena3/fantasy-a.glb",
  "/models/arena3/fantasy-b.glb",
] as const;
export const KAPI_KNIGHT = "/models/knight.glb";
export const KAPI_ROMAN = "/models/roman.glb";
export const KAPI_URLS = [...KAPI_HEROES, KAPI_KNIGHT, KAPI_ROMAN] as const;

export const KAPI_N = 150;
export const KAPI_COLS = 12;
export const KAPI_ARCHERS = 8;
export const KAPI_EARLY = ["OKLAR", "İNİYOR"] as const;
export const KAPI_LATE = ["OKLAR", "İNİYOR", "KAPI KIRILACAK"] as const;

const GAP_X = 1.12;
const GAP_Z = 1.02;
const RUN = 15.4;
const FLIGHT = 0.58;
const HIT = 15.55;

export function isKapi(id: string | null | undefined): id is KapiId {
  return id === KAPI_ID;
}

export type KapiCam = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

export type KapiStrike = { lift: number; chop: number };

const GUARD: KapiStrike = { lift: 0.38, chop: 0.22 };

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function kapiMarkReady() {
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function kapiIsReady() {
  return ready;
}

export function kapiWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function kapiHold() {
  playAt = 0;
}

export function kapiStart() {
  playAt = performance.now() / 1000;
}

export function kapiT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function kapiReset() {
  ready = false;
  playAt = 0;
}

function smo(t: number, a: number, b: number) {
  if (t <= a) return 0;
  if (t >= b) return 1;
  const k = (t - a) / (b - a);
  return k * k * (3 - 2 * k);
}

function mix(a: KapiStrike, b: KapiStrike, k: number): KapiStrike {
  return { lift: a.lift + (b.lift - a.lift) * k, chop: a.chop + (b.chop - a.chop) * k };
}

function swing(p: number): KapiStrike {
  const cocked = { lift: 1, chop: 0 };
  const impact = { lift: 0.7, chop: 1 };
  if (p < 0.28) return mix(GUARD, cocked, p / 0.28);
  if (p < 0.44) {
    const k = (p - 0.28) / 0.16;
    return mix(cocked, impact, k * k * k);
  }
  if (p < 0.52) return impact;
  if (p < 0.85) return mix(impact, GUARD, (p - 0.52) / 0.33);
  return GUARD;
}

export function kapiSwing(t: number): KapiStrike {
  const dur = 0.9;
  const p = (t - (HIT - 0.46 * dur)) / dur;
  if (p <= 0 || p >= 1) return GUARD;
  return swing(p);
}

export function kapiRunning(t: number) {
  return t < 15.15;
}

export function kapiFace(level: number) {
  const face = frontWallFace(level);
  const walk = frontWalk(level);
  return { z: face.z, y: walk.y };
}

export function kapiLead(t: number, faceZ: number) {
  const start = faceZ + 22;
  const end = faceZ + 5.2;
  const u = Math.min(1, Math.max(0, t / RUN));
  return start + (end - start) * u;
}

export function kapiSlot(i: number) {
  const col = i % KAPI_COLS;
  const row = Math.floor(i / KAPI_COLS);
  return {
    x: (col - (KAPI_COLS - 1) / 2) * GAP_X,
    back: 3.6 + row * GAP_Z,
  };
}

export const KAPI_HERO_X = [-2.35, -0.8, 0.8, 2.35] as const;

const ORDER = [
  89, 78, 101, 66, 90, 77, 102, 65, 91, 54, 113, 67, 79, 103, 53, 114, 55, 115, 41, 42, 43, 30, 31, 32, 18, 19, 20, 6,
  7, 8, 125, 126, 137, 138,
];

const GROUPS: { t: number; ids: number[] }[] = [
  { t: 3.35, ids: [76, 88, 100] },
  { t: 7.55, ids: [65, 66, 67, 68] },
  { t: 11.15, ids: [53, 54, 55] },
];

function buildDeaths() {
  const used = new Set<number>();
  const out: { i: number; t: number; archer: number }[] = [];
  const add = (i: number, t: number) => {
    if (used.has(i) || i < 0 || i >= KAPI_N) return;
    used.add(i);
    out.push({ i, t, archer: i % KAPI_ARCHERS });
  };
  add(89, -0.28);
  add(78, 0.32);
  add(101, 0.54);
  let t = 0.96;
  for (let n = 3; n < ORDER.length; n++) {
    add(ORDER[n], t);
    t += n % 5 === 0 ? 0.24 : 0.4;
  }
  for (const group of GROUPS) {
    group.ids.forEach((id, k) => add(id, group.t + k * 0.04));
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

export const KAPI_DEATHS = buildDeaths();

const deathAt = new Float32Array(KAPI_N);
deathAt.fill(1e6);
for (const death of KAPI_DEATHS) deathAt[death.i] = death.t;

export function kapiSoldier(i: number, t: number, faceZ: number) {
  const slot = kapiSlot(i);
  const when = deathAt[i];
  const fallen = t >= when;
  const lead = kapiLead(fallen ? when : t, faceZ);
  const fall = fallen ? smo(t, when, when + 0.46) : 0;
  return { x: slot.x, z: lead + slot.back, fall };
}

export function kapiArchers(level: number) {
  const face = kapiFace(level);
  const spread = [-6.4, -4.6, -2.8, -1.15, 1.15, 2.8, 4.6, 6.4];
  return spread.map((x) => ({ x, y: face.y + 0.08, z: face.z - 0.45 }));
}

export type KapiArrow = { x: number; y: number; z: number; dx: number; dy: number; dz: number };

export function kapiArrow(
  t: number,
  hit: number,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  out: KapiArrow
) {
  const born = hit - FLIGHT;
  if (t < born || t > hit) return false;
  const u = (t - born) / FLIGHT;
  const x = from.x + (to.x - from.x) * u;
  const z = from.z + (to.z - from.z) * u;
  const y = from.y + (to.y - from.y) * u + Math.sin(u * Math.PI) * 1.15;
  const u2 = Math.min(1, u + 0.04);
  const x2 = from.x + (to.x - from.x) * u2;
  const z2 = from.z + (to.z - from.z) * u2;
  const y2 = from.y + (to.y - from.y) * u2 + Math.sin(u2 * Math.PI) * 1.15;
  out.x = x;
  out.y = y;
  out.z = z;
  out.dx = x2 - x;
  out.dy = y2 - y;
  out.dz = z2 - z;
  return true;
}

export function kapiBreak(t: number) {
  return smo(t, HIT, 17.15);
}

export function kapiCam(t: number, faceZ: number, wallY: number): KapiCam {
  const lead = kapiLead(t, faceZ);
  const tail = 3.6 + 12 * GAP_Z;
  const pull = smo(t, 14.7, 16.4);
  const y = 2.85 + pull * 2.8;
  const z = lead + tail + 3.4 - pull * 2;
  const dist = Math.max(8, z - faceZ);
  const elev = Math.atan2(wallY * 0.34 - y, dist);
  return {
    x: 0.4,
    y,
    z,
    lx: 0,
    ly: y + Math.tan(elev) * 10,
    lz: lead + 2,
    fov: 58 + pull * 6,
  };
}

export function kapiRoster(names: readonly string[]) {
  const last = names.map((n) => n.trim()).filter(Boolean).slice(-KAPI_N);
  last.reverse();
  const out = last.slice(0, KAPI_N);
  while (out.length < KAPI_N) out.push("");
  return out;
}

export function kapiCard(t: number): { lines: readonly string[]; opacity: number } | null {
  if (t < 1.35) return { lines: KAPI_EARLY, opacity: 1 };
  if (t < 3.75) {
    const fade = t < 3.2 ? 1 : 1 - (t - 3.2) / 0.55;
    return { lines: KAPI_LATE, opacity: Math.max(0, fade) };
  }
  return null;
}
