export const SALLY_CYCLE = 30;
export const SALLY_LEN = 9;
export const RAID_X = [-4.2, -1.4, 1.4, 4.2];
export const RAID_INSIDE_Z = 18;
export const RAID_OUT_Z = 44;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export function smooth01(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export function sallyLocal(now: number) {
  return now % SALLY_CYCLE;
}

export function sallyGate(p: number) {
  if (p >= SALLY_LEN) return 0;
  if (p < 1.5) return smooth01(p / 1.5);
  if (p < 6.8) return 1;
  return 1 - smooth01((p - 6.8) / 2.2);
}

export function sallyHitAt(i: number) {
  return 2.55 + i * 0.42;
}

export function sallyRun(p: number, i: number) {
  const start = 1.4;
  const hit = sallyHitAt(i);
  if (p < start) return 0;
  if (p >= hit) return 1;
  return smooth01((p - start) / Math.max(0.2, hit - start));
}

export function sallyFall(p: number, i: number) {
  const hit = sallyHitAt(i);
  if (p < hit) return 0;
  return smooth01((p - hit) / 0.5);
}

export function sallyRaiderAt(p: number, i: number) {
  const run = sallyRun(p, i);
  const fall = sallyFall(p, i);
  return {
    x: RAID_X[i],
    y: 0,
    z: RAID_INSIDE_Z + (RAID_OUT_Z - RAID_INSIDE_Z) * run,
    fall,
    visible: p >= 1.25 && p < 8.4,
  };
}
