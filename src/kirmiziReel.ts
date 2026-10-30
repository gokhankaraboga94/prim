export const KIRMIZI_ID = "kirmizi-mavi" as const;
export type KirmiziId = typeof KIRMIZI_ID;
export const KIRMIZI_MODE = { id: KIRMIZI_ID, label: "kırmızı-mavi" } as const;
export const KIRMIZI_SECONDS = 32;
export const KIRMIZI_BLUE = "/models/blue.glb";
export const KIRMIZI_RED = "/models/red.glb";
export const KIRMIZI_URLS = [KIRMIZI_BLUE, KIRMIZI_RED] as const;

const BLUE_Z = -1.05;
const RED_Z = 1.05;
const OPEN_END = 3.7;
const BEAT = 4.4;

export type KirmiziWho = "blue" | "red";

type Turn = { who: KirmiziWho; name: string; start: number; dur: number; hit: number };

/** hit < 0 means the clip connects with nobody (dodge or death). */
const TURNS: Turn[] = [
  { who: "red", name: "Sword_Attack", start: -0.4, dur: 1.92, hit: 0.62 },
  { who: "blue", name: "Attack_Ground_Pound", start: 1.05, dur: 2.71, hit: 0.72 },
  { who: "red", name: "Sword_Regular_Combo", start: 3.85, dur: 2.96, hit: 0.85 },
  { who: "blue", name: "Attack_Ground_Pound", start: 6.9, dur: 2.71, hit: 0.72 },
  { who: "red", name: "Sword_Attack", start: 9.75, dur: 1.92, hit: 0.62 },
  { who: "blue", name: "Attack_Ground_Pound", start: 11.8, dur: 2.71, hit: 0.72 },
  { who: "red", name: "Backflip", start: 14.65, dur: 2.5, hit: -1 },
  { who: "red", name: "Sword_Regular_Combo", start: 17.25, dur: 2.96, hit: 0.85 },
  { who: "blue", name: "Attack_Ground_Pound", start: 20.35, dur: 2.71, hit: 0.72 },
  { who: "red", name: "Sword_Attack", start: 23.2, dur: 1.92, hit: 0.62 },
  { who: "blue", name: "Attack_Ground_Pound", start: 25.25, dur: 2.71, hit: 0.72 },
  { who: "red", name: "Death_B", start: 28.05, dur: 1.88, hit: -1 },
];

function playing(who: KirmiziWho, t: number) {
  for (let i = TURNS.length - 1; i >= 0; i--) {
    const turn = TURNS[i];
    if (turn.who === who && t >= turn.start && t < turn.start + turn.dur) return turn;
  }
  return null;
}

export function kirmiziClip(who: KirmiziWho, t: number) {
  const turn = playing(who, t);
  if (turn) return { name: turn.name, time: Math.max(0, t - turn.start) };
  if (who === "red") {
    if (t >= 28.05) return { name: "Death_B", time: Math.min(1.87, t - 28.05) };
    return { name: "Idle_A", time: t % 3.13 };
  }
  return { name: "Attack_Ground_Pound", time: 0.04 };
}

function press(who: KirmiziWho, t: number) {
  let push = 0;
  for (const turn of TURNS) {
    if (turn.who !== who || turn.hit < 0) continue;
    const u = (t - turn.start) / turn.dur;
    if (u < 0 || u > 1) continue;
    push = Math.sin(u * Math.PI) * 0.36;
  }
  return push;
}

export function kirmiziPlace(who: KirmiziWho, t: number) {
  const push = press(who, t);
  if (who === "blue") return { x: 0, z: BLUE_Z + push, yaw: 0, rx: kirmiziStagger("blue", t) };
  return { x: 0, z: RED_Z - push, yaw: Math.PI, rx: kirmiziStagger("red", t) };
}

function kirmiziStagger(who: KirmiziWho, t: number) {
  if (who === "red" && t >= 28.05) return 0;
  let best = 0;
  for (const turn of TURNS) {
    if (turn.hit < 0 || turn.who === who) continue;
    const age = t - (turn.start + turn.hit);
    if (age < 0 || age > 0.42) continue;
    best = Math.sin((age / 0.42) * Math.PI) * 0.22;
  }
  return best;
}

export function kirmiziHp(who: KirmiziWho, t: number) {
  if (who === "red" && t >= 28.05) return 0;
  let n = 0;
  for (const turn of TURNS) {
    if (turn.hit < 0 || turn.who === who) continue;
    if (t >= turn.start + turn.hit) n += 1;
  }
  const drop = who === "blue" ? 0.13 : 0.22;
  return Math.max(0.04, 1 - n * drop);
}

export type KirmiziCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

function bladeCam(): KirmiziCam {
  return { x: 0.7, y: 1.22, z: -0.2, lx: 0.05, ly: 1.15, lz: 0.72, fov: 32 };
}

function blueEye(t: number): KirmiziCam {
  const b = kirmiziPlace("blue", t);
  return { x: b.x + 0.1, y: 1.58, z: b.z + 0.58, lx: 0, ly: 1.18, lz: RED_Z, fov: 48 };
}

function blueTps(t: number): KirmiziCam {
  const b = kirmiziPlace("blue", t);
  return { x: -0.62, y: 1.7, z: b.z - 2.05, lx: 0.1, ly: 1.12, lz: RED_Z, fov: 42 };
}

function redEye(t: number): KirmiziCam {
  const r = kirmiziPlace("red", t);
  return { x: -0.08, y: 1.56, z: r.z - 0.58, lx: 0, ly: 1.12, lz: BLUE_Z, fov: 48 };
}

function redTps(t: number): KirmiziCam {
  const r = kirmiziPlace("red", t);
  return { x: 0.55, y: 1.72, z: r.z + 2.05, lx: 0, ly: 1.08, lz: BLUE_Z, fov: 42 };
}

function sideCam(): KirmiziCam {
  return { x: 2.7, y: 1.26, z: 0.05, lx: 0, ly: 1.02, lz: 0, fov: 36 };
}

export function kirmiziCam(t: number): KirmiziCam {
  if (t < 1.05) return bladeCam();
  if (t < OPEN_END) return blueEye(t);
  if (t >= 28.05) return sideCam();
  const kind = Math.floor((t - OPEN_END) / BEAT) % 5;
  if (kind === 0) return blueTps(t);
  if (kind === 1) return redEye(t);
  if (kind === 2) return sideCam();
  if (kind === 3) return redTps(t);
  return blueEye(t);
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
