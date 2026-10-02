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

function ringAt(i: number, n: number, t: number, big = false, snake = false) {
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
  if (snake && !archer) {
    const flank = idx % 2 === 0 ? 1 : -1;
    const slots = Math.max(1, Math.ceil(seats / 2));
    const along = slots <= 1 ? 0.5 : Math.floor(idx / 2) / (slots - 1);
    const localZ = 3.6 - along * 17.4;
    const bodyR = 1.35 * (1 - Math.min(1, Math.max(0, (5.4 - localZ) / 22)) * 0.82);
    const localX = flank * (bodyR + 0.55 + ring * 0.62);
    const sc = 1.52;
    const cy = Math.cos(g.yaw);
    const sy = Math.sin(g.yaw);
    const x = g.x + (localX * cy + localZ * sy) * sc;
    const z = g.z + (-localX * sy + localZ * cy) * sc;
    const ax = g.x + localZ * sy * sc;
    const az = g.z + localZ * cy * sc;
    return { x, z, ry: Math.atan2(ax - x, az - z), ang, g, archer };
  }
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

function swordHits(n: number, big: boolean, snake = false) {
  const key = `${big ? 1 : 0}:${snake ? 1 : 0}:${n}`;
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
      const live = ringAt(i, n, t, big, snake);
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

const TAIL_GAP = 3.2;
const TAIL_FIRST = 4.6;
const tailPlans = new Map<string, Float64Array>();

const WAVE_RUN = 1.15;
const WAVE_START = 0.35;

function waveSide(k: number) {
  return (k * 2.399963) % (Math.PI * 2);
}

function waveStep(k: number) {
  let go = WAVE_START;
  for (let i = 0; i <= k; i++) {
    const batch = 10 + ((i * 3) % 11);
    const fight = 1.35 + (i % 4) * 0.2;
    const arrive = go + WAVE_RUN;
    const die = arrive + fight;
    const side = waveSide(i);
    const tail = 0.5 - Math.sin(side) * 0.38 > 0.48;
    if (i === k) return { go, arrive, die, batch, tail, side };
    go = die;
  }
  return { go: 1e9, arrive: 1e9, die: 1e9, batch: 0, tail: true, side: 0 };
}

export function devTailLash(t: number) {
  if (t < WAVE_START || t > LAST + 0.4) return 0;
  for (let i = 0; ; i++) {
    const w = waveStep(i);
    if (w.go > LAST) return 0;
    if (!w.tail) continue;
    const phase = t - (w.die - 0.42);
    if (phase < 0 || phase > 0.72) continue;
    const mag = phase < 0.42 ? Math.sin((phase / 0.42) * Math.PI * 0.5) : Math.sin(((0.72 - phase) / 0.3) * Math.PI * 0.5);
    return mag * (Math.cos(w.side) >= 0 ? 1 : -1);
  }
}

export function devSnakeBite(t: number) {
  if (t < WAVE_START || t > LAST + 0.4) return 0;
  for (let i = 0; ; i++) {
    const w = waveStep(i);
    if (w.go > LAST) return 0;
    if (w.tail) continue;
    const phase = t - (w.die - 0.34);
    if (phase < 0 || phase > 0.58) continue;
    if (phase < 0.34) return Math.sin((phase / 0.34) * Math.PI * 0.5);
    return Math.max(0, 1 - (phase - 0.34) / 0.24);
  }
}

type SnakePlan = { go: Float64Array; arrive: Float64Array; die: Float64Array; slot: Uint16Array; batch: Uint8Array; tail: Uint8Array; side: Float32Array };
const snakePlans = new Map<number, SnakePlan>();

function snakePlan(n: number) {
  const hit = snakePlans.get(n);
  if (hit) return hit;
  const meleeN = Math.ceil(n / 2);
  const go = new Float64Array(n);
  const arrive = new Float64Array(n);
  const die = new Float64Array(n);
  const slot = new Uint16Array(n);
  const batchOf = new Uint8Array(n);
  const tail = new Uint8Array(n);
  const side = new Float32Array(n);
  go.fill(1e9);
  arrive.fill(1e9);
  die.fill(1e9);
  let cursor = 0;
  for (let k = 0; cursor < meleeN; k++) {
    const w = waveStep(k);
    if (w.go > LAST - 0.6) break;
    const batch = Math.min(w.batch, meleeN - cursor);
    for (let j = 0; j < batch; j++) {
      const i = cursor + j;
      go[i] = w.go;
      arrive[i] = w.arrive;
      die[i] = w.die;
      slot[i] = j;
      batchOf[i] = batch;
      tail[i] = w.tail ? 1 : 0;
      side[i] = w.side;
    }
    cursor += batch;
  }
  const plan = { go, arrive, die, slot, batch: batchOf, tail, side };
  snakePlans.set(n, plan);
  return plan;
}

function snakeWorld(g: { x: number; z: number; yaw: number }, lx: number, lz: number) {
  const sc = 1.52;
  const cy = Math.cos(g.yaw);
  const sy = Math.sin(g.yaw);
  return { x: g.x + (lx * cy + lz * sy) * sc, z: g.z + (-lx * sy + lz * cy) * sc };
}

function snakeRing(local: number, count: number, g: { x: number; z: number }, base: number, gap: number, per: number) {
  const n = Math.max(1, count);
  const ring = Math.floor(local / per);
  const idx = local % per;
  const seats = Math.max(1, Math.min(per, n - ring * per));
  const ang = (idx / seats) * Math.PI * 2 + ring * 0.47;
  const rad = base + ring * gap;
  const x = g.x + Math.sin(ang) * rad;
  const z = g.z + Math.cos(ang) * rad;
  return { x, z, ry: Math.atan2(g.x - x, g.z - z) };
}

function snakeHold(i: number, n: number, g: { x: number; z: number; yaw: number }) {
  return snakeRing(i, Math.ceil(n / 2), g, 18, 1.75, 32);
}

function snakeStrike(slot: number, batch: number, side: number, g: { x: number; z: number; yaw: number }) {
  const flank = Math.cos(side) >= 0 ? 1 : -1;
  const along = 0.5 - Math.sin(side) * 0.38;
  const localZ = 4.4 - along * 18.2;
  const bodyR = 1.35 * (1 - Math.min(1, Math.max(0, (5.4 - localZ) / 22)) * 0.82);
  const col = slot % 5;
  const row = Math.floor(slot / 5);
  const spread = 0.58 + Math.min(0.55, batch * 0.03);
  const z = localZ + (col - 2) * spread + ((slot * 3) % 5) * 0.07;
  const x = flank * (bodyR + 0.46 + row * 0.55);
  const at = snakeWorld(g, x, z);
  const axis = snakeWorld(g, 0, z);
  return { ...at, ry: Math.atan2(axis.x - at.x, axis.z - at.z) };
}

export function devSnakeStriking(i: number, n: number, recT: number) {
  const count = Math.max(0, Math.floor(n));
  if (i < 0 || i >= count || devIsArcher(i, count)) return false;
  const plan = snakePlan(count);
  const t = Math.max(0, recT);
  return t >= plan.arrive[i] && t < plan.die[i];
}

function snakeFriendAt(i: number, n: number, t: number, out: New1Pose) {
  const g = devGiantAt(t);
  if (devIsArcher(i, n)) {
    const meleeN = Math.ceil(n / 2);
    const at = snakeRing(i - meleeN, n - meleeN, g, 34, 2.05, 44);
    out.x = at.x;
    out.z = at.z;
    out.y = Math.abs(Math.sin(t * 6 + i)) * 0.03;
    out.rx = 0.12;
    out.ry = at.ry;
    out.rz = 0;
    out.s = 1;
    return;
  }
  const plan = snakePlan(n);
  const dieAt = plan.die[i];
  if (t >= dieAt && t < dieAt + FLING) {
    const gg = devGiantAt(dieAt);
    const live = snakeStrike(plan.slot[i], plan.batch[i], plan.side[i], gg);
    const u = (t - dieAt) / FLING;
    const dist = u * u * 16;
    const flank = Math.cos(plan.side[i]) >= 0 ? 1 : -1;
    const along = Math.sin(plan.side[i]);
    const sx = Math.cos(gg.yaw) * flank + Math.sin(gg.yaw) * along * 0.45;
    const sz = -Math.sin(gg.yaw) * flank + Math.cos(gg.yaw) * along * 0.45;
    out.x = live.x + sx * dist;
    out.z = live.z + sz * dist;
    out.y = Math.sin(u * Math.PI) * 6.2;
    out.rx = 0.4 + u * 2.2;
    out.ry = live.ry + u * 4;
    out.rz = flank * u * 1.3;
    out.s = 1;
    return;
  }
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
  const hold = snakeHold(i, n, g);
  const strike = snakeStrike(plan.slot[i], Math.max(1, plan.batch[i]), plan.side[i], g);
  const goAt = plan.go[i];
  const arriveAt = plan.arrive[i];
  let x = hold.x;
  let z = hold.z;
  let rx = 0.12 + Math.abs(Math.sin(t * 8 + i)) * 0.05;
  let ry = hold.ry;
  if (t >= arriveAt) {
    x = strike.x;
    z = strike.z;
    ry = strike.ry;
    rx = 0.42 + Math.max(0, Math.sin(t * 11 + i)) * 0.22;
  } else if (t >= goAt) {
    const u = (t - goAt) / Math.max(0.2, arriveAt - goAt);
    const e = u * u * (3 - 2 * u);
    x = hold.x + (strike.x - hold.x) * e;
    z = hold.z + (strike.z - hold.z) * e;
    ry = Math.atan2(strike.x - hold.x, strike.z - hold.z);
    rx = 0.62;
  }
  out.x = x;
  out.z = z;
  out.y = t >= goAt && t < arriveAt ? Math.abs(Math.sin(t * 16 + i)) * 0.16 : Math.abs(Math.sin(t * 8 + i)) * 0.04;
  out.rx = rx;
  out.ry = ry;
  out.rz = 0;
  out.s = 1;
}

function tailHits(n: number) {
  const key = String(n);
  const hit = tailPlans.get(key);
  if (hit) return hit;
  const die = planOf(n, true).die;
  const slash = swordHits(n, true, true);
  const at = new Float64Array(n);
  at.fill(1e9);
  const used = new Set<number>();
  for (let k = 0; ; k++) {
    const t = TAIL_FIRST + k * TAIL_GAP;
    if (t > LAST - 0.4) break;
    const g = devGiantAt(t);
    const tx = -Math.sin(g.yaw);
    const tz = -Math.cos(g.yaw);
    const batch = 5 + (k % 6);
    const scored: { i: number; s: number }[] = [];
    for (let i = 0; i < n; i++) {
      if (used.has(i) || die[i] <= t + 0.12 || slash[i] <= t + 0.12) continue;
      if (devIsArcher(i, n)) continue;
      const live = ringAt(i, n, t, true, true);
      scored.push({ i, s: (live.x - g.x) * tx + (live.z - g.z) * tz });
    }
    scored.sort((a, b) => b.s - a.s || a.i - b.i);
    for (let j = 0; j < batch && j < scored.length; j++) {
      at[scored[j].i] = t;
      used.add(scored[j].i);
    }
  }
  tailPlans.set(key, at);
  return at;
}

export function devAlive(recT: number, soldiers: number, big = false, sword = false, snake = false) {
  const n = Math.max(0, Math.floor(soldiers));
  if (n <= 0) return 0;
  if (snake) {
    const plan = snakePlan(n);
    const t = Math.max(0, recT);
    let alive = 0;
    for (let i = 0; i < n; i++) if (t < plan.die[i]) alive += 1;
    return alive;
  }
  const die = planOf(n, big && sword ? big : false).die;
  const slash = sword ? swordHits(n, big, snake) : null;
  const tail = snake ? tailHits(n) : null;
  const t = Math.max(0, recT);
  let alive = 0;
  for (let i = 0; i < n; i++) {
    let at = die[i];
    if (slash) at = Math.min(at, slash[i]);
    if (tail) at = Math.min(at, tail[i]);
    if (t < at) alive += 1;
  }
  return alive;
}

export function devFriendAt(i: number, n: number, recT: number, out: New1Pose, big = false, sword = false, snake = false) {
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
  if (snake) {
    snakeFriendAt(i, count, t, out);
    return;
  }
  const dieAt = planOf(count, big).die[i];
  const slashAt = sword ? swordHits(count, big, snake)[i] : 1e9;
  const tailAt = snake ? tailHits(count)[i] : 1e9;
  if (snake && t >= tailAt && t < tailAt + FLING) {
    const live = ringAt(i, count, tailAt, big, true);
    const g = live.g;
    const tx = -Math.sin(g.yaw);
    const tz = -Math.cos(g.yaw);
    const dir = Math.sign(devTailLash(tailAt + 0.02)) || 1;
    const sx = Math.cos(g.yaw) * dir;
    const sz = -Math.sin(g.yaw) * dir;
    const u = (t - tailAt) / FLING;
    const dist = u * u * 18;
    out.x = live.x + (sx * 0.78 + tx * 0.45) * dist;
    out.z = live.z + (sz * 0.78 + tz * 0.45) * dist;
    out.y = Math.sin(u * Math.PI) * 6.6;
    out.rx = 0.4 + u * 2.4;
    out.ry = live.ry + u * 5;
    out.rz = (i % 2 ? 1 : -1) * u * 1.6;
    out.s = 1;
    return;
  }
  if (sword && t >= slashAt && t < slashAt + FLING) {
    const live = ringAt(i, count, slashAt, big, snake);
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
  if (t >= dieAt || t >= slashAt || t >= tailAt) {
    out.x = 0;
    out.y = -40;
    out.z = 0;
    out.rx = 0;
    out.ry = 0;
    out.rz = 0;
    out.s = 0;
    return;
  }
  const live = ringAt(i, count, t, big, snake);
  const bob = Math.sin(t * 8 + i);
  out.x = live.x;
  out.z = live.z;
  out.y = Math.abs(bob) * 0.04;
  out.rx = snake && !live.archer ? 0.35 + Math.max(0, Math.sin(t * 10 + i)) * 0.28 : 0.2 + bob * 0.05;
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
