import type { ShotPose } from "./shotModes";
import type { New1Pose } from "./new1Reel";

export const DRAGON_ID = "ejdarja" as const;
export type DragonId = typeof DRAGON_ID;
export const DRAGON_MODE = { id: DRAGON_ID, label: "ejdarja" } as const;

export function isDragon(id: string | null | undefined): id is DragonId {
  return id === DRAGON_ID;
}

export const DRAGON_SECONDS = 36;

const COLS = 14;
const SX = 1.72;
const SZ = 1.5;

type Breath = { t0: number; dur: number; ax: number; az: number };

const BREATHS: Breath[] = [
  { t0: 7.4, dur: 1.7, ax: -6.4, az: 4.6 },
  { t0: 12.2, dur: 1.7, ax: 6.2, az: 7.0 },
  { t0: 17.0, dur: 1.75, ax: -2.4, az: 12.4 },
  { t0: 21.8, dur: 1.7, ax: 5.4, az: 16.4 },
  { t0: 26.6, dur: 1.85, ax: -4.4, az: 9.4 },
];

type Key = { t: number; x: number; y: number; z: number; pitch: number };

const KEYS: Key[] = [
  { t: 0, x: -12, y: 28, z: 36, pitch: -0.42 },
  { t: 3.6, x: -7, y: 18, z: 20, pitch: -0.36 },
];

for (const b of BREATHS) {
  KEYS.push({ t: b.t0 - 0.85, x: b.ax - 1.2, y: 13.2, z: b.az + 11, pitch: -0.4 });
  KEYS.push({ t: b.t0 + b.dur * 0.42, x: b.ax, y: 8.6, z: b.az + 7.4, pitch: -0.78 });
  KEYS.push({ t: b.t0 + b.dur + 0.15, x: b.ax + 1.4, y: 11.4, z: b.az + 9.2, pitch: -0.34 });
}
KEYS.push({ t: 32.4, x: 6, y: 22, z: 32, pitch: -0.22 });
KEYS.push({ t: 36, x: 14, y: 30, z: 46, pitch: -0.12 });

export type DragonPose = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  breath: number;
  aimX: number;
  aimZ: number;
};

function clamp01(u: number) {
  return Math.max(0, Math.min(1, u));
}

function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u;
}

function hash01(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function cell(i: number) {
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  const jx = (hash01(i + 2) - 0.5) * 1.55;
  const jz = (hash01(i + 23) - 0.5) * 1.25;
  const x = (c - (COLS - 1) / 2) * SX + jx;
  const z = 2.1 + r * SZ + jz;
  return { x, z, face: (hash01(i + 11) - 0.5) * 0.9 };
}

export function breathSlots(n: number) {
  const kill = Math.floor(Math.max(0, n) * 0.8);
  if (kill < 20) return 1;
  if (kill < 48) return 2;
  if (kill < 84) return 3;
  if (kill < 130) return 4;
  return BREATHS.length;
}

export function dragonBreaths() {
  return BREATHS;
}

export function dragonBreathIndex(t: number) {
  for (let i = 0; i < BREATHS.length; i++) {
    const b = BREATHS[i];
    if (t >= b.t0 && t <= b.t0 + b.dur) return i;
  }
  return -1;
}

function breathEnv(t: number) {
  let best = 0;
  let ax = 0;
  let az = 8;
  for (const b of BREATHS) {
    const u = (t - b.t0) / b.dur;
    if (u <= 0 || u >= 1) continue;
    const env = Math.sin(clamp01(u) * Math.PI);
    if (env >= best) {
      best = env;
      ax = b.ax;
      az = b.az;
    }
  }
  if (best <= 0) {
    let next = BREATHS[BREATHS.length - 1];
    for (const b of BREATHS) {
      if (t < b.t0 + b.dur * 0.5) {
        next = b;
        break;
      }
    }
    ax = next.ax;
    az = next.az;
  }
  return { breath: best, ax, az };
}

function atKey(t: number) {
  if (t <= KEYS[0].t) return KEYS[0];
  const last = KEYS[KEYS.length - 1];
  if (t >= last.t) return last;
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i];
    const b = KEYS[i + 1];
    if (t > b.t) continue;
    const u = clamp01((t - a.t) / Math.max(0.001, b.t - a.t));
    const e = u * u * (3 - 2 * u);
    return {
      t,
      x: lerp(a.x, b.x, e),
      y: lerp(a.y, b.y, e),
      z: lerp(a.z, b.z, e),
      pitch: lerp(a.pitch, b.pitch, e),
    };
  }
  return last;
}

