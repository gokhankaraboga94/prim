export const SALLY_CYCLE = 30;
export const SALLY_LEN = 16;
export const SALLY_START_DELAY = 3.5;
export const RAID_INSIDE_Z = 18;
export const RAID_OUT_Z = 41;
export const MAX_RAIDERS = 10000;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export function smooth01(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export function sallyLocal(now: number) {
  if (now < SALLY_START_DELAY) return SALLY_LEN;
  return (now - SALLY_START_DELAY) % SALLY_CYCLE;
}

export function sallyGate(p: number) {
  if (p >= SALLY_LEN) return 0;
  if (p < 1.5) return smooth01(p / 1.5);
  if (p < 12.8) return 1;
  return 1 - smooth01((p - 12.8) / 3.2);
}

export function raidCount(soldiers: number) {
  return Math.min(MAX_RAIDERS, Math.max(0, Math.floor(soldiers) * 2));
}

export function raidCols(n: number) {
  return Math.max(2, Math.min(24, Math.round(Math.sqrt(Math.max(1, n) * 1.35))));
}

export function raidSlotX(i: number, n: number) {
  const cols = raidCols(n);
  const col = i % cols;
  const span = Math.min(19, 1.02 * cols);
  const jitter = ((i * 13) % 11) * 0.07 - 0.35;
  return (col - (cols - 1) / 2) * (span / Math.max(1, cols - 1)) + jitter;
}

export function sallyHitAt(i: number, n: number) {
  const first = 3.05;
  const last = 11.15;
  if (n <= 1) return last;
  return first + (last - first) * (i / (n - 1));
}

export function sallyStartAt(i: number, n: number) {
  const row = Math.floor(i / raidCols(n));
  return 1.5 + Math.min(1.6, row * 0.035);
}

export function sallyRun(p: number, i: number, n: number) {
  const start = sallyStartAt(i, n);
  const hit = sallyHitAt(i, n);
  if (p < start) return 0;
  if (p >= hit) return 1;
  return smooth01((p - start) / Math.max(0.2, hit - start));
}

export function sallyFall(p: number, i: number, n: number) {
  const hit = sallyHitAt(i, n);
  if (p < hit) return 0;
  return smooth01((p - hit) / 0.45);
}

export type RaidPose = {
  x: number;
  y: number;
  z: number;
  fall: number;
  visible: boolean;
};

const _pose: RaidPose = { x: 0, y: 0, z: 0, fall: 0, visible: false };

export function sallyRaiderAt(p: number, i: number, n: number, out: RaidPose = _pose): RaidPose {
  if (n <= 0 || i < 0 || i >= n) {
    out.visible = false;
    out.fall = 1;
    return out;
  }
  const run = sallyRun(p, i, n);
  const fall = sallyFall(p, i, n);
  const row = Math.floor(i / raidCols(n));
  out.x = raidSlotX(i, n) * (0.2 + 0.8 * run);
  out.y = 0;
  out.z = RAID_INSIDE_Z + (RAID_OUT_Z - RAID_INSIDE_Z - Math.min(4.5, row * 0.35)) * run;
  out.fall = fall;
  out.visible = p >= 1.2 && p < 14.4;
  return out;
}

export function sallyLiveIndex(p: number, n: number, salt: number) {
  if (n <= 0) return -1;
  for (let k = 0; k < 8; k++) {
    const i = (Math.abs(salt) + k * 19) % n;
    if (sallyFall(p, i, n) < 0.8) return i;
  }
  return Math.abs(salt) % n;
}

export function sallyHunting(p: number) {
  return p > 1.5 && p < 12.1;
}
