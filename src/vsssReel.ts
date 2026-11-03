export const VSSS_ID = "vsss" as const;
export type VsssId = typeof VSSS_ID;
export const VSSS_MODE = { id: VSSS_ID, label: "vsss" } as const;
export const VSSS_SECONDS = 20;
export const VSSS_KING = "/models/king.glb";
export const VSSS_HULK = "/models/hulk_v2.glb";
export const VSSS_URLS = [VSSS_KING, VSSS_HULK] as const;
export const VSSS_HEIGHT = 2.15;

const KING_SLAM = "King Kong raises both arms high above his head and violently sl";

type Move = { who: "king" | "hulk"; clip: string; from: number; to: number; hit: number };

/** Strike windows only. Run and walk stay out. Each window's hit is the limb's farthest reach. */
const MOVES: Move[] = [
  { who: "king", clip: "slash.001", from: 1.45, to: 2.15, hit: 1.66 },
  { who: "hulk", clip: "box_02.001", from: 2.15, to: 2.83, hit: 2.48 },
  { who: "king", clip: "front_kick_01.001", from: 0.85, to: 1.55, hit: 1.27 },
  { who: "hulk", clip: "front_kick_01.001", from: 0.9, to: 1.55, hit: 1.27 },
  { who: "king", clip: "box_03.001", from: 0.45, to: 1.15, hit: 0.86 },
  { who: "hulk", clip: "hit_to_head.001", from: 0.15, to: 0.85, hit: 0.47 },
  { who: "king", clip: "front_kick_02.001", from: 0.45, to: 1.15, hit: 0.83 },
  { who: "hulk", clip: "box_03.001", from: 0.55, to: 1.25, hit: 0.97 },
  { who: "king", clip: KING_SLAM, from: 1.55, to: 2.35, hit: 2.08 },
  { who: "hulk", clip: "front_kick_02.001", from: 0.5, to: 1.15, hit: 0.89 },
  { who: "king", clip: "flip.001", from: 1.55, to: 2.2, hit: 1.88 },
  { who: "hulk", clip: "box_01.001", from: 0.45, to: 1.15, hit: 0.84 },
  { who: "king", clip: "dig.001", from: 10.55, to: 11.25, hit: 10.94 },
];

export type VsssBeat = Move & { start: number; dur: number; contact: number };

function buildBeats() {
  const out: VsssBeat[] = [];
  let t = 0;
  let i = 0;
  while (t < 18.6) {
    const move = MOVES[i % MOVES.length];
    const dur = move.to - move.from;
    out.push({ ...move, start: t, dur, contact: t + (move.hit - move.from) });
    t += dur + 0.04;
    i += 1;
  }
  return out;
}

export const VSSS_BEATS = buildBeats();

export function vsssPose(who: "king" | "hulk", t: number) {
  let last: VsssBeat | null = null;
  for (const beat of VSSS_BEATS) {
    if (beat.who !== who) continue;
    if (t < beat.start) break;
    if (t < beat.start + beat.dur) return { name: beat.clip, time: beat.from + (t - beat.start) };
    last = beat;
  }
  if (last) return { name: last.clip, time: last.from + last.dur };
  const first = VSSS_BEATS.find((beat) => beat.who === who);
  return { name: first?.clip ?? "", time: first?.from ?? 0 };
}

export type VsssCam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

export function vsssCam(t: number): VsssCam {
  if (t < 1.1) return { x: 1.15, y: 1.35, z: 0.15, lx: 0, ly: 1.15, lz: 0, fov: 34 };
  if (t < 3.2) return { x: 2.15, y: 1.55, z: 0.35, lx: 0, ly: 1.1, lz: 0, fov: 36 };
  if (t < 12) return { x: 2.6, y: 1.7, z: -0.2, lx: 0, ly: 1.05, lz: 0, fov: 38 };
  return { x: 1.7, y: 1.42, z: 0.55, lx: 0, ly: 1.12, lz: 0, fov: 34 };
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function vsssMarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function vsssIsReady() {
  return ready;
}

export function vsssWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function vsssHold() {
  playAt = 0;
}

export function vsssStart() {
  playAt = performance.now() / 1000;
}

export function vsssT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function vsssReset() {
  ready = false;
  playAt = 0;
}

export function isVsss(id: string | null | undefined): id is VsssId {
  return id === VSSS_ID;
}
