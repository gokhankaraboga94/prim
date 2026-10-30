export const KIRMIZI_ID = "kirmizi-mavi" as const;
export type KirmiziId = typeof KIRMIZI_ID;
export const KIRMIZI_MODE = { id: KIRMIZI_ID, label: "kırmızı-mavi" } as const;
export const KIRMIZI_SECONDS = 48;
export const KIRMIZI_BLUE = "/models/blue.glb";
export const KIRMIZI_RED = "/models/red.glb";
export const KIRMIZI_URLS = [KIRMIZI_BLUE, KIRMIZI_RED] as const;

export const BLUE_N = 25;
export const RED_N = 40;

/** Names stay off through the two opening shots. */
const NAMES_AT = 3.7;
/** The blue standing in front of the opening sword. He falls on the second shot. */
const OPEN_VICTIM = 2;
const OPEN_FALL = 1.12;
const RED_SWING = 1.92;
const BLUE_SWING = 2.71;
const COMBO = 2.96;

export type KirmiziWho = "blue" | "red";

export type KirmiziPose = {
  x: number;
  z: number;
  yaw: number;
  rx: number;
  clip: string;
  time: number;
  dead: boolean;
};

export function kirmiziRoster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-BLUE_N);
  const out = Array.from({ length: BLUE_N }, () => "");
  const start = BLUE_N - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

/** Front ranks already stand in sword range. They do not spend the opening walking in. */
export function kirmiziSeat(who: KirmiziWho, i: number) {
  if (who === "blue") {
    const col = i % 5;
    const row = Math.floor(i / 5);
    return { x: (col - 2) * 1.22, z: -0.78 - row * 1.16, yaw: 0 };
  }
  const col = i % 8;
  const row = Math.floor(i / 8);
  return { x: (col - 3.5) * 1.02, z: 0.64 + row * 1.06, yaw: Math.PI };
}

function unit(i: number, salt: number) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function pickDeaths(n: number, take: number, start: number, end: number, salt: number, skip: number[] = []) {
  const banned = new Set(skip);
  const ids = Array.from({ length: n }, (_, i) => i).filter((i) => !banned.has(i));
  ids.sort((a, b) => unit(a, salt) - unit(b, salt));
  const at = new Map<number, number>();
  const count = Math.min(take, ids.length);
  for (let k = 0; k < count; k++) {
    const i = ids[k];
    const u = (k + unit(i, salt + 9) * 0.72) / count;
    at.set(i, start + Math.min(0.97, u) * (end - start));
  }
  return at;
}

const blueDeaths = pickDeaths(BLUE_N, 8, 6.4, 32, 4, [OPEN_VICTIM]);
blueDeaths.set(OPEN_VICTIM, OPEN_FALL);
const redEarly = pickDeaths(RED_N, 22, 5.2, 34, 11);
const redDeaths = pickDeaths(RED_N, 18, 34.5, 43.2, 19, [...redEarly.keys()]);
for (const [i, at] of redEarly) redDeaths.set(i, at);

function blueDie(i: number) {
  return blueDeaths.get(i) ?? 1e9;
}

function redDie(i: number) {
  return redDeaths.get(i) ?? 1e9;
}

function redShift(i: number) {
  if (i === 4) return 0.58;
  return 0.2 + unit(i, 2) * 1.5;
}

function blueShift(i: number) {
  if (i === OPEN_VICTIM) return 0.18;
  return 0.35 + unit(i, 5) * 2.1;
}

function swingLen(who: KirmiziWho, i: number) {
  if (who === "blue") return BLUE_SWING;
  return i % 3 === 2 ? COMBO : RED_SWING;
}

function localOf(who: KirmiziWho, i: number, t: number) {
  return (t + (who === "blue" ? blueShift(i) : redShift(i))) % swingLen(who, i);
}

function swinging(who: KirmiziWho, i: number, t: number) {
  if (t >= (who === "blue" ? blueDie(i) : redDie(i))) return false;
  const local = localOf(who, i, t);
  if (who === "blue") return local > 0.5 && local < 1.0;
  return local > 0.45 && local < 0.85;
}

