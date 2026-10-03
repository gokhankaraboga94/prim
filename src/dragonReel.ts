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

type Breath = { t0: number; dur: number; ax: number; az: number; dragon: number; r: number };
type Side = "left" | "right" | "front" | "all";

const PANIC = 11.05;
const RUN = 1.22;

function fleeStep(x: number, z: number, t: number, seed: number) {
  const delay = (seed % 7) * 0.07;
  const start = PANIC + delay;
  if (t <= start) return { x, z, face: (hash01(seed + 2) - 0.5) * 0.16, moving: false };
  const run = t - start;
  const side = x > 0.35 ? 1 : x < -0.35 ? -1 : seed % 2 === 0 ? 1 : -1;
  const vx = side * (0.36 + hash01(seed + 6) * 0.22);
  const vz = -1.05 - hash01(seed + 8) * 0.18;
  const len = Math.hypot(vx, vz) || 1;
  return {
    x: x + (vx / len) * RUN * run,
    z: z + (vz / len) * RUN * run,
    face: Math.atan2(vx, vz),
    moving: true,
  };
}

type Key = { t: number; x: number; y: number; z: number; pitch: number };

const PATHS: Key[][] = [
  [
    { t: 0, x: -26, y: 28, z: 2, pitch: -0.35 },
    { t: 5.2, x: -12, y: 19, z: 7, pitch: -0.82 },
    { t: 11, x: -5, y: 16.5, z: 5, pitch: -1.02 },
    { t: 18, x: -2, y: 16, z: 0, pitch: -0.96 },
    { t: 26, x: 4, y: 17, z: -6, pitch: -0.72 },
    { t: 36, x: 14, y: 23, z: -10, pitch: -0.4 },
  ],
  [
    { t: 0, x: 24, y: 30, z: 18, pitch: -0.32 },
    { t: 6.4, x: 12, y: 18, z: 11, pitch: -0.88 },
    { t: 13, x: 7, y: 15.8, z: 3, pitch: -1.05 },
    { t: 20, x: 3, y: 16, z: -3, pitch: -0.98 },
    { t: 28, x: -4, y: 17.5, z: -8, pitch: -0.7 },
    { t: 36, x: -12, y: 22, z: -4, pitch: -0.38 },
  ],
  [
    { t: 0, x: 1, y: 34, z: 38, pitch: -0.48 },
    { t: 5.4, x: 0, y: 21, z: 16, pitch: -0.92 },
    { t: 12, x: -1, y: 17, z: 7, pitch: -1.08 },
    { t: 19, x: 1, y: 16.2, z: -1, pitch: -1.05 },
    { t: 27, x: 2, y: 16.8, z: -9, pitch: -0.86 },
    { t: 36, x: 5, y: 22, z: -16, pitch: -0.42 },
  ],
];

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
  aimR: number;
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

type Plan = { breaths: Breath[]; die: Float64Array };

const plans = new Map<number, Plan>();

function aliveAt(n: number, when: number, die: Float64Array) {
  const pts: { i: number; x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (die[i] < 1e8) continue;
    const home = cell(i);
    const p = fleeStep(home.x, home.z, when, i);
    pts.push({ i, x: p.x, z: p.z });
  }
  return pts;
}

function pickAim(pts: { x: number; z: number }[], side: Side, r: number) {
  let pool = pts;
  if (side === "left") pool = pts.filter((p) => p.x < 0.6);
  else if (side === "right") pool = pts.filter((p) => p.x > -0.6);
  else if (side === "front") {
    const zs = pts.map((p) => p.z).sort((a, b) => a - b);
    const cut = zs[Math.min(zs.length - 1, Math.floor(zs.length * 0.45))] ?? 0;
    pool = pts.filter((p) => p.z <= cut + 0.4);
  }
  if (pool.length === 0) pool = pts;
  const cell = Math.max(1.15, r * 0.5);
  const bins = new Map<string, { x: number; z: number; c: number }>();
  for (const p of pool) {
    const key = `${Math.round(p.x / cell)},${Math.round(p.z / cell)}`;
    const bin = bins.get(key) ?? { x: 0, z: 0, c: 0 };
    bin.x += p.x;
    bin.z += p.z;
    bin.c += 1;
    bins.set(key, bin);
  }
  const list = [...bins.values()];
  const r2 = r * r;
  let bestX = pool[0]?.x ?? 0;
  let bestZ = pool[0]?.z ?? 4;
  let bestHits = -1;
  for (const bin of list) {
    const cx = bin.x / bin.c;
    const cz = bin.z / bin.c;
    let hits = 0;
    for (const other of list) {
      const ox = other.x / other.c - cx;
      const oz = other.z / other.c - cz;
      if (ox * ox + oz * oz <= r2) hits += other.c;
    }
    if (hits > bestHits) {
      bestHits = hits;
      bestX = cx;
      bestZ = cz;
    }
  }
  return { x: bestX, z: bestZ };
}

