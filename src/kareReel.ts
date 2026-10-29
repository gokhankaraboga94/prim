export const KARE_ID = "kare" as const;
export type KareId = typeof KARE_ID;
export const KARE_MODE = { id: KARE_ID, label: "kare" } as const;
export const KARE_SECONDS = 60;
export const KARE_OURS = 100;
export const KARE_ROMANS = 1000;
export const KARE_KNIGHT = "/models/knight.glb";
export const KARE_ROMAN = "/models/roman.glb";
export const KARE_URLS = [KARE_KNIGHT, KARE_ROMAN] as const;
export const KARE_HOOK = ["ÇIKIŞ YOK", "KARE KAPANIYOR"] as const;

const PER_RANK = 100;
const GAP = 0.7;
const LEAD = 12;
const OPEN_END = 3.7;
const CLOSE_END = 56;

export type KareCam = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

export function kareHalf(t: number) {
  if (t < OPEN_END) return 10.4 - (t / OPEN_END) * 1.8;
  const u = Math.min(1, (t - OPEN_END) / (CLOSE_END - OPEN_END));
  const s = 1 - Math.pow(1 - u, 1.2);
  return 8.6 - s * 1.45;
}

export function kareLead(t: number) {
  if (t < 1.05) return 2.6 + (t / 1.05) * 0.7;
  const back = Math.min(1, (t - 1.05) / 2.5);
  const s = back * back * (3 - 2 * back);
  return 3.3 * (1 - s);
}

export function kareRoman(i: number, t: number) {
  const rank = Math.floor(i / PER_RANK);
  const s = i % PER_RANK;
  const h = kareHalf(t) + rank * GAP;
  const side = Math.floor(s / 25);
  const k = (s % 25 + 0.5) / 25;
  const along = -h + k * 2 * h;
  let x = 0;
  let z = 0;
  if (side === 0) {
    x = along;
    z = -h;
  } else if (side === 1) {
    x = h;
    z = along;
  } else if (side === 2) {
    x = -along;
    z = h;
  } else {
    x = -h;
    z = -along;
  }
  if (i === LEAD) {
    const len = Math.hypot(x, z) || 1;
    const lead = kareLead(t);
    x -= (x / len) * lead;
    z -= (z / len) * lead;
  }
  return { x, z, yaw: Math.atan2(-x, -z) };
}

export function kareFriend(i: number) {
  const col = i % 10;
  const row = Math.floor(i / 10);
  const x = (col - 4.5) * 1.32;
  const z = (row - 4.5) * 1.32;
  return { x, z, yaw: Math.atan2(x, z) };
}

export function kareRoster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-KARE_OURS);
  const out = Array.from({ length: KARE_OURS }, () => "");
  const start = KARE_OURS - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function kareMarkReady() {
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function kareIsReady() {
  return ready;
}

export function kareWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function kareHold() {
  playAt = 0;
}

export function kareStart() {
  playAt = performance.now() / 1000;
}

export function kareT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function kareReset() {
  ready = false;
  playAt = 0;
}

export function isKare(id: string | null | undefined): id is KareId {
  return id === KARE_ID;
}

function faceCam(t: number): KareCam {
  const start = kareRoman(LEAD, 0);
  const now = kareRoman(LEAD, t);
  const len = Math.hypot(start.x, start.z) || 1;
  const ix = -start.x / len;
  const iz = -start.z / len;
  const u = Math.min(1, t / 1.05);
  return {
    x: start.x + ix * 0.55 + -iz * 2.15,
    y: 1.4,
    z: start.z + iz * 0.55 + ix * 2.15,
    lx: now.x,
    ly: 1.42,
    lz: now.z,
    fov: 32 - u * 3,
  };
}

function squareCam(t: number): KareCam {
  const u = Math.min(1, (t - 1.05) / 2.65);
  const ang = 0.35 + u * 0.55;
  return {
    x: Math.cos(ang) * 8,
    y: 62 - u * 4,
    z: Math.sin(ang) * 8,
    lx: 0,
    ly: 0,
    lz: 0,
    fov: 38,
  };
}

function wallCam(t: number, u: number): KareCam {
  const h = kareHalf(t);
  return {
    x: Math.sin(t * 0.35) * 1.15,
    y: 1.7,
    z: -4.15 + u * 0.7,
    lx: 0,
    ly: 1.15,
    lz: -h,
    fov: 44 - u * 5,
  };
}

function gapCam(t: number, u: number): KareCam {
  const h = kareHalf(t);
  const ang = -0.55 + u * 1.05;
  const r = Math.max(6.6, h - 0.85);
  return {
    x: Math.sin(ang) * r,
    y: 1.52,
    z: -Math.cos(ang) * r,
    lx: 0,
    ly: 1.1,
    lz: 0,
    fov: 40,
  };
}

function orbitCam(t: number): KareCam {
  const ang = t * 0.22;
  return {
    x: Math.cos(ang) * 10,
    y: 46 + Math.sin(t * 0.4) * 1.4,
    z: Math.sin(ang) * 10,
    lx: 0,
    ly: 0,
    lz: 0,
    fov: 36,
  };
}

export function kareCam(t: number): KareCam {
  if (t < 1.05) return faceCam(t);
  if (t < OPEN_END) return squareCam(t);
  const beat = Math.floor((t - OPEN_END) / 4.4);
  const u = ((t - OPEN_END) % 4.4) / 4.4;
  const kind = beat % 3;
  if (kind === 0) return wallCam(t, u);
  if (kind === 1) return gapCam(t, u);
  return orbitCam(t);
}

export function kareShowNames(t: number) {
  if (t < OPEN_END) return false;
  const beat = Math.floor((t - OPEN_END) / 4.4);
  return beat % 3 !== 2;
}

export function kareCard(t: number): { lines: readonly string[]; opacity: number } | null {
  if (t >= 3.75) return null;
  const fade = t < 3.15 ? 1 : 1 - (t - 3.15) / 0.6;
  return { lines: KARE_HOOK, opacity: Math.max(0, fade) };
}
