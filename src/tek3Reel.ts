export const TEK3_ID = "tek3" as const;
export type Tek3Id = typeof TEK3_ID;
export const TEK3_MODE = { id: TEK3_ID, label: "tek3" } as const;
export const TEK3_SECONDS = 26;
export const TEK3_HERO = "/models/savaci.glb";
export const TEK3_RED = "/models/red.glb";
export const TEK3_ARENA = "/models/arena.glb";
export const TEK3_URLS = [TEK3_HERO, TEK3_RED, TEK3_ARENA] as const;
export const TEK3_OURS = 10;
export const TEK3_PLATE = 0.42;

/**
 * Sword-tip peaks of the aggressive clip, fitted model, holder yaw 0.
 * ang = atan2(tipX, tipZ). reach is how far the tip is from the body.
 */
/** One peak, repeated. Reach 1.29 covers every slot. */
const STRIKE = { t: 0.5, ang: -2.89, reach: 1.29 };
const WIND = 0.22;
const STEP = 1.8;
const HERO_R = 3.15;
/** Outward slots, nearest first. Each stays inside that strike's tip and this hero's sector. */
const SLOTS = [
  { spread: 0, dist: 1.08 },
  { spread: -0.66, dist: 1.14 },
  { spread: 0.66, dist: 1.2 },
];

export type Tek3Hero = { x: number; z: number; ang: number };
export type Tek3Red = { x: number; z: number; yaw: number; die: number; hero: number };

function heroAng(i: number) {
  return Math.PI + i * ((Math.PI * 2) / TEK3_OURS);
}

export function tek3Hero(i: number): Tek3Hero {
  const ang = heroAng(i);
  return { x: Math.sin(ang) * HERO_R, z: Math.cos(ang) * HERO_R, ang };
}

function needsFor(i: number) {
  return i % 2 === 0 ? [5, 4, 5] : [4, 5, 4];
}

function phase(i: number) {
  return (i * STEP) / TEK3_OURS;
}

function build() {
  const heroes = Array.from({ length: TEK3_OURS }, (_, i) => tek3Hero(i));
  const reds: Tek3Red[] = [];
  const yaws: number[][] = [];
  heroes.forEach((hero, i) => {
    const aim: number[] = [];
    const needs = needsFor(i);
    let hit = 0;
    SLOTS.forEach((slot, k) => {
      const ang = hero.ang + slot.spread;
      const x = hero.x + Math.sin(ang) * slot.dist;
      const z = hero.z + Math.cos(ang) * slot.dist;
      const dx = x - hero.x;
      const dz = z - hero.z;
      aim.push(Math.atan2(dx, dz) - STRIKE.ang);
      hit += needs[k];
      reds.push({
        x,
        z,
        yaw: Math.atan2(-dx, -dz),
        die: (hit - 1) * STEP - phase(i),
        hero: i,
      });
    });
    yaws.push(aim);
  });
  return { reds, yaws };
}

const BUILT = build();
export const TEK3_REDS: Tek3Red[] = BUILT.reds;

function wrap(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

const HOLD = 0.72 * STEP;

/** Holder yaw so the repeated peak stays in this hero's nearest living red. */
export function tek3Yaw(i: number, t: number) {
  const mine = TEK3_REDS.filter((red) => red.hero === i);
  let slot = mine.length - 1;
  for (let s = 0; s < mine.length; s++) {
    if (t < mine[s].die + HOLD) {
      slot = s;
      break;
    }
  }
  const aim = BUILT.yaws[i][slot];
  if (slot >= mine.length - 1) return aim;
  const into = t - mine[slot].die;
  if (into <= HOLD) return aim;
  const e = Math.max(0, Math.min(1, (into - HOLD) / (STEP - HOLD)));
  const s = e * e * (3 - 2 * e);
  return aim + wrap(BUILT.yaws[i][slot + 1] - aim) * s;
}

/** Film 0 is the tip already in a body. The same peak repeats; after the last hit it stays there. */
export function tek3ClipTime(i: number, t: number) {
  const needs = needsFor(i);
  const total = needs.reduce((sum, n) => sum + n, 0);
  const local = Math.max(0, t + phase(i));
  if (local >= (total - 1) * STEP) return STRIKE.t;
  const u = local / STEP - Math.floor(local / STEP);
  if (u > 0.72) {
    const e = (u - 0.72) / 0.28;
    return WIND + e * (STRIKE.t - WIND);
  }
  return STRIKE.t;
}

export function tek3Roster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-TEK3_OURS);
  const out = Array.from({ length: TEK3_OURS }, () => "");
  const start = TEK3_OURS - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

export type Tek3Cam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

/** Inside the arena, one full circle, same height the whole way. */
export function tek3Cam(t: number): Tek3Cam {
  const ang = Math.PI + (t / TEK3_SECONDS) * Math.PI * 2;
  const radius = 6.2;
  return {
    x: Math.sin(ang) * radius,
    y: 2.15,
    z: Math.cos(ang) * radius,
    lx: 0,
    ly: 1.05,
    lz: 0,
    fov: 40,
  };
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function tek3MarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function tek3IsReady() {
  return ready;
}

export function tek3WhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function tek3Hold() {
  playAt = 0;
}

export function tek3Start() {
  playAt = performance.now() / 1000;
}

export function tek3T() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function tek3Reset() {
  ready = false;
  playAt = 0;
}

export function isTek3(id: string | null | undefined): id is Tek3Id {
  return id === TEK3_ID;
}
