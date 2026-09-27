import type { ShotPose } from "./shotModes";
import type { New1Pose } from "./new1Reel";

export const DEV_ID = "dev" as const;
export type DevId = typeof DEV_ID;
export const DEV_MODE = { id: DEV_ID, label: "DEV" } as const;

export function isDev(id: string | null | undefined): id is DevId {
  return id === DEV_ID;
}

export const DEV_SECONDS = 58;
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

export function devGiantAt(t: number) {
  const u = Math.max(0, t);
  const ang = u * 0.36;
  const x = Math.sin(ang) * 7;
  const z = Math.cos(ang * 0.77) * 5;
  const dx = Math.cos(ang) * 7 * 0.36;
  const dz = -Math.sin(ang * 0.77) * 5 * 0.77;
  return { x, z, yaw: Math.atan2(dx, dz || 0.001) };
}

export function devClubHit(t: number, soldiers: number) {
  if (t < FIGHT || t > LAST + 0.35) return 0;
  const phase = ((t - FIGHT) % planOf(soldiers).period) / planOf(soldiers).period;
  if (phase > 0.22) return 0;
  return Math.sin((phase / 0.22) * Math.PI);
}

export function devIsArcher(i: number, n: number) {
  return i >= Math.ceil(Math.max(1, n) / 2);
}

export function devIsSpear(i: number, n: number) {
  return !devIsArcher(i, n) && i % 2 === 1;
}

function ringAt(i: number, n: number, t: number) {
  const g = devGiantAt(t);
  const archer = devIsArcher(i, n);
  const meleeN = Math.ceil(n / 2);
  const local = archer ? i - meleeN : i;
  const count = Math.max(1, archer ? n - meleeN : meleeN);
  const per = archer ? 42 : 26;
  const ring = Math.floor(local / per);
  const idx = local % per;
  const seats = Math.max(1, Math.min(per, count - ring * per));
  const ang = (idx / seats) * Math.PI * 2 + ring * 0.47 + (archer ? 0.2 : 0);
  const rad = archer ? 16.5 + ring * 1.55 : 5.5 + ring * 1.2;
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

export function devFriendAt(i: number, n: number, recT: number, out: New1Pose) {
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
  const live = ringAt(i, count, Math.min(t, dieAt));
  out.ry = live.ry;
  out.rz = 0;
  out.s = 1;
  if (t < dieAt) {
    const bob = Math.sin(t * 8 + i);
    out.x = live.x;
    out.z = live.z;
    out.y = Math.abs(bob) * 0.04;
    out.rx = 0.2 + bob * 0.05;
    return;
  }
  const age = t - dieAt;
  if (age > 1.55) {
    out.x = live.x;
    out.z = live.z;
    out.y = -40;
    out.rx = 1.4;
    out.s = 0;
    return;
  }
  const fly = Math.min(1, age / 0.72);
  const g = devGiantAt(dieAt);
  const rx = Math.cos(g.yaw);
  const rz = -Math.sin(g.yaw);
  const ox = Math.sin(live.ang);
  const oz = Math.cos(live.ang);
  const dirX = live.archer ? ox : rx * 0.86 + ox * 0.28;
  const dirZ = live.archer ? oz : rz * 0.86 + oz * 0.28;
  const dist = (live.archer ? 8 : 12) + (i % 8) * 0.85;
  out.x = live.x + dirX * dist * fly;
  out.z = live.z + dirZ * dist * fly;
  out.y = Math.sin(fly * Math.PI) * (3.6 + (i % 5) * 0.45);
  out.rx = 0.4 + fly * 1.35;
  out.ry = live.ry + fly * 2.2;
}

export function sampleDevCam(recT: number): ShotPose {
  const t = Math.max(0, recT);
  const g = devGiantAt(t);
  const u = t <= 48 ? 0 : Math.min(1, (t - 48) / 6);
  const e = u * u * (3 - 2 * u);
  const side = 16 - e * 6;
  const back = 28 - e * 12;
  const height = 24 - e * 8;
  return {
    x: g.x + side,
    y: height,
    z: g.z - back,
    lx: g.x,
    ly: 5.4 + e * 1.2,
    lz: g.z + 1.2,
    fov: 46 - e * 8,
  };
}
