import type { ShotPose } from "./shotModes";
import type { New1Pose } from "./new1Reel";

export const DEV_ID = "dev" as const;
export type DevId = typeof DEV_ID;
export const DEV_MODE = { id: DEV_ID, label: "DEV" } as const;

export const DEV2_ID = "dev2" as const;
export type Dev2Id = typeof DEV2_ID;
export const DEV3_ID = "dev3" as const;
export type Dev3Id = typeof DEV3_ID;
export const DEV4_ID = "dev4" as const;
export type Dev4Id = typeof DEV4_ID;
export const DEV5_ID = "dev5" as const;
export type Dev5Id = typeof DEV5_ID;
export const SNAKE_ID = "yilan1" as const;
export type SnakeId = typeof SNAKE_ID;
export type GiantId = DevId | Dev2Id | Dev3Id | Dev4Id | Dev5Id | SnakeId;
export const DEV2_MODE = { id: DEV2_ID, label: "DEV2" } as const;
export const DEV3_MODE = { id: DEV3_ID, label: "DEV3" } as const;
export const DEV4_MODE = { id: DEV4_ID, label: "DEV4" } as const;
export const DEV5_MODE = { id: DEV5_ID, label: "DEV5" } as const;
export const SNAKE_MODE = { id: SNAKE_ID, label: "yılan1" } as const;

export function isDev(id: string | null | undefined): id is DevId {
  return id === DEV_ID;
}

export function isDev2(id: string | null | undefined): id is Dev2Id {
  return id === DEV2_ID;
}

export function isDev3(id: string | null | undefined): id is Dev3Id {
  return id === DEV3_ID;
}

export function isDev4(id: string | null | undefined): id is Dev4Id {
  return id === DEV4_ID;
}

export function isDev5(id: string | null | undefined): id is Dev5Id {
  return id === DEV5_ID;
}

export function isSnake(id: string | null | undefined): id is SnakeId {
  return id === SNAKE_ID;
}

export function isDevBig(id: string | null | undefined) {
  return id === DEV2_ID || id === DEV3_ID || id === DEV4_ID || id === DEV5_ID || id === SNAKE_ID;
}

export function isDevAll(id: string | null | undefined) {
  return id === DEV3_ID || id === DEV4_ID || id === DEV5_ID || id === SNAKE_ID;
}

export function isDevSword(id: string | null | undefined) {
  return id === DEV4_ID || id === DEV5_ID || id === SNAKE_ID;
}

export function isGiantShot(id: string | null | undefined): id is GiantId {
  return id === DEV_ID || id === DEV2_ID || id === DEV3_ID || id === DEV4_ID || id === DEV5_ID || id === SNAKE_ID;
}

export const DEV_SECONDS = 58;
export const DEV2_SECONDS = DEV_SECONDS;
export const DEV3_SECONDS = DEV_SECONDS;
export const DEV4_SECONDS = DEV_SECONDS;
export const DEV5_SECONDS = DEV_SECONDS;
export const SNAKE_SECONDS = DEV_SECONDS;
export const DEV_N = 300;
export const DEV2_N = 450;
const FIGHT = 3.2;
const LAST = 52;

type Plan = { die: Float64Array; period: number };

const plans = new Map<string, Plan>();

function screenNear(i: number, n: number, big: boolean) {
  const live = ringAt(i, n, 0, big);
  const side = big ? 30 : 28;
  const back = big ? 48 : 46;
  return (live.x - live.g.x) * side - (live.z - live.g.z) * back;
}