export function dragonAt(t: number): DragonPose {
  const k = atKey(t);
  const k2 = atKey(t + 0.12);
  const env = breathEnv(t);
  const yaw = Math.atan2(env.ax - k.x, env.az - k.z);
  const roll = Math.max(-0.35, Math.min(0.35, (k2.x - k.x) * -0.35));
  return {
    x: k.x,
    y: k.y,
    z: k.z,
    yaw,
    pitch: k.pitch,
    roll,
    breath: env.breath,
    aimX: env.ax,
    aimZ: env.az,
  };
}

export function sampleDragonCam(recT: number): ShotPose {
  const t = Math.max(0, recT);
  const d = dragonAt(t);
  const arrive = clamp01(t / 6.2);
  const e = arrive * arrive * (3 - 2 * arrive);
  return {
    x: 14 - e * 3,
    y: 20 - e * 5,
    z: -31,
    lx: d.x * 0.28,
    ly: 2.2 + (1 - e) * Math.min(12, d.y * 0.42) + e * 2.6,
    lz: 8,
    fov: 58,
  };
}

const deaths = new Map<number, Float64Array>();

function deathPlan(n: number) {
  const cached = deaths.get(n);
  if (cached) return cached;
  const die = new Float64Array(n);
  die.fill(1e9);
  const kill = Math.floor(n * 0.8);
  const slots = Math.min(BREATHS.length, breathSlots(n));
  const use = BREATHS.slice(0, slots);
  const base = Math.floor(kill / use.length);
  let extra = kill - base * use.length;
  const used = new Uint8Array(n);
  for (let b = 0; b < use.length; b++) {
    const quota = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    const order: number[] = [];
    for (let i = 0; i < n; i++) if (!used[i]) order.push(i);
    const ax = use[b].ax;
    const az = use[b].az;
    order.sort((i, j) => {
      const ci = cell(i);
      const cj = cell(j);
      const di = (ci.x - ax) * (ci.x - ax) + (ci.z - az) * (ci.z - az);
      const dj = (cj.x - ax) * (cj.x - ax) + (cj.z - az) * (cj.z - az);
      return di - dj;
    });
    const take = Math.min(quota, order.length);
    for (let k = 0; k < take; k++) {
      const i = order[k];
      used[i] = 1;
      die[i] = use[b].t0 + 0.16 + (k % 10) * 0.042;
    }
  }
  deaths.set(n, die);
  return die;
}

export function dragonFriendAt(i: number, n: number, t: number, out: New1Pose) {
  const home = cell(Math.max(0, i));
  const dieAt = n > 0 ? deathPlan(n)[Math.min(i, n - 1)] : 1e9;
  const fly = dragonAt(t);
  out.s = 1;
  out.blood = 0;
  out.rz = (hash01(i + 5) - 0.5) * 0.12;
  const look = Math.atan2(fly.x - home.x, fly.z - home.z);
  const watch = clamp01((16 - fly.y) / 12);
  out.ry = lerp(home.face, look, 0.25 + watch * 0.75);
  const bob = Math.sin(t * 2.1 + i * 0.7) * 0.025;
  if (t < dieAt) {
    out.x = home.x;
    out.y = bob;
    out.z = home.z;
    out.rx = fly.y > 10 ? -0.22 : -0.08;
    return;
  }
  const age = t - dieAt;
  const aim = breathEnv(dieAt);
  const dx = home.x - aim.ax;
  const dz = home.z - aim.az;
  const len = Math.hypot(dx, dz) || 1;
  const slide = 0.85;
  const fallenX = home.x + (dx / len) * slide;
  const fallenZ = home.z + (dz / len) * slide;
  out.blood = 1;
  out.rz = ((i % 5) - 2) * 0.06;
  if (age < 0.5) {
    const u = age / 0.5;
    out.x = lerp(home.x, fallenX, u);
    out.z = lerp(home.z, fallenZ, u);
    out.y = Math.sin(u * Math.PI) * 0.18;
    out.rx = u * 1.52;
    return;
  }
  if (age < 3.2) {
    out.x = fallenX;
    out.y = 0.12;
    out.z = fallenZ;
    out.rx = 1.52;
    return;
  }
  out.x = fallenX;
  out.y = -40;
  out.z = fallenZ;
  out.rx = 1.52;
  out.s = 0;
}
