export const TEK3_ID = "tek3" as const;
export type Tek3Id = typeof TEK3_ID;
export const TEK3_MODE = { id: TEK3_ID, label: "tek3" } as const;
export const TEK3_SECONDS = 8;
export const TEK3_HERO = "/models/savaci.glb";
export const TEK3_RED = "/models/red.glb";
export const TEK3_ARENA = "/models/arena.glb";
export const TEK3_URLS = [TEK3_HERO, TEK3_RED, TEK3_ARENA] as const;
export const TEK3_OURS = 10;
export const TEK3_PLATE = 0.95;

/**
 * Same aggressive-clip peaks as the tek button.
 * ang = atan2(tipX, tipZ) at holder yaw 0. Reach is 1.24–1.55m.
 */
const STRIKES = [
  { t: 0.5, ang: -2.89, reach: 1.29 },
  { t: 1.05, ang: -1.41, reach: 1.24 },
  { t: 1.24, ang: 2.05, reach: 1.55 },
];
const COMBO = 1.48;
const OPEN = STRIKES[0].t;
const HERO_R = 2.5;
/** Outward slots, nearest first. Every distance is inside the shortest tip. */
const SLOTS = [
  { spread: 0, dist: 1.12 },
  { spread: -0.4, dist: 1.16 },
  { spread: 0.4, dist: 1.16 },
  { spread: -0.75, dist: 1.18 },
  { spread: 0.75, dist: 1.18 },
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
  return i % 2 === 0 ? [3, 2, 2, 3, 2] : [2, 3, 2, 2, 3];
}

function filmOf(n: number) {
  const strike = STRIKES[n % STRIKES.length];
  return Math.floor(n / STRIKES.length) * COMBO + (strike.t - OPEN);
}

function slotAt(needs: number[], n: number) {
  let left = n;
  for (let s = 0; s < needs.length; s++) {
    if (left < needs[s]) return s;
    left -= needs[s];
  }
  return needs.length - 1;
}

function build() {
  const heroes = Array.from({ length: TEK3_OURS }, (_, i) => tek3Hero(i));
  const reds: Tek3Red[] = [];
  const contacts: Array<Array<{ film: number; yaw: number }>> = [];
  heroes.forEach((hero, i) => {
    const needs = needsFor(i);
    const placed = SLOTS.map((slot) => {
      const ang = hero.ang + slot.spread;
      const x = hero.x + Math.sin(ang) * slot.dist;
      const z = hero.z + Math.cos(ang) * slot.dist;
      return { x, z, dx: x - hero.x, dz: z - hero.z };
    });
    let hit = 0;
    placed.forEach((spot, k) => {
      hit += needs[k];
      reds.push({
        x: spot.x,
        z: spot.z,
        yaw: Math.atan2(-spot.dx, -spot.dz),
        die: filmOf(hit - 1),
        hero: i,
      });
    });
    const total = needs.reduce((sum, n) => sum + n, 0);
    const row: Array<{ film: number; yaw: number }> = [];
    for (let n = 0; n < total; n++) {
      const spot = placed[slotAt(needs, n)];
      const strike = STRIKES[n % STRIKES.length];
      row.push({
        film: filmOf(n),
        yaw: Math.atan2(spot.dx, spot.dz) - strike.ang,
      });
    }
    contacts.push(row);
  });
  return { reds, contacts };
}

const BUILT = build();
export const TEK3_REDS: Tek3Red[] = BUILT.reds;

function wrap(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Turns between the tek combo peaks so each tip lands in the nearest living red. */
export function tek3Yaw(i: number, t: number) {
  const row = BUILT.contacts[i];
  const last = row[row.length - 1];
  if (t >= last.film) return last.yaw;
  let prev = row[0];
  let next = last;
  for (let k = 0; k < row.length; k++) {
    if (row[k].film <= t) prev = row[k];
    if (row[k].film >= t) {
      next = row[k];
      break;
    }
  }
  if (next.film <= prev.film) return prev.yaw;
  const u = (t - prev.film) / (next.film - prev.film);
  if (u < 0.18) return prev.yaw;
  if (u > 0.82) return next.yaw;
  const e = (u - 0.18) / 0.64;
  const s = e * e * (3 - 2 * e);
  return prev.yaw + wrap(next.yaw - prev.yaw) * s;
}

/** Same combo clock as tek. Film 0 is the first blade already in a body. After the last hit the pose holds. */
export function tek3ClipTime(i: number, t: number) {
  const row = BUILT.contacts[i];
  const last = row[row.length - 1];
  if (t >= last.film) return STRIKES[(row.length - 1) % STRIKES.length].t;
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

/** Fixed, higher view. The ring fills the frame; the camera does not travel. */
export function tek3Cam(_t: number): Tek3Cam {
  return {
    x: 0.15,
    y: 11.6,
    z: -8.4,
    lx: 0,
    ly: 0.55,
    lz: 0.15,
    fov: 42,
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
