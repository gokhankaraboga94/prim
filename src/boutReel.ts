import type { ShotPose } from "./shotModes";

export const BOUT_ID = "1vs1" as const;
export type BoutId = typeof BOUT_ID;
export const BOUT_MODE = { id: BOUT_ID, label: "1vs1" } as const;
export const BOUT_SECONDS = 52;

export const KONG_HITS = [5.5, 9, 12.6, 16.4, 20.2, 24.2, 28.4, 32.6, 37, 41.2, 46.2] as const;
export const ORC_HITS = [7.2, 10.8, 14.4, 18.2, 22.2, 26.2, 30.4, 34.6, 38.8, 42.4] as const;
const KONG_DMG = [6, 7, 7, 8, 8, 9, 9, 10, 11, 12, 13];
const ORC_DMG = [8, 8, 8, 8, 8, 7, 7, 7, 7, 6];

export const KONG_HOME = -7.4;
export const ORC_HOME = 7.2;
export const KONG_H = 15.6 * 1.52;
export const ORC_H = 15.6 * 0.7 * 1.52;
export const ORC_FALL = 46.5;

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

export function boutStrike(t: number, hits: readonly number[]) {
  let best = 0;
  let mag = 0;
  for (const hit of hits) {
    const u = (t - (hit - 0.5)) / 0.78;
    if (u <= 0 || u >= 1) continue;
    let a = 0;
    if (u < 0.4) a = -(u / 0.4);
    else if (u < 0.58) a = -1 + ((u - 0.4) / 0.18) * 2;
    else a = 1 - (u - 0.58) / 0.42;
    if (Math.abs(a) >= mag) {
      mag = Math.abs(a);
      best = a;
    }
  }
  return best;
}

export function boutRecoil(t: number, hits: readonly number[]) {
  let recoil = 0;
  for (const hit of hits) {
    const u = t - hit;
    if (u < 0 || u > 0.32) continue;
    recoil = Math.max(recoil, 1 - u / 0.32);
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
