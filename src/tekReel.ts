export const TEK_ID = "tek" as const;
export type TekId = typeof TEK_ID;
export const TEK_MODE = { id: TEK_ID, label: "tek" } as const;
export const TEK_SECONDS = 18;
export const TEK_HERO = "/models/savaci.glb";
export const TEK_RED = "/models/red.glb";
export const TEK_ARENA = "/models/arena.glb";
export const TEK_URLS = [TEK_HERO, TEK_RED, TEK_ARENA] as const;

export type TekFoe = { ang: number; die: number; hits: 1 | 2 };

/** Ten reds. A negative death means the first body is already falling at frame 0. */
export const TEK_FOES: TekFoe[] = [
  { ang: 0.22, die: -0.18, hits: 1 },
  { ang: -0.62, die: 1.45, hits: 2 },
  { ang: 0.78, die: 3.15, hits: 1 },
  { ang: -0.28, die: 4.9, hits: 2 },
  { ang: 1.05, die: 6.55, hits: 1 },
  { ang: -1.05, die: 8.15, hits: 1 },
  { ang: 0.4, die: 9.9, hits: 2 },
  { ang: -0.82, die: 11.55, hits: 1 },
  { ang: 0.95, die: 13.2, hits: 2 },
  { ang: -0.4, die: 14.9, hits: 1 },
];

const FIGHT_R = 1.16;

export function tekSpot(foe: TekFoe, t: number) {
  const lead = foe.hits === 2 ? 2.05 : 1.05;
  const arrive = foe.die - lead;
  const travel = 0.72;
  let u = 1;
  if (foe.die > 0 && t < arrive) u = Math.max(0, Math.min(1, (t - (arrive - travel)) / travel));
  const e = u * u * (3 - 2 * u);
  const fightX = Math.sin(foe.ang) * FIGHT_R;
  const fightZ = -Math.cos(foe.ang) * FIGHT_R;
  const side = foe.ang >= 0 ? 1 : -1;
  const waitX = side * (2.45 + Math.abs(foe.ang) * 0.35);
  const waitZ = -0.35;
  const x = waitX + (fightX - waitX) * e;
  const z = waitZ + (fightZ - waitZ) * e;
  return { x, z, yaw: Math.atan2(-x, -z) };
}

export function tekTarget(t: number) {
  for (const foe of TEK_FOES) if (t < foe.die + 0.05) return foe;
  return TEK_FOES[TEK_FOES.length - 1];
}

export type TekCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

export function tekCam(t: number): TekCam {
  if (t < 1.05) return { x: 0.15, y: 1.48, z: -4.55, lx: 0.02, ly: 1.05, lz: -0.55, fov: 36 };
  if (t < 3.2) return { x: -0.15, y: 1.78, z: -5.7, lx: 0, ly: 0.98, lz: -0.35, fov: 42 };
  if (t > 16.1) return { x: 0.1, y: 1.62, z: -4.9, lx: 0, ly: 1.02, lz: 0.05, fov: 38 };
  const spot = tekSpot(tekTarget(t), t);
  return { x: spot.x * 0.22, y: 1.7, z: spot.z - 3.8, lx: spot.x * 0.35, ly: 1.0, lz: spot.z * 0.45, fov: 40 };
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function tekMarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function tekIsReady() {
  return ready;
}

export function tekWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function tekHold() {
  playAt = 0;
}

export function tekStart() {
  playAt = performance.now() / 1000;
}

export function tekT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function tekReset() {
  ready = false;
  playAt = 0;
}

export function isTek(id: string | null | undefined): id is TekId {
  return id === TEK_ID;
}
