export const TEK_ID = "tek" as const;
export type TekId = typeof TEK_ID;
export const TEK_MODE = { id: TEK_ID, label: "tek" } as const;
export const TEK_SECONDS = 10;
export const TEK_HERO = "/models/savaci.glb";
export const TEK_RED = "/models/red.glb";
export const TEK_ARENA = "/models/arena.glb";
export const TEK_URLS = [TEK_HERO, TEK_RED, TEK_ARENA] as const;

export type TekFoe = { ang: number; hits: 1 | 2; die: number };

/**
 * Sword-tip peaks of the aggressive clip, in the fitted model (holder yaw 0).
 * ang = atan2(tipX, tipZ). The blade reaches about 1.24–1.55m.
 */
const STRIKES = [
  { t: 0.5, ang: -2.89 },
  { t: 1.05, ang: -1.41 },
  { t: 1.24, ang: 2.05 },
];
const COMBO = 1.48;
const OPEN = STRIKES[0].t;
const RING = 1.15;

const NEED: Array<1 | 2> = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];

function buildFoes(): TekFoe[] {
  const got = Array(NEED.length).fill(0);
  const plan: number[] = [];
  let cursor = 0;
  const total = NEED.reduce((sum, n) => sum + n, 0);
  while (plan.length < total) {
    let guard = 0;
    while (got[cursor] >= NEED[cursor] && guard < NEED.length) {
      cursor = (cursor + 1) % NEED.length;
      guard += 1;
    }
    plan.push(cursor);
    got[cursor] += 1;
    cursor = (cursor + 1) % NEED.length;
  }
  const dieAt = Array(NEED.length).fill(0);
  const seen = Array(NEED.length).fill(0);
  plan.forEach((foe, i) => {
    const strike = STRIKES[i % STRIKES.length];
    const film = Math.floor(i / STRIKES.length) * COMBO + (strike.t - OPEN);
    seen[foe] += 1;
    if (seen[foe] === NEED[foe]) dieAt[foe] = film;
  });
  return NEED.map((hits, i) => ({
    ang: -Math.PI + (i + 0.5) * ((Math.PI * 2) / NEED.length),
    hits,
    die: dieAt[i],
  }));
}

export const TEK_FOES: TekFoe[] = buildFoes();

export function tekSpot(i: number) {
  const ang = TEK_FOES[i].ang;
  const x = Math.sin(ang) * RING;
  const z = Math.cos(ang) * RING;
  return { x, z, yaw: Math.atan2(-x, -z) };
}

/** Clip time so film 0 is the first blade already in a body. */
export function tekClipTime(t: number) {
  const u = OPEN + Math.max(0, t);
  return u - Math.floor(u / COMBO) * COMBO;
}

function contactYaw(index: number) {
  const got = Array(NEED.length).fill(0);
  const plan: number[] = [];
  let cursor = 0;
  const total = NEED.reduce((sum, n) => sum + n, 0);
  while (plan.length < total) {
    let guard = 0;
    while (got[cursor] >= NEED[cursor] && guard < NEED.length) {
      cursor = (cursor + 1) % NEED.length;
      guard += 1;
    }
    plan.push(cursor);
    got[cursor] += 1;
    cursor = (cursor + 1) % NEED.length;
  }
  const strike = STRIKES[index % STRIKES.length];
  return TEK_FOES[plan[index]].ang - strike.ang;
}

const CONTACTS = Array.from({ length: NEED.reduce((s, n) => s + n, 0) }, (_, i) => {
  const strike = STRIKES[i % STRIKES.length];
  return {
    film: Math.floor(i / STRIKES.length) * COMBO + (strike.t - OPEN),
    yaw: contactYaw(i),
  };
});

export function tekHeroYaw(t: number) {
  let prev = CONTACTS[0];
  let next = CONTACTS[CONTACTS.length - 1];
  for (let i = 0; i < CONTACTS.length; i++) {
    if (CONTACTS[i].film <= t) prev = CONTACTS[i];
    if (CONTACTS[i].film >= t) {
      next = CONTACTS[i];
      break;
    }
  }
  if (next.film <= prev.film) return prev.yaw;
  const u = (t - prev.film) / (next.film - prev.film);
  if (u < 0.18) return prev.yaw;
  if (u > 0.82) return next.yaw;
  const e = (u - 0.18) / 0.64;
  const s = e * e * (3 - 2 * e);
  const d = Math.atan2(Math.sin(next.yaw - prev.yaw), Math.cos(next.yaw - prev.yaw));
  return prev.yaw + d * s;
}

export type TekCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

export function tekCam(t: number): TekCam {
  if (t < 0.9) return { x: 0.2, y: 2.2, z: -6.2, lx: 0, ly: 0.95, lz: -0.15, fov: 44 };
  if (t > 8.2) return { x: 0.05, y: 2.55, z: -6.7, lx: 0, ly: 0.85, lz: 0, fov: 46 };
  return { x: 0.1, y: 2.7, z: -7.15, lx: 0, ly: 0.75, lz: 0, fov: 48 };
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function tekMarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function tekIsReady() {
  return ready;
}

export function tekWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function tekHold() {
  playAt = 0;
}

export function tekStart() {
  playAt = performance.now() / 1000;
}

export function tekT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function tekReset() {
  ready = false;
  playAt = 0;
}

export function isTek(id: string | null | undefined): id is TekId {
  return id === TEK_ID;
}
