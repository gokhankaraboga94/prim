import type { ShotPose } from "./shotModes";
import type { New1Pose } from "./new1Reel";

export const DRAGON_ID = "ejdarja" as const;
export type DragonId = typeof DRAGON_ID;
export const DRAGON_MODE = { id: DRAGON_ID, label: "ejdarja" } as const;

export function isDragon(id: string | null | undefined): id is DragonId {
  return id === DRAGON_ID;
}

export const DRAGON_SECONDS = 36;

export const FIRE_R = 1.5;

const FILE = 1.4;
const RANK = 1.52;
const RANKS = [
  { n: 8, ox: -2.6 },
  { n: 12, ox: 0.9 },
  { n: 10, ox: -3.5 },
  { n: 14, ox: 1.7 },
  { n: 11, ox: -0.4 },
  { n: 13, ox: 2.5 },
  { n: 9, ox: -2.1 },
  { n: 12, ox: 0.5 },
  { n: 7, ox: 1.9 },
];

function rankOrigin(row: number) {
  const spec = RANKS[row % RANKS.length];
  const cycle = Math.floor(row / RANKS.length);
  return {
    n: spec.n,
    ox: spec.ox + (cycle % 2 === 0 ? 0 : 1.15),
    z: 1.7 + row * RANK,
  };
}

function place(row: number, col: number) {
  const spec = rankOrigin(row);
  const stagger = row % 2 === 1 ? FILE * 0.48 : 0;
  return { x: col * FILE + spec.ox + stagger, z: spec.z };
}

type Breath = { t0: number; dur: number; ax: number; az: number };

const BREATHS: Breath[] = [
  { t0: 7.4, dur: 1.7, ax: place(1, -1.5).x, az: place(1, -1.5).z },
  { t0: 12.2, dur: 1.7, ax: place(2, 2.5).x, az: place(2, 2.5).z },
  { t0: 17.0, dur: 1.75, ax: place(5, -2).x, az: place(5, -2).z },
  { t0: 21.8, dur: 1.7, ax: place(7, 1.5).x, az: place(7, 1.5).z },
  { t0: 26.6, dur: 1.85, ax: place(4, 0).x, az: place(4, 0).z },
];

type Key = { t: number; x: number; y: number; z: number; pitch: number };

const KEYS: Key[] = [
  { t: 0, x: -12, y: 28, z: 36, pitch: -0.42 },
  { t: 3.6, x: -7, y: 18, z: 20, pitch: -0.36 },
];

for (const b of BREATHS) {
  KEYS.push({ t: b.t0 - 0.9, x: b.ax - 2.4, y: 26, z: b.az + 14, pitch: -0.7 });
  KEYS.push({ t: b.t0, x: b.ax + 0.3, y: 18.5, z: b.az + 9.2, pitch: -1.12 });
  KEYS.push({ t: b.t0 + b.dur, x: b.ax + 0.55, y: 17.8, z: b.az + 8.6, pitch: -1.12 });
  KEYS.push({ t: b.t0 + b.dur + 0.4, x: b.ax + 2.6, y: 23, z: b.az + 13, pitch: -0.55 });
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
  const per = RANKS.reduce((sum, r) => sum + r.n, 0);
  const cycle = Math.floor(i / per);
  let rem = i % per;
  let local = 0;
  for (let r = 0; r < RANKS.length; r++) {
    if (rem < RANKS[r].n) {
      local = r;
      break;
    }
    rem -= RANKS[r].n;
  }
  const row = cycle * RANKS.length + local;
  const spec = rankOrigin(row);
  const stagger = row % 2 === 1 ? FILE * 0.48 : 0;
  const jx = (hash01(i + 4) - 0.5) * 0.16;
  const jz = (hash01(i + 9) - 0.5) * 0.12;
  return {
    x: (rem - (spec.n - 1) / 2) * FILE + spec.ox + stagger + jx,
    z: spec.z + jz,
    face: (hash01(i + 2) - 0.5) * 0.16,
  };
}

export function breathSlots(_n: number) {
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
    x: 13 - e * 2,
    y: 18 - e * 3,
    z: -34,
    lx: d.x * 0.16,
    ly: 4.2 + Math.min(6.5, d.y * 0.2),
    lz: 7,
    fov: 58,
  };
}

const deaths = new Map<number, Float64Array>();

function deathPlan(n: number) {
  const cached = deaths.get(n);
  if (cached) return cached;
  const die = new Float64Array(n);
  die.fill(1e9);
  const r2 = FIRE_R * FIRE_R;
  for (let b = 0; b < BREATHS.length; b++) {
    const ax = BREATHS[b].ax;
    const az = BREATHS[b].az;
    let hit = 0;
    for (let i = 0; i < n; i++) {
      if (die[i] < 1e8) continue;
      const p = cell(i);
      const dx = p.x - ax;
      const dz = p.z - az;
      if (dx * dx + dz * dz > r2) continue;
      die[i] = BREATHS[b].t0 + 0.2 + (hit % 6) * 0.06;
      hit += 1;
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
  out.rz = (hash01(i + 5) - 0.5) * 0.04;
  out.ry = home.face;
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
