export const GECME_ID = "gecme" as const;
export type GecmeId = typeof GECME_ID;
export const GECME_MODE = { id: GECME_ID, label: "gecme" } as const;
export const GECME_SECONDS = 28;

export const GECME_LEAD = "/models/arena3/armored.glb";
export const GECME_GUEST = "/models/arena3/medieval.glb";
export const GECME_ORC_A = "/models/new/orc1-lite.glb";
export const GECME_ORC_B = "/models/new/orc2-lite.glb";
export const GECME_URLS = [GECME_LEAD, GECME_GUEST, GECME_ORC_A, GECME_ORC_B] as const;
export const GECME_FACE = 0;

export const GECME_LINES = [
  ["BU ORK", "KAÇAMAZ"],
  ["ARKADA", "BİR SIRA"],
  ["SIRA", "BİTMİYOR"],
  ["SANA", "BAKIYOR"],
] as const;

export function isGecme(id: string | null | undefined): id is GecmeId {
  return id === GECME_ID;
}

export type GecmeCam = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

export type GecmeStrike = { lift: number; chop: number };

const GUARD: GecmeStrike = { lift: 0.38, chop: 0.22 };

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function gecmeMarkReady() {
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function gecmeIsReady() {
  return ready;
}

export function gecmeWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function gecmeHold() {
  playAt = 0;
}

export function gecmeStart() {
  playAt = performance.now() / 1000;
}

export function gecmeT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function gecmeReset() {
  ready = false;
  playAt = 0;
}

function smo(t: number, a: number, b: number) {
  if (t <= a) return 0;
  if (t >= b) return 1;
  const k = (t - a) / (b - a);
  return k * k * (3 - 2 * k);
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function sample(keys: ReadonlyArray<readonly [number, number]>, t: number) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t > keys[i][0]) continue;
    const [t0, v0] = keys[i - 1];
    const [t1, v1] = keys[i];
    return v0 + (v1 - v0) * smo(t, t0, t1);
  }
  return keys[keys.length - 1][1];
}

function mix(a: GecmeStrike, b: GecmeStrike, k: number): GecmeStrike {
  return { lift: a.lift + (b.lift - a.lift) * k, chop: a.chop + (b.chop - a.chop) * k };
}

function swing(p: number): GecmeStrike {
  const cocked: GecmeStrike = { lift: 1, chop: 0 };
  const impact: GecmeStrike = { lift: 0.7, chop: 1 };
  if (p <= 0 || p >= 1) return GUARD;
  if (p < 0.28) return mix(GUARD, cocked, smo(p, 0, 0.28));
  if (p < 0.44) {
    const k = (p - 0.28) / 0.16;
    return mix(cocked, impact, 1 - (1 - k) * (1 - k) * (1 - k));
  }
  if (p < 0.52) return impact;
  if (p < 0.85) return mix(impact, GUARD, smo(p, 0.52, 0.85));
  return GUARD;
}

function strikeWindow(t: number, hit: number, dur = 0.72): GecmeStrike | null {
  const start = hit - 0.46 * dur;
  const p = (t - start) / dur;
  if (p < 0 || p > 1) return null;
  return swing(p);
}

const HERO_Z: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.75, 0.2],
  [4.4, 3.05],
  [4.9, 3.23],
  [6.8, 5.2],
  [7.4, 5.43],
  [9.5, 7.7],
  [10.2, 7.95],
  [11.9, 10.0],
  [12.6, 10.25],
  [14.2, 13.1],
  [16.6, 13.1],
  [18.2, 15.55],
  [18.8, 15.85],
  [20.6, 17.75],
  [21.2, 18.1],
  [24.5, 19.2],
  [28, 19.35],
];

const LEAD_HITS = [0.13, 4.9, 7.4, 10.2, 12.6, 18.8, 21.2];

export const GECME_ORCS = [
  { mesh: 0, x: 0.2, z: 2.32, hit: 0.13 },
  { mesh: 1, x: -0.48, z: 4.58, hit: 4.9 },
  { mesh: 0, x: 0.36, z: 6.78, hit: 7.4 },
  { mesh: 1, x: 0.4, z: 9.3, hit: 10.2 },
  { mesh: 0, x: -0.32, z: 11.6, hit: 12.6 },
  { mesh: 1, x: 0.95, z: 15.05, hit: 18.8 },
  { mesh: 0, x: 0.9, z: 17.9, hit: 19.5 },
  { mesh: 1, x: 0.12, z: 19.5, hit: 21.2 },
] as const;

