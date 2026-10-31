export const TEK3_ID = "tek3" as const;
export type Tek3Id = typeof TEK3_ID;
export const TEK3_MODE = { id: TEK3_ID, label: "tek3" } as const;
export const TEK3_SECONDS = 32;
export const TEK3_HERO = "/models/savaci.glb";
export const TEK3_RED = "/models/red.glb";
export const TEK3_ARENA = "/models/island-arena.glb";
export const TEK3_URLS = [TEK3_HERO, TEK3_RED, TEK3_ARENA] as const;
export const TEK3_OURS = 10;
export const TEK3_PLATE = 0.95;

/**
 * Aggressive-clip peaks, holder yaw 0, feet at the origin.
 * x/z is the red's chest: the sampled tip passes 0.28m beyond it.
 * Face at the opening peak (t=0.5) is FACE0, so yaw = outward - FACE0
 * puts the chest toward the ring instead of the back.
 */
const STRIKES = [
  { t: 0.5, ang: -2.9, x: -0.24, z: -0.98 },
  { t: 1.05, ang: -1.42, x: -0.95, z: 0.15 },
  { t: 1.24, ang: 2.05, x: 1.13, z: -0.58 },
];
const COMBO = 1.48;
const OPEN = STRIKES[0].t;
const FACE0 = -1.28;
const HERO_R = 2.5;

export type Tek3Hero = { x: number; z: number; ang: number };
export type Tek3Red = { x: number; z: number; yaw: number; die: number; hero: number; slot: number };

function heroAng(i: number) {
  return Math.PI + i * ((Math.PI * 2) / TEK3_OURS);
}

export function tek3Hero(i: number): Tek3Hero {
  const ang = heroAng(i);
  return { x: Math.sin(ang) * HERO_R, z: Math.cos(ang) * HERO_R, ang };
}

/** Front blade, then the side blade, then the inner blade. Same order for every savaci. */
const SLOT_ORDER = [1, 0, 2];

function strikeFilms(slot: number) {
  const offset = STRIKES[slot].t - OPEN;
  const films: number[] = [];
  for (let k = 0; k < 28; k++) films.push(k * COMBO + offset);
  return films;
}

/** Each savaci clears his own three, in sword order, and the next man starts only after that. */
function planDies() {
  const dieAt = Array.from({ length: TEK3_OURS }, () => [0, 0, 0]);
  let prev = -1;
  for (let hero = 0; hero < TEK3_OURS; hero++) {
    for (const slot of SLOT_ORDER) {
      const die = strikeFilms(slot).find((t) => t >= prev + 0.7) ?? prev + 0.7;
      dieAt[hero][slot] = die;
      prev = die;
    }
  }
  return dieAt;
}

const DIE_AT = planDies();

type Hold = { film: number; clip: number; yaw: number };

function build() {
  const heroes = Array.from({ length: TEK3_OURS }, (_, i) => tek3Hero(i));
  const reds: Tek3Red[] = [];
  const holds: Hold[] = [];
  heroes.forEach((hero, i) => {
    const yaw = hero.ang - FACE0;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    let lastFilm = -1;
    let lastClip = STRIKES[0].t;
    STRIKES.forEach((strike, k) => {
      const x = hero.x + strike.x * c + strike.z * s;
      const z = hero.z - strike.x * s + strike.z * c;
      const die = DIE_AT[i][k];
      reds.push({
        x,
        z,
        yaw: Math.atan2(-(x - hero.x), -(z - hero.z)),
        die,
        hero: i,
        slot: k,
      });
      if (die >= lastFilm) {
        lastFilm = die;
        lastClip = strike.t;
      }
    });
    holds.push({ film: lastFilm, clip: lastClip, yaw });
  });
  return { reds, holds };
}

const BUILT = build();
export const TEK3_REDS: Tek3Red[] = BUILT.reds;

/** Chest faces outward for the whole fight. The combo itself turns the blades onto the reds. */
export function tek3Yaw(i: number, _t: number) {
  return BUILT.holds[i].yaw;
}

/** Same combo clock as tek. Film 0 is the first blade already in a body. After the last kill the pose holds. */
export function tek3ClipTime(i: number, t: number) {
  const hold = BUILT.holds[i];
  if (t >= hold.film) return hold.clip;
  const u = OPEN + Math.max(0, t);
  return u - Math.floor(u / COMBO) * COMBO;
}

export function tek3Roster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-TEK3_OURS);
  const out = Array.from({ length: TEK3_OURS }, () => "");
  const start = TEK3_OURS - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

export type Tek3Cam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

const WIDE: Tek3Cam = { x: 0.15, y: 11.6, z: -8.4, lx: 0, ly: 0.55, lz: 0.15, fov: 42 };
const SHOT: Array<"fps" | "wide" | "tps"> = ["fps", "wide", "tps"];

function beatHero(t: number) {
  let hero = 0;
  for (let i = 0; i < TEK3_OURS; i++) {
    const first = Math.min(...DIE_AT[i]);
    if (t >= first - 0.45) hero = i;
  }
  return hero;
}

function victim(hero: number, t: number) {
  const rows = TEK3_REDS.filter((red) => red.hero === hero).sort((a, b) => a.die - b.die);
  const falling = [...rows].reverse().find((red) => red.die <= t && t < red.die + 0.9);
  return falling ?? rows.find((red) => red.die > t) ?? rows[rows.length - 1];
}

/** Wide ring, over-the-shoulder, and eye-level. Each cut stays on the savaci who is killing. */
export function tek3Cam(t: number): Tek3Cam {
  if (t >= DIE_AT[TEK3_OURS - 1][2] + 0.55) return WIDE;
  const hero = beatHero(t);
  const mode = SHOT[hero % SHOT.length];
  if (mode === "wide") return WIDE;
  const man = tek3Hero(hero);
  const red = victim(hero, t);
  const dx = red.x - man.x;
  const dz = red.z - man.z;
  const len = Math.hypot(dx, dz) || 1;
  const fx = dx / len;
  const fz = dz / len;
  if (mode === "fps") {
    return {
      x: man.x + fx * 0.48,
      y: 1.58,
      z: man.z + fz * 0.48,
      lx: red.x,
      ly: 1.12,
      lz: red.z,
      fov: 34,
    };
  }
  return {
    x: man.x - fx * 2.15 + fz * 0.55,
    y: 1.78,
    z: man.z - fz * 2.15 - fx * 0.55,
    lx: red.x * 0.7 + man.x * 0.3,
    ly: 1.15,
    lz: red.z * 0.7 + man.z * 0.3,
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
