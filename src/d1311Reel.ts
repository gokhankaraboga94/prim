/** Viral ilham alternatif: çember kuşatma değil — kırmızı duvar + kama yarma. */
export const D1311_ID = "13112026" as const;
export type D1311Id = typeof D1311_ID;
export const D1311_MODE = { id: D1311_ID, label: "13112026" } as const;
export const D1311_SECONDS = 30;

export const D1311_FRIENDS = 81;
export const D1311_FOES = 480;
export const D1311_KNIGHT = "/models/knight.glb";
export const D1311_ROMAN = "/models/roman.glb";
export const D1311_URLS = [D1311_KNIGHT, D1311_ROMAN] as const;

const FOE_COLS = 60;
const FOE_ROWS = 8;
const PITCH = 1.05;
const WALL_Z0 = 9.2;

const HOOK_END = 7.2;
const PRESS_END = 12.4;
const CTA_AT = 11.0;
const BREAK_AT = 17.6;
const CLOSE_AT = 23.5;

export type D1311Cam = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

export type D1311Card = {
  lines: readonly string[];
  accent?: boolean;
  opacity: number;
};

function smo(t: number, a: number, b: number) {
  if (t <= a) return 0;
  if (t >= b) return 1;
  const k = (t - a) / (b - a);
  return k * k * (3 - 2 * k);
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function isD1311(id: string | null | undefined): id is D1311Id {
  return id === D1311_ID;
}

export function d1311Roster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-D1311_FRIENDS);
  const out = Array.from({ length: D1311_FRIENDS }, () => "");
  const start = D1311_FRIENDS - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

/** Wedge tip toward +Z (red wall). Early: loose blob; mid: kama; late: punch through gap. */
export function d1311Friend(i: number, t: number) {
  const col = i % 9;
  const row = Math.floor(i / 9);
  const cx = (col - 4) * 1.22;
  const tip = row / 8;
  const taper = 1 - tip * 0.72;
  const pack = smo(t, 2.2, 11.5);
  const charge = smo(t, BREAK_AT, BREAK_AT + 4.2);
  const scatter = 1.55 - pack * 0.95;
  const x = cx * taper * scatter;
  const zBase = -6.4 + row * 1.18 * (0.72 + pack * 0.4);
  const z = zBase + charge * (WALL_Z0 + 6.8);
  const sway = Math.sin(t * 1.1 + i * 0.37) * (0.04 + (1 - pack) * 0.08);
  return { x: x + sway, z, yaw: 0 };
}

function foeColRow(i: number) {
  return { col: i % FOE_COLS, row: Math.floor(i / FOE_COLS) };
}

/** Thick red barrier — never a ring. After break, center gap peels open. */
export function d1311Foe(i: number, t: number) {
  const { col, row } = foeColRow(i);
  const x0 = (col - (FOE_COLS - 1) / 2) * PITCH;
  const z0 = WALL_Z0 + row * PITCH * 0.92;
  const mid = Math.abs(col - (FOE_COLS - 1) / 2) / ((FOE_COLS - 1) / 2);
  const gap = smo(t, BREAK_AT, BREAK_AT + 3.4);
  const peel = gap * Math.max(0, 1 - mid * 1.15);
  const side = col < FOE_COLS / 2 ? -1 : 1;
  const x = x0 + side * peel * (7.5 + row * 0.35);
  const z = z0 + peel * mid * 1.8;
  const hide = peel > 0.92 && mid < 0.22;
  return { x, z, yaw: Math.PI, show: !hide };
}

export function d1311ShowNames(t: number) {
  return t >= CTA_AT;
}

export function d1311Card(t: number, day: number): D1311Card | null {
  const gun = Math.max(1, Math.floor(day) || 21);
  if (t < HOOK_END) {
    const fade = t < 0.35 ? smo(t, 0, 0.35) : 1 - smo(t, HOOK_END - 0.55, HOOK_END);
    return {
      lines: [
        "Düşman yolu kapattı.",
        "Takipçilerimle yarıyoruz.",
        `Gün ${gun}.`,
      ],
      opacity: fade,
    };
  }
  if (t < PRESS_END) {
    const fade = t < HOOK_END + 0.4 ? smo(t, HOOK_END, HOOK_END + 0.4) : 1 - smo(t, PRESS_END - 0.5, PRESS_END);
    return {
      lines: ["DUVAR KALIN", "ama biz çoğalıyoruz"],
      accent: true,
      opacity: fade,
    };
  }
  if (t < BREAK_AT + 0.8) {
    const fade = t < CTA_AT + 0.45 ? smo(t, CTA_AT, CTA_AT + 0.45) : t > BREAK_AT ? 1 - smo(t, BREAK_AT, BREAK_AT + 0.8) : 1;
    return {
      lines: ["Takip et", "orduya katıl"],
      opacity: fade,
    };
  }
  if (t < CLOSE_AT) {
    const fade = smo(t, BREAK_AT + 0.9, BREAK_AT + 1.5) * (1 - smo(t, CLOSE_AT - 0.6, CLOSE_AT));
    return {
      lines: ["KIRILDI"],
      accent: true,
      opacity: fade,
    };
  }
  return null;
}

export function d1311Cam(t: number): D1311Cam {
  if (t < 6.5) {
    const u = smo(t, 0, 6.5);
    return {
      x: Math.sin(t * 0.12) * 2.4,
      y: 48 - u * 6,
      z: -18 + u * 4,
      lx: 0,
      ly: 0,
      lz: 2 + u * 4,
      fov: 42,
    };
  }
  if (t < 12) {
    const u = smo(t, 6.5, 12);
    return {
      x: 4.2 - u * 3.5,
      y: 36 - u * 8,
      z: -8 + u * 6,
      lx: 0,
      ly: 0.4,
      lz: 4 + u * 3,
      fov: 40,
    };
  }
  if (t < BREAK_AT) {
    return {
      x: Math.sin(t * 0.2) * 1.2,
      y: 28,
      z: -2,
      lx: 0,
      ly: 0.5,
      lz: 8,
      fov: 38,
    };
  }
  if (t < CLOSE_AT) {
    const u = smo(t, BREAK_AT, CLOSE_AT);
    const tip = d1311Friend(40, t);
    return {
      x: tip.x * 0.4 + 1.2,
      y: 22 - u * 10,
      z: tip.z - 10 + u * 4,
      lx: tip.x * 0.2,
      ly: 0.8,
      lz: tip.z + u * 2,
      fov: 36 + u * 4,
    };
  }
  const u = clamp((t - CLOSE_AT) / (D1311_SECONDS - CLOSE_AT), 0, 1);
  const pack = d1311Friend(36 + Math.floor(u * 8), t);
  return {
    x: pack.x + 0.6,
    y: 9 - u * 3.2,
    z: pack.z - 7.5 + u * 2.2,
    lx: pack.x,
    ly: 1.1,
    lz: pack.z + 1.5,
    fov: 40,
  };
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function d1311MarkReady() {
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function d1311IsReady() {
  return ready;
}

export function d1311WhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function d1311Hold() {
  playAt = 0;
}

export function d1311Start() {
  playAt = performance.now() / 1000;
}

export function d1311T() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function d1311Reset() {
  ready = false;
  playAt = 0;
}
