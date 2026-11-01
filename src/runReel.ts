export const RUN_ID = "run" as const;
export type RunId = typeof RUN_ID;
export const RUN_MODE = { id: RUN_ID, label: "run" } as const;
export const RUN_SECONDS = 60;
export const RUN_HERO = "/models/savaci.glb";
export const RUN_RED = "/models/red.glb";
export const RUN_URLS = [RUN_HERO, RUN_RED] as const;

/** Both sword clips. Each entry is one real swing; one swing drops one man. */
const CLIPS = [
  [
    { t: 0.5, ang: -2.9, reach: 1.29 },
    { t: 1.05, ang: -1.42, reach: 1.24 },
    { t: 1.24, ang: 2.05, reach: 1.55 },
  ],
  [
    { t: 1.22, ang: 0.59, reach: 1.29 },
    { t: 1.44, ang: 1.09, reach: 2.16 },
    { t: 1.88, ang: 0.86, reach: 1.87 },
  ],
] as const;

const SPEED = 4.15;
const BURST = 2.65;
const RATE = 1.32;
const WIND = 0.1;
const TAIL = 0.14;

export type RunHit = { film: number; clip: 0 | 1; t: number; ang: number };
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

function addBurst(clip: 0 | 1) {
  const moves = CLIPS[clip];
  const t0 = cursor;
  const z0 = travel;
  const films = moves.map((swing) => t0 + WIND + (swing.t - moves[0].t) / RATE);
  push(films[films.length - 1] + TAIL - t0, BURST);
  moves.forEach((swing, i) => {
    const film = films[i];
    const hz = z0 + BURST * (film - t0);
    const prevGap = i > 0 ? film - films[i - 1] : 1;
    const dist = Math.min(1.05, Math.max(0.86, swing.reach - 0.22));
    const x = prevGap < 0.28 ? (swing.ang >= 0 ? 0.5 : -0.5) : i % 2 === 0 ? -0.24 : 0.24;
    if (prevGap < 0.28) {
      const prev = foes[foes.length - 1];
      const prevSwing = moves[i - 1];
      const prevDist = Math.min(1.05, Math.max(0.86, prevSwing.reach - 0.22));
      prev.x = -x;
      const prevHz = z0 + BURST * (films[i - 1] - t0);
      prev.z = prevHz + Math.sqrt(Math.max(0.36, prevDist * prevDist - prev.x * prev.x));
    }
    const forward = Math.sqrt(Math.max(0.36, dist * dist - x * x));
    foes.push({
      x,
      z: hz + forward,
      die: film,
      hits: [{ film, clip, t: swing.t, ang: swing.ang }],
    });
  });
}

let round = 0;
while (cursor < 56.5) {
  addBurst((round % 2) as 0 | 1);
  round += 1;
  if (cursor >= 56.5) break;
  push(round % 2 === 0 ? 3 : 1.7, SPEED);
}
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

function hitLimit(hit: RunHit) {
  let near = Infinity;
  for (const foe of foes) {
    for (const other of foe.hits) {
      if (other !== hit) near = Math.min(near, Math.abs(other.film - hit.film));
    }
  }
  if (near < 0.6) return Math.min(0.32, near * 0.5 + 0.02);
  return 0.18;
}

function closestHit(time: number) {
  let best: { foe: RunFoe; hit: RunHit; limit: number } | null = null;
  let bestD = Infinity;
  for (const foe of foes) {
    for (const hit of foe.hits) {
      const limit = hitLimit(hit);
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
  const aim = Math.atan2(near.foe.x, near.foe.z - hz) - near.hit.ang;
  const ad = Math.abs(time - near.hit.film);
  if (ad < 0.05) return aim;
  const u = Math.max(0, (near.limit - ad) / Math.max(0.04, near.limit - 0.05));
  const k = u * u * (3 - 2 * u);
  return aim * k;
}

export function runClip(time: number): { kind: "run" | "agg" | "dual"; time: number } {
  const near = closestHit(time);
  if (!near) return { kind: "run", time: (Math.max(0, time) * 1.35) % 1.25 };
  return {
    kind: near.hit.clip === 0 ? "agg" : "dual",
    time: Math.max(0, near.hit.t + (time - near.hit.film) * RATE),
  };
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
  return { x: 0.65, y: 2.06, z: z - 3.375, lx, ly: 1.12, lz, fov: 36 };
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
