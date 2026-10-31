export const TEK3_ID = "tek3" as const;
export type Tek3Id = typeof TEK3_ID;
export const TEK3_MODE = { id: TEK3_ID, label: "tek3" } as const;
export const TEK3_SECONDS = 11;
export const TEK3_BLUE = "/models/blue.glb";
export const TEK3_RED = "/models/red.glb";
export const TEK3_URLS = [TEK3_BLUE, TEK3_RED] as const;

export const TEK3_OURS = 10;
export const TEK3_FOES = 50;
/** Same-row gap. The other row sits half a step over, so plates cannot stack. */
export const TEK3_STEP = 1.9;
export const TEK3_PLATE = 0.7;

const BACK_Z = -2.25;
const RED_Z0 = 0.96;
const RED_STEP = 0.96;

export function tek3Roster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-TEK3_OURS);
  const out = Array.from({ length: TEK3_OURS }, () => "");
  const start = TEK3_OURS - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

export function tek3Blue(i: number) {
  const back = i >= 5;
  const col = back ? i - 5 : i;
  return {
    x: (col - 2) * TEK3_STEP + (back ? TEK3_STEP / 2 : 0),
    z: back ? BACK_Z : 0,
    yaw: 0,
  };
}

/** Column follows a blue. Rank 0 is the one in reach of that file. */
export function tek3Die(col: number, rank: number) {
  return rank * 1.32 + col * 0.34 - 0.42;
}

export function tek3Red(i: number) {
  const col = i % 10;
  const rank = Math.floor(i / 10);
  const blue = tek3Blue(col);
  return {
    x: blue.x,
    z: RED_Z0 + rank * RED_STEP,
    yaw: Math.PI,
    die: tek3Die(col, rank),
  };
}

export type Tek3Cam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

/** Further back and higher than the tek ring shot, so ten names and the red block both fit. */
export function tek3Cam(t: number): Tek3Cam {
  const u = Math.max(0, Math.min(1, t / 8));
  return {
    x: 0,
    y: 13.2 + u * 1.1,
    z: -24.6 - u * 1.2,
    lx: 0,
    ly: 0.8,
    lz: 2.1,
    fov: 46,
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
