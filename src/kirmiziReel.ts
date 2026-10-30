export const KIRMIZI_ID = "kirmizi-mavi" as const;
export type KirmiziId = typeof KIRMIZI_ID;
export const KIRMIZI_MODE = { id: KIRMIZI_ID, label: "kırmızı-mavi" } as const;
export const KIRMIZI_SECONDS = 32;
export const KIRMIZI_BLUE = "/models/blue.glb";
export const KIRMIZI_RED = "/models/red.glb";
export const KIRMIZI_URLS = [KIRMIZI_BLUE, KIRMIZI_RED] as const;

export const BLUE_N = 25;
export const RED_N = 40;

const OPEN_END = 3.7;
const BEAT = 5.1;
const BLUE_CYCLE = 3.15;
const RED_CYCLE = 3.35;

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

export function kirmiziSeat(who: KirmiziWho, i: number) {
  if (who === "blue") {
    const col = i % 5;
    const row = Math.floor(i / 5);
    return { x: (col - 2) * 1.28, z: -1.7 - row * 1.22, yaw: 0 };
  }
  const col = i % 8;
  const row = Math.floor(i / 8);
  return { x: (col - 3.5) * 1.08, z: 1.45 + row * 1.15, yaw: Math.PI };
}

function blueDie(i: number) {
  if (i % 5 !== 2) return 1e9;
  return 12.4 + (i % 5) * 2.8;
}

function redDie(i: number) {
  if (i % 4 !== 1) return 1e9;
  return 9.4 + (i % 8) * 1.85;
}

function swinging(who: KirmiziWho, i: number, t: number) {
  if (t >= (who === "blue" ? blueDie(i) : redDie(i))) return false;
  const cycle = who === "blue" ? BLUE_CYCLE : RED_CYCLE;
  const shift = who === "blue" ? 2.45 + (i % 4) * 0.12 : 0.48 + (i % 5) * 0.11;
  const local = (t + shift) % cycle;
  if (who === "blue") return local > 0.55 && local < 0.95;
  return local > 0.48 && local < 0.82;
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
  const cycle = who === "blue" ? BLUE_CYCLE : RED_CYCLE;
  const shift = who === "blue" ? 2.45 + (i % 4) * 0.12 : 0.48 + (i % 5) * 0.11;
  const local = (t + shift) % cycle;
  let clip = who === "red" ? "Idle_A" : "Attack_Ground_Pound";
  let time = who === "red" ? (t + i * 0.17) % 3.13 : 0.04;
  let attacking = false;
  if (who === "red") {
    if (i % 6 === 0 && local > 2.05) {
      clip = "Backflip";
      time = Math.min(2.49, local - 2.05);
    } else if (local < 1.92) {
      clip = i % 3 === 2 ? "Sword_Regular_Combo" : "Sword_Attack";
      time = local;
      attacking = true;
    }
  } else if (local < 2.71) {
    clip = "Attack_Ground_Pound";
    time = local;
    attacking = local > 0.3 && local < 2.2;
  }
  const push = attacking ? Math.sin(Math.min(1, local / 1.5) * Math.PI) * 0.58 : 0;
  const z = who === "blue" ? seat.z + push : seat.z - push;
  return {
    x: seat.x,
    z,
    yaw: seat.yaw,
    rx: shoved(who, i, t) ? 0.2 : 0,
    clip,
    time,
    dead: false,
  };
}

export function kirmiziNames(t: number) {
  return t >= OPEN_END;
}

export type KirmiziCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

function bladeCam(): KirmiziCam {
  const red = kirmiziSeat("red", 4);
  return { x: red.x + 0.42, y: 1.24, z: red.z - 1.35, lx: red.x, ly: 1.12, lz: red.z - 0.35, fov: 32 };
}

function openTps(): KirmiziCam {
  return { x: -0.35, y: 2.25, z: -7.6, lx: 0.15, ly: 1.15, lz: 1.5, fov: 46 };
}

function overhead(t: number): KirmiziCam {
  const drift = Math.sin(t * 0.33) * 1.6;
  return { x: drift, y: 22, z: 0.8, lx: 0, ly: 0, lz: 0.2, fov: 48 };
}

function blueTps(): KirmiziCam {
  return { x: 1.35, y: 2.55, z: -8.1, lx: 0.1, ly: 1.2, lz: 1.8, fov: 44 };
}

function redTps(): KirmiziCam {
  return { x: -1.1, y: 2.5, z: 8.4, lx: 0.15, ly: 1.15, lz: -1.4, fov: 44 };
}

export function kirmiziCam(t: number): KirmiziCam {
  if (t < 1.05) return bladeCam();
  if (t < OPEN_END) return openTps();
  const step = Math.floor((t - OPEN_END) / BEAT);
  if (step % 2 === 0) return overhead(t);
  return step % 4 === 1 ? blueTps() : redTps();
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