function planOf(soldiers: number, big = false): Plan {
  const n = Math.max(1, Math.floor(soldiers));
  const key = `${big ? 1 : 0}:${n}`;
  const hit = plans.get(key);
  if (hit) return hit;
  const batches: number[] = [];
  let left = n;
  let swing = 0;
  while (left > 0) {
    let batch = 10 + ((swing * 5) % 11);
    if (left <= 20) batch = left;
    else if (left - batch < 10) batch = left - 10;
    batch = Math.max(1, Math.min(batch, left));
    batches.push(batch);
    left -= batch;
    swing += 1;
  }
  const period = batches.length <= 1 ? 1.2 : (LAST - FIGHT) / (batches.length - 1);
  const order = Array.from({ length: n }, (_, i) => i);
  order.sort((a, b) => screenNear(b, n, big) - screenNear(a, n, big) || a - b);
  const die = new Float64Array(n);
  let cursor = 0;
  batches.forEach((batch, index) => {
    const t = FIGHT + index * period;
    for (let k = 0; k < batch; k++) die[order[cursor++]] = t;
  });
  const plan = { die, period };
  plans.set(key, plan);
  return plan;
}

const WALK = 0.86;

export function devGiantAt(t: number) {
  const u = Math.max(0, t);
  const ang = u * WALK;
  const x = Math.sin(ang) * 7;
  const z = Math.cos(ang * 0.77) * 5;
  const dx = Math.cos(ang) * 7 * WALK;
  const dz = -Math.sin(ang * 0.77) * 5 * 0.77 * WALK;
  return { x, z, yaw: Math.atan2(dx, dz || 0.001) };
}

export function devNameCovered(sx: number, sz: number, cx: number, cz: number, recT: number, big: boolean) {
  const g = devGiantAt(Math.max(0, recT));
  const vx = g.x - cx;
  const vz = g.z - cz;
  const vlen = Math.hypot(vx, vz) || 1;
  const fx = vx / vlen;
  const fz = vz / vlen;
  const along = (sx - g.x) * fx + (sz - g.z) * fz;
  const side = Math.abs((sx - g.x) * fz - (sz - g.z) * fx);
  return along > 0.4 && side < (big ? 5.4 : 3.6);
}

export function devClubHit(t: number, soldiers: number) {
  if (t < FIGHT) return Math.max(0, Math.sin(t * 5.4)) * 0.28;
  if (t > LAST + 0.12) return 0;
  const period = planOf(soldiers).period;
  const phase = ((t - FIGHT) % period) / period;
  const burst = (center: number, width: number) => {
    const d = Math.min(Math.abs(phase - center), Math.abs(phase - center + 1), Math.abs(phase - center - 1));
    if (d > width) return 0;
    return Math.sin((1 - d / width) * Math.PI);
  };
  return Math.max(burst(0.03, 0.045), burst(0.46, 0.04));
}

export function devMaceSwing(t: number, soldiers: number) {
  const period = planOf(Math.max(1, soldiers)).period;
  const guard = { pitch: -0.18, sweep: 0.04, twist: 0, dip: 0, lunge: 0 };
  const span = 0.808;
  const fit = period >= span ? 1 : period / span;
  const windStart = 0.438 * fit;
  const snapStart = 0.118 * fit;
  const followEnd = 0.269 * fit;
  const idleAfter = 0.37 * fit;
  let dt: number;
  if (t < FIGHT) {
    dt = t - FIGHT;
  } else if (t > LAST + 0.22) {
    return guard;
  } else {
    const into = (t - FIGHT) % period;
    dt = into > period * 0.55 ? into - period : into;
  }
  if (dt < -windStart || dt > idleAfter) {
    const bob = Math.sin(t * 2.6) * 0.04;
    return { pitch: guard.pitch + bob, sweep: bob, twist: 0, dip: 0, lunge: 0 };
  }
  if (dt < -snapStart) {
    const u = (dt + windStart) / (windStart - snapStart);
    const raise = Math.sin(Math.min(1, u) * Math.PI * 0.5);
    return {
      pitch: -0.18 - raise * 1.12,
      sweep: -raise * 0.48,
      twist: -raise * 0.36,
      dip: raise * 0.06,
      lunge: -raise * 0.2,
    };
  }
  if (dt < 0) {
    const snap = Math.pow((dt + snapStart) / snapStart, 1.75);
    return {
      pitch: -1.3 + snap * 2.5,
      sweep: -0.48 + snap * 1.15,
      twist: -0.36 + snap * 0.78,
      dip: 0.06 + snap * 0.22,
      lunge: -0.2 + snap * 1.15,
    };
  }
  const rec = Math.min(1, dt / followEnd);
  const e = rec * rec * (3 - 2 * rec);
  return {
    pitch: 1.2 - e * 1.38,
    sweep: 0.67 - e * 0.63,
    twist: 0.42 - e * 0.42,
    dip: 0.28 * (1 - e),
    lunge: 0.95 * (1 - e),
  };
}

