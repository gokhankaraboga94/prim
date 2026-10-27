import { castleAxes, castleGrow, frontWalk, frontWallFace } from "./castleLayout";

export const KAPI_ID = "kapi" as const;
export const KAPI2_ID = "kapi2" as const;
export const KAPI3_ID = "kapi3" as const;
export type KapiId = typeof KAPI_ID | typeof KAPI2_ID | typeof KAPI3_ID;
export const KAPI_MODE = { id: KAPI_ID, label: "kapi" } as const;
export const KAPI2_MODE = { id: KAPI2_ID, label: "kapi2" } as const;
export const KAPI3_MODE = { id: KAPI3_ID, label: "kapi3" } as const;
export const KAPI_SECONDS = 38;
export const KAPI2_SECONDS = KAPI_SECONDS;
export const KAPI3_SECONDS = KAPI_SECONDS;

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
export const KAPI_ARCHERS = 14;
export const KAPI_EARLY = ["OKLAR", "İNİYOR"] as const;
export const KAPI_LATE = ["OKLAR", "İNİYOR", "KAPI KIRILACAK"] as const;
export const KAPI2_HOOK = ["ÇIKAN YOK", "İÇERİ DOLU"] as const;
export const KAPI3_HOOK = ["KAÇAMAZSIN", "İÇERİ DOLU"] as const;

const ARCHER_X = [-5.6, -4.0, -2.4, -0.8, 0.8, 2.4, 4.0, 5.6];
const FLANK_X = [-6.4, -4.6, -3.3, 3.3, 4.6, 6.4];
const GAP_X = 1.72;
const GAP_Z = 1.38;
const RUN = 20.2;
const FLIGHT = 0.5;
const RUSH_AT = 21.9;
const RUSH = 8.2;
export const KAPI_HIT = 20.7;

export function isKapi(id: string | null | undefined): id is KapiId {
  return id === KAPI_ID || id === KAPI2_ID || id === KAPI3_ID;
}

export function isKapi3(id: string | null | undefined): id is typeof KAPI3_ID {
  return id === KAPI3_ID;
}

