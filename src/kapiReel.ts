import { castleAxes, castleGrow, frontWalk, frontWallFace } from "./castleLayout";

export const KAPI_ID = "kapi" as const;
export type KapiId = typeof KAPI_ID;
export const KAPI_MODE = { id: KAPI_ID, label: "kapi" } as const;
export const KAPI_SECONDS = 30;

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

const ARCHER_X = [-5.6, -4.0, -2.4, -0.8, 0.8, 2.4, 4.0, 5.6];
const GAP_X = 1.12;
const GAP_Z = 1.02;
const RUN = 20.2;
const FLIGHT = 0.5;
export const KAPI_HIT = 20.7;

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
  const p = (t - (KAPI_HIT - 0.46 * dur)) / dur;
  if (p <= 0 || p >= 1) return GUARD;
  return swing(p);
}

export function kapiRunning(t: number) {
  return t < KAPI_HIT - 0.4;
}

export function kapiFace(level: number) {
  const face = frontWallFace(level);
  const walk = frontWalk(level);
  return { z: face.z, y: walk.y };
}

export function kapiLead(t: number, faceZ: number) {
  const start = faceZ + 58;
  const end = faceZ + 4.4;
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
  78, 102, 66, 91, 77, 54, 103, 67, 42, 79, 113, 55, 41, 114, 43, 30, 115, 31, 18, 19, 6, 7, 125, 126, 137, 138, 20, 32,
];

const GROUPS: { t: number; ids: number[] }[] = [
  { t: 6.3, ids: [4, 8, 16] },
  { t: 10.7, ids: [17, 28, 29] },
  { t: 15.1, ids: [33, 44, 45] },
  { t: 18.6, ids: [56, 57, 68] },
];

const EYES: { i: number; t: number }[] = [
  { i: 18, t: 4.35 },
  { i: 30, t: 8.7 },
  { i: 42, t: 13.05 },
  { i: 66, t: 16.9 },
];

function buildDeaths() {
  const used = new Set<number>();
  const out: { i: number; t: number; archer: number; eye: boolean }[] = [];
  const add = (i: number, t: number, eye = false) => {
    if (used.has(i) || i < 0 || i >= KAPI_N) return;
    used.add(i);
    out.push({ i, t, archer: i % KAPI_ARCHERS, eye });
  };
  add(6, -0.16);
  add(5, 0.32);
  add(7, 1.15);
  for (const eye of EYES) add(eye.i, eye.t, true);
  let t = 1.35;
  for (let n = 0; n < ORDER.length; n++) {
    add(ORDER[n], t);
    t += n % 4 === 0 ? 0.32 : 0.58;
  }
  for (const group of GROUPS) {
    group.ids.forEach((id, k) => add(id, group.t + k * 0.05));
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
  const grow = castleGrow(level);
  const { sy, sz, zShift } = castleAxes(grow);
  const wallH = 3.85 + ((((Math.max(1, level) - 1) % 5) + 1) * 0.18);
  const y = (wallH + 2.36) * sy - 1.88;
  const z = (6.85 + 1.9) * sz + zShift;
  return ARCHER_X.map((x) => ({ x, y, z }));
}

export function kapiEye(t: number) {
  for (const death of KAPI_DEATHS) {
    if (!death.eye) continue;
    if (t >= death.t - 0.48 && t <= death.t + 1.15) return death;
  }
  return null;
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
  return smo(t, KAPI_HIT, KAPI_HIT + 2.15);
}

function mixN(a: number, b: number, k: number) {
  return a + (b - a) * k;
}

export function kapiCam(t: number, level: number): KapiCam {
  const face = kapiFace(level);
  const faceZ = face.z;
  const eye = kapiEye(t);
  if (eye) {
    const pose = kapiSoldier(eye.i, t, faceZ);
    const aim = kapiSoldier(eye.i, eye.t, faceZ);
    const post = kapiArchers(level)[eye.archer] ?? kapiArchers(level)[0];
    const born = eye.t - FLIGHT;
    const u = Math.min(1, Math.max(0, (t - born) / FLIGHT));
    const ax = post.x + (aim.x - post.x) * u;
    const az = post.z + (aim.z - post.z) * u;
    const ay = post.y + 1.45 + (1.2 - (post.y + 1.45)) * u + Math.sin(u * Math.PI) * 1.15;
    const dive = smo(t, eye.t, eye.t + 0.85);
    const z = pose.z - 0.5;
    if (t < eye.t + 0.08) {
      return {
        x: pose.x + 0.46,
        y: 1.56,
        z,
        lx: ax,
        ly: ay,
        lz: az,
        fov: 50,
      };
    }
    return {
      x: pose.x + 0.12,
      y: Math.max(0.22, 1.56 - dive * 1.3),
      z,
      lx: pose.x,
      ly: 0.08,
      lz: z - 2.4,
      fov: 64,
    };
  }
  const lead = kapiLead(t, faceZ);
  const pull = smo(t, KAPI_HIT - 0.3, KAPI_HIT + 1.85);
  const y = 4.2 + pull * 4;
  const z = lead + 9.5 + pull * 6;
  return {
    x: 0.15,
    y,
    z,
    lx: 0,
    ly: mixN(9.5, 16, pull),
    lz: mixN(faceZ + 2, faceZ - 8, pull),
    fov: 54 + pull * 10,
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