const GUEST_X: ReadonlyArray<readonly [number, number]> = [
  [0, -0.9],
  [2.9, -0.9],
  [3.35, -0.28],
  [15.6, -0.28],
  [16.8, -0.7],
  [28, -0.55],
];

const GUEST_Z: ReadonlyArray<readonly [number, number]> = [
  [0, 14.55],
  [16.2, 14.55],
  [18.2, 16.15],
  [19.5, 16.5],
  [22, 18.15],
  [26, 19.35],
  [28, 19.45],
];

const GUEST_YAW: ReadonlyArray<readonly [number, number]> = [
  [0, Math.PI],
  [15.8, Math.PI],
  [16.9, 0.08],
  [28, 0.06],
];

export function gecmeHeroZ(t: number) {
  return sample(HERO_Z, t);
}

export function gecmeLead(t: number) {
  let strike = GUARD;
  const open = strikeWindow(t, LEAD_HITS[0], 1.05);
  if (open) strike = open;
  else {
    for (let i = 1; i < LEAD_HITS.length; i++) {
      const hit = strikeWindow(t, LEAD_HITS[i], 0.78);
      if (!hit) continue;
      strike = hit;
      break;
    }
  }
  return { x: 0, y: 0, z: gecmeHeroZ(t), yaw: 0, strike };
}

export function gecmeGuest(t: number) {
  const hit = strikeWindow(t, 19.5, 0.7);
  return {
    x: sample(GUEST_X, t),
    z: sample(GUEST_Z, t),
    yaw: sample(GUEST_YAW, t),
    strike: hit ?? GUARD,
  };
}

export function gecmeOrcPose(orc: (typeof GECME_ORCS)[number], t: number) {
  const fall = t < orc.hit ? 0 : clamp((t - orc.hit) / 0.28, 0, 1);
  return { x: orc.x, z: orc.z, show: true, fall };
}

function cam(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): GecmeCam {
  return { x, y, z, lx, ly, lz, fov };
}

function mixCam(a: GecmeCam, b: GecmeCam, k: number): GecmeCam {
  const e = k * k * (3 - 2 * k);
  return cam(
    a.x + (b.x - a.x) * e,
    a.y + (b.y - a.y) * e,
    a.z + (b.z - a.z) * e,
    a.lx + (b.lx - a.lx) * e,
    a.ly + (b.ly - a.ly) * e,
    a.lz + (b.lz - a.lz) * e,
    a.fov + (b.fov - a.fov) * e,
  );
}

function closeOf(z: number) {
  return cam(0.46, 1.64, z - 1.9, 0.06, 1.4, z + 1.42, 40);
}

function wideOf(z: number) {
  return cam(0.12, 2.48, z - 4.7, 0.12, 1.22, z + 5.6, 62);
}

function followOf(z: number) {
  const breathe = Math.sin(z * 0.35) * 0.03;
  return cam(0.58 + breathe, 1.9, z - 2.8, 0, 1.3, z + 2.3, 48);
}

const GUEST_CAM = cam(-2.15, 1.5, 12.15, -0.35, 1.12, 14.7, 36);
const END_CAM = cam(0.15, 2.0, 14.4, 0, 1.2, 19.7, 52);

export function gecmeCam(t: number): GecmeCam {
  const z = gecmeHeroZ(t);
  const near = closeOf(z);
  const far = wideOf(z);
  const back = followOf(z);
  if (t < 1.72) return near;
  if (t < 2.02) return mixCam(near, far, (t - 1.72) / 0.3);
  if (t < 3) return far;
  if (t < 4.15) return GUEST_CAM;
  if (t < 23.6) return back;
  if (t < 25) return mixCam(back, END_CAM, (t - 23.6) / 1.4);
  return END_CAM;
}

export function gecmeCard(t: number) {
  if (t < 1) return { lines: GECME_LINES[0], opacity: 1 };
  if (t < 2) return { lines: GECME_LINES[1], opacity: 1 };
  if (t < 3) return { lines: GECME_LINES[2], opacity: 1 };
  if (t < 3.9) return { lines: GECME_LINES[3], opacity: t < 3.4 ? 1 : 1 - smo(t, 3.4, 3.9) };
  return { lines: [] as readonly string[], opacity: 0 };
}
