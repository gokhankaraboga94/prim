import type { ShotPose } from "./shotModes";

export const BOUT_ID = "1vs1" as const;
export type BoutId = typeof BOUT_ID;
export const BOUT_MODE = { id: BOUT_ID, label: "1vs1" } as const;
export const BOUT_SECONDS = 52;

function stamps(start: number, step: number, count: number) {
  return Array.from({ length: count }, (_, i) => Math.round((start + i * step) * 100) / 100);
}

function chips(count: number, total: number, heavy: number) {
  const dmg = new Array<number>(count).fill(1);
  let left = total - count;
  for (let i = count - 1; i >= 0 && left > 0; i--) {
    const add = Math.min(left, i >= count - heavy ? 3 : 1);
    dmg[i] += add;
    left -= add;
  }
  return dmg;
}

export const KONG_HITS = [...stamps(2.35, 0.84, 52), 45.7, 46.15, 46.55];
export const ORC_HITS = stamps(2.77, 0.84, 48);
const KONG_DMG = chips(KONG_HITS.length, 100, 8);
const ORC_DMG = chips(ORC_HITS.length, 74, 4);

export const KONG_HOME = -4.5;
export const ORC_HOME = 4.3;
export const KONG_H = 15.6 * 1.52;
export const ORC_H = 15.6 * 0.7 * 1.52 * 1.15;
export const ORC_FALL = 46.7;

export function isBout(id: string | null | undefined): id is BoutId {
  return id === BOUT_ID;
}

export function boutHp(t: number) {
  let kong = 100;
  let orc = 100;
  for (let i = 0; i < KONG_HITS.length; i++) if (t >= KONG_HITS[i]) orc -= KONG_DMG[i];
  for (let i = 0; i < ORC_HITS.length; i++) if (t >= ORC_HITS[i]) kong -= ORC_DMG[i];
  return { kong: Math.max(0, kong), orc: Math.max(0, orc) };
}

export function boutPunch(t: number, hits: readonly number[]) {
  let best = 0;
  let mag = 0;
  let hand: 1 | -1 = 1;
  const lead = 0.18;
  const span = 0.38;
  for (let i = 0; i < hits.length; i++) {
    const u = (t - (hits[i] - lead)) / span;
    if (u <= 0 || u >= 1) continue;
    let a = 0;
    if (u < 0.5) a = -(u / 0.5);
    else if (u < 0.68) a = -1 + ((u - 0.5) / 0.18) * 2;
    else a = 1 - (u - 0.68) / 0.32;
    if (Math.abs(a) >= mag) {
      mag = Math.abs(a);
      best = a;
      hand = i % 2 === 0 ? 1 : -1;
    }
  }
  return { a: best, hand };
}

export function boutRecoil(t: number, hits: readonly number[]) {
  let recoil = 0;
  for (const hit of hits) {
    const u = t - hit;
    if (u < 0 || u > 0.16) continue;
    recoil = Math.max(recoil, 1 - u / 0.16);
  }
  return recoil;
}

export function boutCam(t: number): ShotPose {
  const u = Math.max(0, Math.min(1, t / BOUT_SECONDS));
  const ang = 0.28 + u * 0.62;
  let dist = 74;
  let y = 23;
  let lookY = 9.6;
  let fov = 46;
  if (t < 5) {
    const k = t / 5;
    const e = k * k * (3 - 2 * k);
    dist = 92 - e * 18;
    y = 36 - e * 13;
    fov = 50 - e * 4;
  } else if (t > 46) {
    const k = Math.min(1, (t - 46) / 6);
    dist = 74 - k * 8;
    y = 23 - k * 5;
    lookY = 8.2;
  }
  const lx = -0.5;
  return {
    x: lx + Math.sin(ang) * dist,
    y,
    z: Math.cos(ang) * dist,
    lx,
    ly: lookY,
    lz: 0,
    fov,
  };
}
