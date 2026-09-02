export const SALLY_CYCLE = 60;
export const SALLY_LEN = 32;
export const SALLY_START_DELAY = 3.5;
export const RAID_INSIDE_Z = 18;
export const RAID_OUT_Z = 47;
export const MAX_RAIDERS = 10000;
/** Recording starts with the gate open and raiders still at the mouth. */
export const REEL_SALLY_AT = 2.88;
/** First sword raise during a reel — shortly after the clip starts. */
export const REEL_SWORD_START = 4.02;

let sallyOrigin = 0;
let swordAt = 7.1;

export function setSallyOrigin(seconds: number) {
  sallyOrigin = Number.isFinite(seconds) ? seconds : 0;
}

export function setSwordStart(p: number) {
  swordAt = Number.isFinite(p) ? p : SWORD_START;
}

export function cinematicSallyOrigin(hold: number) {
  return SALLY_START_DELAY + REEL_SALLY_AT - hold;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export function smooth01(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export function sallyLocal(now: number) {
  const t = now + sallyOrigin;
  if (t < SALLY_START_DELAY) return t - SALLY_START_DELAY;
  return (t - SALLY_START_DELAY) % SALLY_CYCLE;
}

export function sallyGate(p: number) {
  if (p >= SALLY_LEN) return 0;
  if (p < 3) return smooth01(p / 3);
  if (p < 25.6) return 1;
  return 1 - smooth01((p - 25.6) / 6.4);
}

export function raidCount(soldiers: number) {
  return Math.min(MAX_RAIDERS, Math.max(0, Math.floor(soldiers) * 6));
}

export const SWORD_START = 7.1;
export const SWORD_EVERY = 2.9;
export const SWORD_SWING = 0.78;

export function swordPairCount(n: number, commanders: number) {
  if (commanders <= 0 || n <= 0) return 0;
  const swings = Math.max(1, Math.floor((22.4 - swordAt) / SWORD_EVERY) * commanders);
  return Math.min(Math.floor(n / 2), swings);
}

export function isSwordVictim(i: number, n: number, commanders: number) {
  return commanders > 0 && i >= 0 && i < swordPairCount(n, commanders) * 2;
}

export function swordSwingU(p: number, commanders = 1) {
  if (commanders <= 0 || p < swordAt || p > 22.8) return 0;
  const local = (p - swordAt) % SWORD_EVERY;
  if (local > SWORD_SWING) return 0;
  return local / SWORD_SWING;
}

export type SwordStyle = "power" | "side" | "overhead";

export function swordStyleAt(p: number, cmdK = 0): SwordStyle {
  const wave = Math.max(0, Math.floor((p - swordAt) / SWORD_EVERY));
  const k = Math.abs(wave * 5 + cmdK * 11 + 3) % 3;
  return k === 0 ? "power" : k === 1 ? "side" : "overhead";
}

export function swordSwingPose(style: SwordStyle, u: number): [number, number, number] {
  if (u <= 0) return [0, Math.PI, 0];
  let wind = 0;
  let slash = 0;
  if (u < 0.5) {
    const t = u / 0.5;
    wind = t * t * (3 - 2 * t);
  } else if (u < 0.58) {
    wind = 1;
  } else {
    wind = 1;
    const t = (u - 0.58) / 0.42;
    slash = t * t * (2 - t);
  }
  if (style === "side") {
    return [0.06 * wind + 0.18 * slash, Math.PI - 0.7 * wind + 1.45 * slash, -0.55 * wind + 0.7 * slash];
  }
  if (style === "overhead") {
    return [-0.95 * wind + 1.55 * slash, Math.PI + 0.06 * wind, 0.12 * wind - 0.18 * slash];
  }
  return [-0.58 * wind + 1.22 * slash, Math.PI - 0.32 * wind + 0.78 * slash, -0.88 * wind + 1.65 * slash];
}

function hash01(i: number, salt: number) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
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

export function sallyHitAt(i: number, n: number, commanders = 0) {
  if (isSwordVictim(i, n, commanders)) {
    const perSwing = 2 * Math.max(1, commanders);
    const wave = Math.floor(i / perSwing);
    return swordAt + wave * SWORD_EVERY + SWORD_SWING * 0.42 + (hash01(i, 9) - 0.5) * 0.16;
  }
  const first = 6.1;
  const last = 22.3;
  if (n <= 1) return last;
  const swordN = swordPairCount(n, commanders) * 2;
  const rest = Math.max(1, n - swordN);
  const k = Math.max(0, i - swordN);
  return first + (last - first) * (k / Math.max(1, rest - 1));
}

export function sallyStartAt(i: number, n: number, commanders = 0) {
  if (isSwordVictim(i, n, commanders)) return swordAt - 1.05;
  const row = Math.floor(i / raidCols(n));
  return 3 + Math.min(3.2, row * 0.07);
}

export function sallyRun(p: number, i: number, n: number, commanders = 0) {
  const start = sallyStartAt(i, n, commanders);
  const hit = sallyHitAt(i, n, commanders);
  if (p < start) return 0;
  if (p >= hit) return 1;
  return smooth01((p - start) / Math.max(0.2, hit - start));
}

export function sallyFall(p: number, i: number, n: number, commanders = 0) {
  const hit = sallyHitAt(i, n, commanders);
  if (p < hit) return 0;
  const dur = isSwordVictim(i, n, commanders) ? 0.85 : 0.45;
  return smooth01((p - hit) / dur);
}

export type RaidPose = {
  x: number;
  y: number;
  z: number;
  fall: number;
  visible: boolean;
  flung: boolean;
};

const _pose: RaidPose = { x: 0, y: 0, z: 0, fall: 0, visible: false, flung: false };

export function sallyRaiderAt(
  p: number,
  i: number,
  n: number,
  commanders = 0,
  out: RaidPose = _pose
): RaidPose {
  if (n <= 0 || i < 0 || i >= n) {
    out.visible = false;
    out.fall = 1;
    out.flung = false;
    return out;
  }
  const sword = isSwordVictim(i, n, commanders);
  const run = sallyRun(p, i, n, commanders);
  const fall = sallyFall(p, i, n, commanders);
  const row = Math.floor(i / raidCols(n));
  const reach = sword ? RAID_OUT_Z + 2.1 : RAID_OUT_Z - Math.min(4.5, row * 0.35);
  out.x = raidSlotX(i, n) * (0.2 + 0.8 * run);
  out.y = 0;
  out.z = RAID_INSIDE_Z + (reach - RAID_INSIDE_Z) * run;
  out.fall = fall;
  out.flung = false;
  out.visible = p >= 2.4 && p < 28.8;
  if (sword && fall > 0) {
    const u = fall;
    const ang = (hash01(i, 1) - 0.5) * 2.6;
    const dist = 5.2 + hash01(i, 2) * 5.5;
    const lift = 1.3 + hash01(i, 3) * 2.4;
    out.x += Math.sin(ang) * dist * u;
    out.z -= Math.cos(ang) * dist * u;
    out.y = Math.sin(u * Math.PI) * lift;
    out.flung = true;
  }
  return out;
}

export function sallyLiveIndex(p: number, n: number, salt: number, commanders = 0) {
  if (n <= 0) return -1;
  for (let k = 0; k < 8; k++) {
    const i = (Math.abs(salt) + k * 19) % n;
    if (isSwordVictim(i, n, commanders)) continue;
    if (sallyFall(p, i, n, commanders) < 0.8) return i;
  }
  return Math.abs(salt) % n;
}

export function sallyHunting(p: number) {
  return p > 3 && p < 24.2;
}