function burn(pts: { i: number; x: number; z: number }[], ax: number, az: number, r: number, when: number, die: Float64Array) {
  const r2 = r * r;
  let hit = 0;
  for (const p of pts) {
    const dx = p.x - ax;
    const dz = p.z - az;
    if (dx * dx + dz * dz > r2) continue;
    die[p.i] = when + (hit % 5) * 0.045;
    hit += 1;
  }
  return hit;
}

function buildPlan(n: number): Plan {
  const die = new Float64Array(n);
  die.fill(1e9);
  const breaths: Breath[] = [];
  const left = place(0, -2.5);
  const right = place(2, 4.5);
  const rear = place(4, 0);
  const open = [
    { t0: 6.15, dur: 1.55, dragon: 0, r: 2.45, ax: left.x, az: left.z },
    { t0: 7.9, dur: 1.5, dragon: 1, r: 2.45, ax: right.x, az: right.z },
    { t0: 9.65, dur: 1.55, dragon: 2, r: 2.55, ax: rear.x, az: rear.z },
  ];
  for (const shot of open) {
    const when = shot.t0 + 0.22;
    let pts = aliveAt(n, when, die);
    let ax = shot.ax;
    let az = shot.az;
    const r2 = shot.r * shot.r;
    if (!pts.some((p) => (p.x - ax) * (p.x - ax) + (p.z - az) * (p.z - az) <= r2) && pts.length) {
      let best = pts[0];
      let bestD = Infinity;
      for (const p of pts) {
        const d = (p.x - ax) * (p.x - ax) + (p.z - az) * (p.z - az);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      ax = best.x;
      az = best.z;
      pts = aliveAt(n, when, die);
    }
    breaths.push({ t0: shot.t0, dur: shot.dur, dragon: shot.dragon, r: shot.r, ax, az });
    burn(pts, ax, az, shot.r, when, die);
  }
  const sides: Side[] = ["left", "right", "front"];
  for (let t0 = 12.4; t0 <= 33.6; t0 += 1.7) {
    const when = t0 + 0.2;
    let pts = aliveAt(n, when, die);
    if (!pts.length) break;
    const reach = Math.min(5.6, 2.85 + Math.sqrt(pts.length) * 0.11);
    for (let d = 0; d < 3 && pts.length; d++) {
      const aim = pickAim(pts, sides[d], reach);
      const dists = pts.map((p) => Math.hypot(p.x - aim.x, p.z - aim.z)).sort((a, b) => a - b);
      const share = Math.max(3, Math.ceil(pts.length / 3));
      const want = dists[Math.min(dists.length - 1, share - 1)] ?? reach;
      const r = Math.min(5.8, Math.max(2.5, want + 0.28));
      breaths.push({ t0, dur: 1.45, dragon: d, r, ax: aim.x, az: aim.z });
      const killed = burn(pts, aim.x, aim.z, r, when, die);
      if (!killed) {
        breaths.pop();
        continue;
      }
      pts = pts.filter((p) => {
        const dx = p.x - aim.x;
        const dz = p.z - aim.z;
        return dx * dx + dz * dz > r * r;
      });
    }
  }
  let extraT = 34.15;
  let guard = 0;
  while (die.some((v) => v > 1e8) && extraT < 35 && guard < 3) {
    const when = extraT + 0.12;
    let pts = aliveAt(n, when, die);
    if (!pts.length) break;
    for (let d = 0; d < 3 && pts.length; d++) {
      const aim = pickAim(pts, "all", 3.2);
      const dists = pts.map((p) => Math.hypot(p.x - aim.x, p.z - aim.z)).sort((a, b) => a - b);
      let r = 2.3;
      for (const dist of dists) {
        if (dist > 6.4) break;
        r = dist + 0.3;
      }
      breaths.push({ t0: extraT, dur: 1.2, dragon: d, r, ax: aim.x, az: aim.z });
      const killed = burn(pts, aim.x, aim.z, r, when, die);
      if (!killed) {
        breaths.pop();
        continue;
      }
      pts = pts.filter((p) => Math.hypot(p.x - aim.x, p.z - aim.z) > r);
    }
    extraT += 0.35;
    guard += 1;
  }
  return { breaths, die };
}

function planOf(n: number) {
  const count = Math.max(1, Math.floor(n));
  const cached = plans.get(count);
  if (cached) return cached;
  const built = buildPlan(count);
  plans.set(count, built);
  return built;
}

export function breathSlots(n: number) {
  return planOf(n).breaths.length;
}

export function dragonBreaths(n = 1) {
  return planOf(n).breaths;
}

export function dragonBreathIndex(t: number, which = 0, n = 1) {
  const breaths = planOf(n).breaths;
  for (let i = 0; i < breaths.length; i++) {
    const b = breaths[i];
    if (b.dragon !== which) continue;
    if (t >= b.t0 && t <= b.t0 + b.dur) return i;
  }
  return -1;
}

function breathEnv(t: number, which: number, n: number) {
  let best = 0;
  let ax = 0;
  let az = 8;
  let r = FIRE_R;
  const mine = planOf(n).breaths.filter((b) => b.dragon === which);
  for (const b of mine) {
    const u = (t - b.t0) / b.dur;
    if (u <= 0 || u >= 1) continue;
    const env = Math.sin(clamp01(u) * Math.PI);
    if (env >= best) {
      best = env;
      ax = b.ax;
      az = b.az;
      r = b.r;
    }
  }
  if (best <= 0 && mine.length) {
    let next = mine[mine.length - 1];
    for (const b of mine) {
      if (t < b.t0 + b.dur * 0.5) {
        next = b;
        break;
      }
    }
    ax = next.ax;
    az = next.az;
    r = next.r;
  }
  return { breath: best, ax, az, r };
}

function atKey(path: Key[], t: number) {
  if (t <= path[0].t) return path[0];
  const last = path[path.length - 1];
  if (t >= last.t) return last;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
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

export function dragonAt(t: number, which = 0, n = 0): DragonPose {
  const path = PATHS[which] ?? PATHS[0];
  const k = atKey(path, t);
  const k2 = atKey(path, t + 0.12);
  const env = n > 0 ? breathEnv(t, which, n) : { breath: 0, ax: k.x, az: k.z + 6, r: FIRE_R };
  const yaw = Math.atan2(env.ax - k.x, env.az - k.z);
  const roll = Math.max(-0.4, Math.min(0.4, (k2.x - k.x) * -0.45));
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
    aimR: env.r,
  };
}

export function sampleDragonCam(recT: number): ShotPose {
  const t = Math.max(0, recT);
  const a = dragonAt(t, 0);
  const b = dragonAt(t, 1);
  const c = dragonAt(t, 2);
  return {
    x: 10,
    y: 24,
    z: -42,
    lx: (a.x + b.x + c.x) / 9,
    ly: 8,
    lz: 5,
    fov: 64,
  };
}

function deathPlan(n: number) {
  return planOf(n).die;
}

export function dragonFriendAt(i: number, n: number, t: number, out: New1Pose) {
  const home = cell(Math.max(0, i));
  const dieAt = n > 0 ? deathPlan(n)[Math.min(i, n - 1)] : 1e9;
  const live = fleeStep(home.x, home.z, Math.min(t, dieAt), i);
  out.s = 1;
  out.blood = 0;
  out.rz = (hash01(i + 5) - 0.5) * 0.04;
  out.ry = live.face;
  if (t < dieAt) {
    out.x = live.x;
    out.z = live.z;
    out.y = live.moving ? Math.abs(Math.sin(t * 11 + i)) * 0.14 : Math.sin(t * 2.1 + i) * 0.02;
    out.rx = live.moving ? 0.42 : -0.24;
    return;
  }
  const age = t - dieAt;
  const away = fleeStep(home.x, home.z, dieAt + 0.4, i);
  const dx = away.x - live.x;
  const dz = away.z - live.z;
  const len = Math.hypot(dx, dz) || 1;
  const fallenX = live.x + (dx / len) * 0.7;
  const fallenZ = live.z + (dz / len) * 0.7;
  out.blood = 1;
  out.rz = ((i % 5) - 2) * 0.08;
  if (age < 0.48) {
    const u = age / 0.48;
    out.x = lerp(live.x, fallenX, u);
    out.z = lerp(live.z, fallenZ, u);
    out.y = Math.sin(u * Math.PI) * 0.16;
    out.rx = u * 1.5;
    return;
  }
  if (age < 2.8) {
    out.x = fallenX;
    out.y = 0.12;
    out.z = fallenZ;
    out.rx = 1.5;
    return;
  }
  out.x = fallenX;
  out.y = -40;
  out.z = fallenZ;
  out.rx = 1.5;
  out.s = 0;
}