export function isKapi2(id: string | null | undefined): id is typeof KAPI2_ID {
  return id === KAPI2_ID;
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
let reel: "kapi" | "kapi2" | "kapi3" = "kapi";
const waiters: Array<() => void> = [];

export function kapiUse(id: KapiId | null) {
  reel = id === KAPI3_ID ? "kapi3" : id === KAPI2_ID ? "kapi2" : "kapi";
}

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

function rawT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

/** kapi2 and kapi3 replace only the opening, then rejoin the same charge. */
export function kapiT() {
  const raw = rawT();
  if (reel === "kapi3" && raw < 3.7) return 23.2;
  if (reel === "kapi2" && raw < 1.2) return 22.5 + raw * 1.25;
  return raw;
}

/** Yard romans lunge at the lens during the kapi3 hook. Wall archers stay put. */
export function kapiRomanZ(index: number, baseZ: number) {
  if (reel !== "kapi3" || index < KAPI_ARCHERS) return baseZ;
  const raw = rawT();
  if (raw >= 3.7) return baseZ;
  const yard = index - KAPI_ARCHERS;
  const row = Math.floor(yard / 4);
  if (raw < 1.05) {
    if (yard !== 2) return baseZ - 2.4;
    return baseZ + 0.95 + Math.min(1, raw / 0.95) * 1.2;
  }
  const u = Math.min(1, (raw - 1.05) / 2.1);
  return baseZ + u * (6.4 - row * 0.85);
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
  if (t < RUN) return true;
  return t >= RUSH_AT && t < RUSH_AT + RUSH;
}

export function kapiFace(level: number) {
  const face = frontWallFace(level);
  const walk = frontWalk(level);
  return { z: face.z, y: walk.y };
}

export function kapiLead(t: number, faceZ: number) {
  const start = faceZ + 58;
  const gate = faceZ + 4.4;
  if (t <= RUN) return start + (gate - start) * Math.max(0, t) / RUN;
  if (t <= RUSH_AT) return gate;
  const yard = faceZ - 14.2;
  const u = Math.min(1, (t - RUSH_AT) / RUSH);
  return gate + (yard - gate) * u;
}

/** Courtyard slab top once a body has crossed the inner lip. Outside the yard the field is y=0. */
export function kapiGround(z: number, level: number) {
  const { sy, sz, zShift } = castleAxes(castleGrow(level));
  const near = 5.05 * sz + zShift;
  const far = -13.15 * sz + zShift;
  if (z > near + 0.35 || z < far) return 0;
  return 0.09 * sy;
}

/** Same roman archers as the wall, waiting in the yard behind the gate. */
export function kapiYard(level: number) {
  const { sx, sy, sz, zShift } = castleAxes(castleGrow(level));
  const y = 0.09 * sy;
  const xs = [-0.9, -0.3, 0.3, 0.9];
  const zs = [4.5, 3.45, 2.45];
  const out: { x: number; y: number; z: number; s: number }[] = [];
  for (const localZ of zs) {
    for (const localX of xs) out.push({ x: localX * sx, y, z: localZ * sz + zShift, s: 2.15 });
  }
  return out;
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
  const { sx, sy, sz, zShift } = castleAxes(grow);
  const wallH = 3.85 + ((((Math.max(1, level) - 1) % 5) + 1) * 0.18);
  const gateY = (wallH + 2.36) * sy - 1.88;
  const gateZ = (6.85 + 1.9) * sz + zShift;
  const flankY = wallH * sy + 0.35;
  const flankZ = (7.625 + 0.28) * sz + zShift;
  return [
    ...ARCHER_X.map((x) => ({ x, y: gateY, z: gateZ, s: 2.15 })),
    ...FLANK_X.map((localX) => ({ x: localX * sx, y: flankY, z: flankZ, s: 3.5 })),
  ];
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
  out: KapiArrow,
  linger = 0,
  arc = 1.15
) {
  const born = hit - FLIGHT;
  if (t < born || t > hit + linger) return false;
  const u = Math.min(1, (t - born) / FLIGHT);
  const at = (k: number) => {
    const x = from.x + (to.x - from.x) * k;
    const z = from.z + (to.z - from.z) * k;
    const y = from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * arc;
    return { x, y, z };
  };
  const here = at(u);
  const ahead = at(Math.min(1, u + 0.05));
  const behind = at(Math.max(0, u - 0.05));
  out.x = here.x;
  out.y = here.y;
  out.z = here.z;
  out.dx = ahead.x - behind.x;
  out.dy = ahead.y - behind.y;
  out.dz = ahead.z - behind.z;
  return true;
}

export type KapiRain = { hit: number; archer: number; x: number; back: number; y: number };

function buildRain() {
  const out: KapiRain[] = [];
  let n = 0;
  for (let wave = 0; wave < 58; wave++) {
    const base = -0.7 + wave * 0.32;
    if (base > KAPI_HIT - 0.15) break;
    for (let k = 0; k < 8; k++) {
      const i = n++;
      out.push({
        hit: base + k * 0.04,
        archer: (i * 3 + k) % KAPI_ARCHERS,
        x: ((i * 5) % 9 - 4) * 1.35,
        back: 1.6 + (i % 10) * 1.28,
        y: 0.55 + (i % 5) * 0.28,
      });
    }
  }
  return out;
}

export const KAPI_RAIN = buildRain();

export function kapiBreak(t: number) {
  return smo(t, KAPI_HIT, KAPI_HIT + 2.15);
}

function mixN(a: number, b: number, k: number) {
  return a + (b - a) * k;
}

const FORM_TAIL = 3.6 + (Math.ceil(KAPI_N / KAPI_COLS) - 1) * GAP_Z;

const HERO_BEATS: readonly [number, number, number][] = [
  [5.55, 7.2, 0],
  [9.95, 11.55, 1],
  [14.3, 15.75, 2],
  [18.15, 19.55, 3],
];

function heroBeat(t: number) {
  for (const [a, b, i] of HERO_BEATS) {
    if (t >= a && t < b) return i;
  }
  return -1;
}

function breachCam(level: number, raw: number): KapiCam {
  const faceZ = kapiFace(level).z;
  const u = Math.min(1, raw / 1.2);
  return {
    x: 0.1,
    y: 1.45,
    z: faceZ - 9.1 - u * 1.5,
    lx: 0,
    ly: 2.05,
    lz: faceZ - 16,
    fov: 40 - u * 6,
  };
}

function chargeCam(t: number, level: number, raw: number): KapiCam {
  const faceZ = kapiFace(level).z;
  const lead = kapiLead(t, faceZ);
  const u = Math.min(1, Math.max(0, (raw - 1.2) / 2.67));
  return {
    x: 0,
    y: 1.72,
    z: lead - (5.2 - u * 1.1),
    lx: 0,
    ly: 1.55,
    lz: lead + 0.8,
    fov: 40 - u * 4,
  };
}

export function kapiOpening() {
  const raw = rawT();
  if (reel === "kapi2") return raw < 3.87;
  if (reel === "kapi3") return raw < 3.7;
  return false;
}

function shieldCam(level: number): KapiCam {
  const { sx, sz, zShift } = castleAxes(castleGrow(level));
  const x = 0.3 * sx;
  const z = 4.5 * sz + zShift + 2.05;
  return { x, y: 1.5, z, lx: x, ly: 1.35, lz: z - 2.2, fov: 32 };
}

function packCam(level: number, raw: number): KapiCam {
  const faceZ = kapiFace(level).z;
  const u = Math.min(1, Math.max(0, (raw - 1.05) / 2.1));
  return {
    x: 0.15,
    y: 1.65,
    z: faceZ - 7.4,
    lx: 0,
    ly: 1.45,
    lz: faceZ - 14,
    fov: 50 - u * 12,
  };
}

export function kapiCam(t: number, level: number): KapiCam {
  if (reel === "kapi3") {
    const raw = rawT();
    if (raw < 1.05) return shieldCam(level);
    if (raw < 3.7) return packCam(level, raw);
  }
  if (reel === "kapi2") {
    const raw = rawT();
    if (raw < 1.2) return breachCam(level, raw);
    if (raw < 3.87) return chargeCam(t, level, raw);
  }
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
  const pull = smo(t, KAPI_HIT - 0.45, KAPI_HIT + 1.7);
  const hero = pull > 0.05 ? -1 : heroBeat(t);
  if (hero >= 0) {
    const hx = KAPI_HERO_X[hero];
    return {
      x: hx - 0.28,
      y: 2.7,
      z: lead + 3.35,
      lx: hx,
      ly: 0.9,
      lz: lead + 0.2,
      fov: 54,
    };
  }
  const y = 8.6 + pull * 0.6;
  const z = lead + FORM_TAIL + 19 - pull * 3;
  return {
    x: 0,
    y,
    z,
    lx: 0,
    ly: mixN(3.2, 2.6, pull),
    lz: mixN(lead + 2, lead - 9, pull),
    fov: 72 + pull * 2,
  };
}

export function kapiRoster(names: readonly string[]) {
  const last = names.map((n) => n.trim()).filter(Boolean).slice(-KAPI_N);
  const out = Array.from({ length: KAPI_N }, () => "");
  const start = KAPI_N - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

export function kapiCard(t: number): { lines: readonly string[]; opacity: number } | null {
  if (reel === "kapi2" || reel === "kapi3") {
    const raw = rawT();
    if (raw >= 3.75) return null;
    const fade = raw < 3.2 ? 1 : 1 - (raw - 3.2) / 0.55;
    return { lines: reel === "kapi3" ? KAPI3_HOOK : KAPI2_HOOK, opacity: Math.max(0, fade) };
  }
  if (t < 1.35) return { lines: KAPI_EARLY, opacity: 1 };
  if (t < 3.75) {
    const fade = t < 3.2 ? 1 : 1 - (t - 3.2) / 0.55;
    return { lines: KAPI_LATE, opacity: Math.max(0, fade) };
  }
  return null;
}
