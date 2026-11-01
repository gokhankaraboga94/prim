export const RUN_ID = "run" as const;
export type RunId = typeof RUN_ID;
export const RUN_MODE = { id: RUN_ID, label: "run" } as const;
export const RUN_SECONDS = 60;
export const RUN_HERO = "/models/savaci.glb";
export const RUN_RED = "/models/red.glb";
export const RUN_URLS = [RUN_HERO, RUN_RED] as const;

/** Aggressive clip, frames where the blade points with the chest. */
const STRIKES = [
  { t: 0.87, ang: 0.57, reach: 1.01 },
  { t: 1.54, ang: -0.27, reach: 0.87 },
] as const;

const SPEED = 4.15;
const CRAWL = 0.06;
const INSET = 0.22;
const WIND = 0.16;
const TAIL = 0.2;
const COMBO = 0.67;

export type RunHit = { film: number; strike: 0 | 1 };
export type RunFoe = { x: number; z: number; die: number; hits: RunHit[] };
export type RunCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

type Span = { t0: number; t1: number; z0: number; v: number };

const spans: Span[] = [];
const foes: RunFoe[] = [];
let cursor = 0;
let travel = 0;

function push(dur: number, v: number) {
  spans.push({ t0: cursor, t1: cursor + dur, z0: travel, v });
  travel += v * dur;
  cursor += dur;
}

function addSolo(hits: 1 | 2) {
  const films = [cursor + WIND];
  if (hits === 2) films.push(films[0] + COMBO);
  const zHit = travel + CRAWL * WIND;
  const dist = STRIKES[0].reach - INSET;
  push(films[films.length - 1] + TAIL - cursor, CRAWL);
  foes.push({
    x: 0,
    z: zHit + dist,
    die: films[films.length - 1],
    hits: films.map((film, i) => ({ film, strike: (i === 0 ? 0 : 1) as 0 | 1 })),
  });
}

function addPair() {
  const f0 = cursor + WIND;
  const f1 = f0 + COMBO;
  const z0 = travel + CRAWL * WIND;
  const z1 = travel + CRAWL * (WIND + COMBO);
  push(f1 + TAIL - cursor, CRAWL);
  const d0 = STRIKES[0].reach - INSET;
  const d1 = STRIKES[1].reach - INSET;
  const a0 = 0.34;
  const a1 = -0.34;
  foes.push({
    x: Math.sin(a0) * d0,
    z: z0 + Math.cos(a0) * d0,
    die: f0,
    hits: [{ film: f0, strike: 0 }],
  });
  foes.push({
    x: Math.sin(a1) * d1,
    z: z1 + Math.cos(a1) * d1,
    die: f1,
    hits: [{ film: f1, strike: 1 }],
  });
}

const BEATS = ["1", "c", "1", "g", "2", "c", "p", "c", "1", "g", "2", "c", "1", "c", "p", "g", "1", "c", "2", "c", "p", "c", "1", "g"] as const;
let beat = 0;
while (cursor < 52) {
  const step = BEATS[beat % BEATS.length];
  beat += 1;
  if (step === "1") addSolo(1);
  else if (step === "2") addSolo(2);
  else if (step === "p") addPair();
  else if (step === "c") push(0.78, SPEED);
  else push(3, SPEED);
}
push(0.7, SPEED);
addSolo(2);
push(0.62, SPEED);
addPair();
push(0.55, SPEED);
addSolo(1);
if (cursor < RUN_SECONDS) push(RUN_SECONDS - cursor, SPEED);

export const RUN_FOES: readonly RunFoe[] = foes;
export const RUN_SPAN = travel + 16;

export function runHeroZ(time: number) {
  const t = Math.max(0, time);
  for (const span of spans) {
    if (t <= span.t1) return span.z0 + span.v * (t - span.t0);
  }
  const last = spans[spans.length - 1];
  return last.z0 + last.v * (last.t1 - last.t0);
}

function neighbor(hit: RunHit) {
  for (const foe of foes) {
    for (const other of foe.hits) {
      if (other !== hit && Math.abs(other.film - hit.film) < 0.75) return true;
    }
  }
  return false;
}

function closestHit(time: number) {
  let best: { foe: RunFoe; hit: RunHit; limit: number } | null = null;
  let bestD = Infinity;
  for (const foe of foes) {
    for (const hit of foe.hits) {
      const limit = neighbor(hit) ? 0.36 : 0.2;
      const d = Math.abs(time - hit.film);
      if (d <= limit && d < bestD) {
        best = { foe, hit, limit };
        bestD = d;
      }
    }
  }
  return best;
}

export function runYaw(time: number) {
  const near = closestHit(time);
  if (!near) return 0;
  const hz = runHeroZ(time);
  const aim = Math.atan2(near.foe.x, near.foe.z - hz) - STRIKES[near.hit.strike].ang;
  const ad = Math.abs(time - near.hit.film);
  if (ad < 0.07) return aim;
  const u = Math.max(0, (near.limit - ad) / (near.limit - 0.07));
  const k = u * u * (3 - 2 * u);
  return aim * k;
}

export function runClip(time: number): { kind: "run" | "atk"; time: number } {
  const near = closestHit(time);
  if (!near) return { kind: "run", time: (Math.max(0, time) * 1.35) % 1.25 };
  const strike = STRIKES[near.hit.strike];
  return { kind: "atk", time: Math.max(0, strike.t + (time - near.hit.film)) };
}

export function runCam(time: number): RunCam {
  const z = runHeroZ(time);
  let lx = 0.05;
  let lz = z + 3.6;
  for (const foe of foes) {
    if (time > foe.die + 0.7) continue;
    const dz = foe.z - z;
    if (dz > -0.2 && dz < 6.2) {
      lx = foe.x * 0.35;
      lz = foe.z;
      break;
    }
  }
  return { x: 0.52, y: 1.88, z: z - 2.7, lx, ly: 1.12, lz, fov: 36 };
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function runMarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function runIsReady() {
  return ready;
}

export function runWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function runHold() {
  playAt = 0;
}

export function runStart() {
  playAt = performance.now() / 1000;
}

export function runT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function runReset() {
  ready = false;
  playAt = 0;
}

export function isRun(id: string | null | undefined): id is RunId {
  return id === RUN_ID;
}