export function devIsArcher(i: number, n: number) {
  return i >= Math.ceil(Math.max(1, n) / 2);
}

export function devIsSpear(i: number, n: number) {
  return !devIsArcher(i, n) && i % 2 === 1;
}

function ringAt(i: number, n: number, t: number, big = false) {
  const g = devGiantAt(t);
  const archer = devIsArcher(i, n);
  const meleeN = Math.ceil(n / 2);
  const local = archer ? i - meleeN : i;
  const count = Math.max(1, archer ? n - meleeN : meleeN);
  const per = archer ? (big ? 44 : 42) : big ? 28 : 26;
  const ring = Math.floor(local / per);
  const idx = local % per;
  const seats = Math.max(1, Math.min(per, count - ring * per));
  const ang = (idx / seats) * Math.PI * 2 + ring * 0.47 + (archer ? 0.2 : 0);
  const rad = archer ? (big ? 30 + ring * 2.05 : 20 + ring * 1.7) : big ? 13.8 + ring * 1.9 : 8.2 + ring * 1.45;
  const x = g.x + Math.sin(ang) * rad;
  const z = g.z + Math.cos(ang) * rad;
  return { x, z, ry: Math.atan2(g.x - x, g.z - z), ang, g, archer };
}

const SWORD_GAP = 3;
const SWORD_FIRST = 3;
const SWORD_WIND = 0.46;
const SWORD_SNAP = 0.14;
const SWORD_FOLLOW = 0.3;
const SWORD_PREP = SWORD_WIND + SWORD_SNAP;
const FLING = 0.86;
const swordPlans = new Map<string, Float64Array>();

export function devSwordPose(t: number) {
  const idle = { armX: 0.22, armZ: 0.34, blade: -0.15 };
  if (t < SWORD_FIRST - SWORD_PREP || t > LAST + SWORD_FOLLOW) return idle;
  const phase = (t - (SWORD_FIRST - SWORD_PREP)) % SWORD_GAP;
  if (phase > SWORD_PREP + SWORD_FOLLOW) return idle;
  if (phase < SWORD_WIND) {
    const raise = Math.sin((phase / SWORD_WIND) * Math.PI * 0.5);
    return { armX: 0.22 - raise * 1.25, armZ: 0.34 + raise * 0.72, blade: -0.15 - raise * 0.85 };
  }
  if (phase < SWORD_PREP) {
    const snap = Math.pow((phase - SWORD_WIND) / SWORD_SNAP, 1.6);
    return { armX: -1.03 + snap * 2.15, armZ: 1.06 - snap * 1.72, blade: -1 + snap * 1.35 };
  }
  const rec = (phase - SWORD_PREP) / SWORD_FOLLOW;
  const e = rec * rec * (3 - 2 * rec);
  return { armX: 1.12 - e * 0.9, armZ: -0.66 + e * 1, blade: 0.35 - e * 0.5 };
}