function shoved(who: KirmiziWho, i: number, t: number) {
  const mine = kirmiziSeat(who, i);
  const other: KirmiziWho = who === "blue" ? "red" : "blue";
  const cols = other === "red" ? 8 : 5;
  for (let k = 0; k < cols; k++) {
    const seat = kirmiziSeat(other, k);
    if (Math.abs(seat.x - mine.x) > 1.45) continue;
    if (swinging(other, k, t)) return true;
  }
  return false;
}

export function kirmiziPose(who: KirmiziWho, i: number, t: number): KirmiziPose {
  const seat = kirmiziSeat(who, i);
  const dieAt = who === "blue" ? blueDie(i) : redDie(i);
  if (t >= dieAt) {
    if (who === "red") {
      return { x: seat.x, z: seat.z, yaw: seat.yaw, rx: 0, clip: "Death_B", time: Math.min(1.87, t - dieAt), dead: true };
    }
    const u = Math.min(1, (t - dieAt) / 0.7);
    const e = u * u * (3 - 2 * u);
    return { x: seat.x, z: seat.z, yaw: 0, rx: e * 1.45, clip: "Attack_Ground_Pound", time: 0.04, dead: true };
  }
  const local = localOf(who, i, t);
  const clip = who === "red" ? (i % 3 === 2 ? "Sword_Regular_Combo" : "Sword_Attack") : "Attack_Ground_Pound";
  const push = Math.sin(Math.min(1, local / (who === "blue" ? 0.85 : 0.7)) * Math.PI) * 0.16;
  const z = who === "blue" ? seat.z + push : seat.z - push;
  return {
    x: seat.x,
    z,
    yaw: seat.yaw,
    rx: shoved(who, i, t) ? 0.2 : 0,
    clip,
    time: local,
    dead: false,
  };
}

export function kirmiziNames(t: number) {
  return t >= NAMES_AT;
}

export type KirmiziCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

function bladeCam(): KirmiziCam {
  const red = kirmiziSeat("red", 4);
  return { x: red.x + 0.06, y: 1.32, z: red.z - 0.95, lx: red.x, ly: 1.16, lz: red.z - 0.18, fov: 26 };
}

function crashCam(): KirmiziCam {
  return { x: -2.1, y: 1.72, z: -3.55, lx: 0.15, ly: 1.0, lz: 0.15, fov: 44 };
}

function blueShoulder(): KirmiziCam {
  return { x: 0.85, y: 2.15, z: -3.35, lx: 0.2, ly: 1.15, lz: 0.55, fov: 42 };
}

function overhead(t: number, y: number): KirmiziCam {
  return { x: Math.sin(t * 0.4) * 0.8, y, z: 0.35, lx: 0, ly: 0.2, lz: 0, fov: 42 };
}

function lineCam(): KirmiziCam {
  return { x: 2.4, y: 1.35, z: -0.15, lx: 0.1, ly: 1.05, lz: 0.05, fov: 40 };
}

function redShoulder(): KirmiziCam {
  return { x: -0.7, y: 2.05, z: 3.15, lx: 0.1, ly: 1.1, lz: -0.2, fov: 42 };
}

function resultCam(): KirmiziCam {
  return { x: -0.35, y: 2.85, z: -4.4, lx: 0.05, ly: 0.9, lz: 0.15, fov: 40 };
}

export function kirmiziCam(t: number): KirmiziCam {
  if (t < 1) return bladeCam();
  if (t < 3.2) return crashCam();
  if (t < 9) return blueShoulder();
  if (t < 16) return overhead(t, 14);
  if (t < 24) return lineCam();
  if (t < 33) return redShoulder();
  if (t < 42) return overhead(t, 11);
  return resultCam();
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function kirmiziMarkReady() {
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function kirmiziIsReady() {
  return ready;
}

export function kirmiziWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function kirmiziHold() {
  playAt = 0;
}

export function kirmiziStart() {
  playAt = performance.now() / 1000;
}

export function kirmiziT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function kirmiziReset() {
  ready = false;
  playAt = 0;
}

export function isKirmizi(id: string | null | undefined): id is KirmiziId {
  return id === KIRMIZI_ID;
}
