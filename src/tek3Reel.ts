export const TEK3_ID = "tek3" as const;
export type Tek3Id = typeof TEK3_ID;
export const TEK3_MODE = { id: TEK3_ID, label: "tek3" } as const;
export const TEK3_SECONDS = 5;
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
const STRIKES = [
  { t: 0.5, ang: -2.89, reach: 1.29 },
  { t: 1.05, ang: -1.41, reach: 1.24 },
  { t: 1.24, ang: 2.05, reach: 1.55 },
];
const OPEN = STRIKES[0].t;
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

const FILMS = STRIKES.map((strike) => strike.t - OPEN);

function build() {
  const heroes = Array.from({ length: TEK3_OURS }, (_, i) => tek3Hero(i));
  const reds: Tek3Red[] = [];
  const yaws: number[][] = [];
  heroes.forEach((hero, i) => {
    const aim: number[] = [];
    SLOTS.forEach((slot, k) => {
      const ang = hero.ang + slot.spread;
      const x = hero.x + Math.sin(ang) * slot.dist;
      const z = hero.z + Math.cos(ang) * slot.dist;
      const dx = x - hero.x;
      const dz = z - hero.z;
      aim.push(Math.atan2(dx, dz) - STRIKES[k].ang);
      reds.push({
        x,
        z,
        yaw: Math.atan2(-dx, -dz),
        die: FILMS[k],
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

/** Holder yaw so this strike's tip lands in that hero's current nearest red. */
export function tek3Yaw(i: number, t: number) {
  const aim = BUILT.yaws[i];
  let prev = 0;
  let next = aim.length - 1;
  for (let k = 0; k < FILMS.length; k++) {
    if (FILMS[k] <= t) prev = k;
    if (FILMS[k] >= t) {
      next = k;
      break;
    }
  }
  if (t >= FILMS[FILMS.length - 1]) return aim[aim.length - 1];
  if (FILMS[next] <= FILMS[prev]) return aim[prev];
  const u = (t - FILMS[prev]) / (FILMS[next] - FILMS[prev]);
  if (u < 0.18) return aim[prev];
  if (u > 0.82) return aim[next];
  const e = (u - 0.18) / 0.64;
  const s = e * e * (3 - 2 * e);
  return aim[prev] + wrap(aim[next] - aim[prev]) * s;
}

/** Film 0 is the first tip already in a body. After the third hit the pose holds there. */
export function tek3ClipTime(t: number) {
  if (t >= FILMS[FILMS.length - 1]) return STRIKES[STRIKES.length - 1].t;
  return OPEN + Math.max(0, t);
}

export function tek3Roster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-TEK3_OURS);
  const out = Array.from({ length: TEK3_OURS }, () => "");
  const start = TEK3_OURS - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

export type Tek3Cam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

/** Further back and higher than the tek close shot, so the ring and the names fit. */
export function tek3Cam(t: number): Tek3Cam {
  const u = Math.max(0, Math.min(1, t / 3));
  return {
    x: 0,
    y: 9.4 + u * 0.6,
    z: -18.8 - u * 0.7,
    lx: 0,
    ly: 0.8,
    lz: 0.15,
    fov: 48,
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