function swordHits(n: number, big: boolean) {
  const key = `${big ? 1 : 0}:${n}`;
  const hit = swordPlans.get(key);
  if (hit) return hit;
  const die = planOf(n, big).die;
  const at = new Float64Array(n);
  at.fill(1e9);
  const used = new Set<number>();
  for (let k = 0; ; k++) {
    const t = SWORD_FIRST + k * SWORD_GAP;
    if (t > LAST - 0.4) break;
    const g = devGiantAt(t);
    const lx = -Math.cos(g.yaw);
    const lz = Math.sin(g.yaw);
    const scored: { i: number; s: number }[] = [];
    for (let i = 0; i < n; i++) {
      if (used.has(i) || die[i] <= t + 0.12) continue;
      const live = ringAt(i, n, t, big);
      scored.push({ i, s: (live.x - g.x) * lx + (live.z - g.z) * lz });
    }
    scored.sort((a, b) => b.s - a.s || a.i - b.i);
    for (let j = 0; j < 5 && j < scored.length; j++) {
      at[scored[j].i] = t;
      used.add(scored[j].i);
    }
  }
  swordPlans.set(key, at);
  return at;
}

export function devAlive(recT: number, soldiers: number, big = false, sword = false) {
  const n = Math.max(0, Math.floor(soldiers));
  if (n <= 0) return 0;
  const die = planOf(n, big && sword ? big : false).die;
  const slash = sword ? swordHits(n, big) : null;
  const t = Math.max(0, recT);
  let alive = 0;
  for (let i = 0; i < n; i++) {
    const at = slash ? Math.min(die[i], slash[i]) : die[i];
    if (t < at) alive += 1;
  }
  return alive;
}

export function devFriendAt(i: number, n: number, recT: number, out: New1Pose, big = false, sword = false) {
  const count = Math.max(0, Math.floor(n));
  const t = Math.max(0, recT);
  if (i < 0 || i >= count) {
    out.x = 0;
    out.y = -40;
    out.z = 0;
    out.rx = 0;
    out.ry = 0;
    out.rz = 0;
    out.s = 0;
    return;
  }
  const dieAt = planOf(count, big).die[i];
  const slashAt = sword ? swordHits(count, big)[i] : 1e9;
  if (sword && t >= slashAt && t < slashAt + FLING) {
    const live = ringAt(i, count, slashAt, big);
    const g = live.g;
    const lx = -Math.cos(g.yaw);
    const lz = Math.sin(g.yaw);
    const ox = live.x - g.x;
    const oz = live.z - g.z;
    const olen = Math.hypot(ox, oz) || 1;
    const u = (t - slashAt) / FLING;
    const dist = u * u * 16;
    out.x = live.x + (lx * 0.72 + (ox / olen) * 0.5) * dist;
    out.z = live.z + (lz * 0.72 + (oz / olen) * 0.5) * dist;
    out.y = Math.sin(u * Math.PI) * 7.2;
    out.rx = 0.35 + u * 2.6;
    out.ry = live.ry + u * 4;
    out.rz = (i % 2 ? 1 : -1) * u * 1.5;
    out.s = 1;
    return;
  }
  if (t >= dieAt || t >= slashAt) {
    out.x = 0;
    out.y = -40;
    out.z = 0;
    out.rx = 0;
    out.ry = 0;
    out.rz = 0;
    out.s = 0;
    return;
  }
  const live = ringAt(i, count, t, big);
  const bob = Math.sin(t * 8 + i);
  out.x = live.x;
  out.z = live.z;
  out.y = Math.abs(bob) * 0.04;
  out.rx = 0.2 + bob * 0.05;
  out.ry = live.ry;
  out.rz = 0;
  out.s = 1;
}

export function sampleDevCam(recT: number, big = false): ShotPose {
  const t = Math.max(0, recT);
  const g = devGiantAt(t);
  const u = t <= 48 ? 0 : Math.min(1, (t - 48) / 6);
  const e = u * u * (3 - 2 * u);
  const side = (big ? 30 : 28) - e * (big ? 5 : 6);
  const back = (big ? 48 : 46) - e * (big ? 8 : 10);
  const height = (big ? 38 : 34) - e * (big ? 6 : 8);
  return {
    x: g.x + side,
    y: height,
    z: g.z - back,
    lx: g.x,
    ly: big ? 9.2 : 5.4,
    lz: g.z + 2,
    fov: (big ? 44 : 42) - e * (big ? 3 : 4),
  };
}
