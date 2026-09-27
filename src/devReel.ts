import type { ShotPose } from "./shotModes";
import type { New1Pose } from "./new1Reel";

export const DEV_ID = "dev" as const;
export type DevId = typeof DEV_ID;
export const DEV_MODE = { id: DEV_ID, label: "DEV" } as const;

export const DEV2_ID = "dev2" as const;
export type Dev2Id = typeof DEV2_ID;
export type GiantId = DevId | Dev2Id;
export const DEV2_MODE = { id: DEV2_ID, label: "DEV2" } as const;

export function isDev(id: string | null | undefined): id is DevId {
  return id === DEV_ID;
}

export function isDev2(id: string | null | undefined): id is Dev2Id {
  return id === DEV2_ID;
}

export function isGiantShot(id: string | null | undefined): id is GiantId {
  return id === DEV_ID || id === DEV2_ID;
}

export const DEV_SECONDS = 58;
export const DEV2_SECONDS = DEV_SECONDS;
export const DEV_N = 300;
export const DEV2_N = 450;
const FIGHT = 3.2;
const LAST = 52;

type Plan = { die: Float64Array; period: number };

const plans = new Map<number, Plan>();

function planOf(soldiers: number): Plan {
  const n = Math.max(1, Math.floor(soldiers));
  const hit = plans.get(n);
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
  const die = new Float64Array(n);
  let cursor = 0;
  batches.forEach((batch, index) => {
    const t = FIGHT + index * period;
    for (let k = 0; k < batch; k++) die[cursor++] = t;
  });
  const plan = { die, period };
  plans.set(n, plan);
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
  let x: number;
  if (t < FIGHT) {
    const lead = 0.26 * period;
    if (t < FIGHT - lead) return guard;
    x = (t - FIGHT) / period;
  } else if (t > LAST + 0.22) {
    return guard;
  } else {
    x = ((t - FIGHT) % period) / period;
    if (x > 0.55) x -= 1;
  }
  if (x < -0.26 || x > 0.22) {
    const bob = Math.sin(t * 2.6) * 0.04;
    return { pitch: guard.pitch + bob, sweep: bob, twist: 0, dip: 0, lunge: 0 };
  }
  if (x < -0.07) {
    const u = (x + 0.26) / 0.19;
    const raise = Math.sin(Math.min(1, u) * Math.PI * 0.5);
    return {
      pitch: -0.18 - raise * 1.12,
      sweep: -raise * 0.48,
      twist: -raise * 0.36,
      dip: raise * 0.06,
      lunge: -raise * 0.2,
    };
  }
  if (x < 0) {
    const snap = Math.pow((x + 0.07) / 0.07, 1.75);
    return {
      pitch: -1.3 + snap * 2.5,
      sweep: -0.48 + snap * 1.15,
      twist: -0.36 + snap * 0.78,
      dip: 0.06 + snap * 0.22,
      lunge: -0.2 + snap * 1.15,
    };
  }
  const rec = Math.min(1, x / 0.16);
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

export function devAlive(recT: number, soldiers: number) {
  const n = Math.max(0, Math.floor(soldiers));
  if (n <= 0) return 0;
  const die = planOf(n).die;
  const t = Math.max(0, recT);
  let alive = 0;
  for (let i = 0; i < n; i++) if (t < die[i]) alive += 1;
  return alive;
}

export function devFriendAt(i: number, n: number, recT: number, out: New1Pose, big = false) {
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
  const dieAt = planOf(count).die[i];
  if (t >= dieAt) {
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
