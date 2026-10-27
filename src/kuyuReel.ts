export const KUYU_ID = "kuyu" as const;
export type KuyuId = typeof KUYU_ID;
export const KUYU_MODE = { id: KUYU_ID, label: "kuyu" } as const;
export const KUYU_SECONDS = 24;

export const KUYU_LEAD = "/models/arena3/armored.glb";
export const KUYU_HAND = "/models/arena3/medieval.glb";
export const KUYU_ORC_A = "/models/new/orc1-lite.glb";
export const KUYU_ORC_B = "/models/new/orc2-lite.glb";
export const KUYU_URLS = [KUYU_LEAD, KUYU_HAND, KUYU_ORC_A, KUYU_ORC_B] as const;
export const KUYU_FACE = 0;

export const KUYU_LINES = [
  ["DİP", "YOK"],
  ["HER KAT", "BİR ORK"],
  ["BİRİ", "TUTUYOR"],
] as const;

export function isKuyu(id: string | null | undefined): id is KuyuId {
  return id === KUYU_ID;
}

export type KuyuCam = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

export type KuyuStrike = { lift: number; chop: number };

const GUARD: KuyuStrike = { lift: 0.38, chop: 0.22 };
const FALL = 2.15;
const CATCH = 19.35;
const STEP = 1.18;

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function kuyuMarkReady() {
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function kuyuIsReady() {
  return ready;
}

export function kuyuWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function kuyuHold() {
  playAt = 0;
}

export function kuyuStart() {
  playAt = performance.now() / 1000;
}

export function kuyuT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function kuyuReset() {
  ready = false;
  playAt = 0;
}

function smo(t: number, a: number, b: number) {
  if (t <= a) return 0;
  if (t >= b) return 1;
  const k = (t - a) / (b - a);
  return k * k * (3 - 2 * k);
}

function mix(a: KuyuStrike, b: KuyuStrike, k: number): KuyuStrike {
  return { lift: a.lift + (b.lift - a.lift) * k, chop: a.chop + (b.chop - a.chop) * k };
}

function swing(p: number): KuyuStrike {
  const cocked: KuyuStrike = { lift: 1, chop: 0 };
  const impact: KuyuStrike = { lift: 0.7, chop: 1 };
  if (p <= 0 || p >= 1) return GUARD;
  if (p < 0.28) return mix(GUARD, cocked, smo(p, 0, 0.28));
  if (p < 0.44) {
    const k = (p - 0.28) / 0.16;
    return mix(cocked, impact, 1 - (1 - k) * (1 - k) * (1 - k));
  }
  if (p < 0.52) return impact;
  if (p < 0.85) return mix(impact, GUARD, smo(p, 0.52, 0.85));
  return GUARD;
}

function strikeWindow(t: number, hit: number, dur: number): KuyuStrike | null {
  const start = hit - 0.46 * dur;
  const p = (t - start) / dur;
  if (p < 0 || p > 1) return null;
  return swing(p);
}

export function kuyuHeroY(t: number) {
  const yEnd = -FALL * CATCH;
  const glide = CATCH - 0.4;
  if (t <= glide) return -FALL * t;
  if (t >= CATCH) return yEnd;
  const y0 = -FALL * glide;
  return y0 + (yEnd - y0) * smo(t, glide, CATCH);
}

export const KUYU_ORCS = Array.from({ length: 14 }, (_, i) => {
  const hit = 0.12 + i * STEP;
  return { mesh: i % 2, x: -0.58, z: 0.22, hit };
});

export const KUYU_CATCH_Y = -FALL * CATCH;

export function kuyuLead(t: number) {
  let strike = GUARD;
  const open = strikeWindow(t, KUYU_ORCS[0].hit, 1.05);
  if (open) strike = open;
  else {
    for (let i = 1; i < KUYU_ORCS.length; i++) {
      const hit = strikeWindow(t, KUYU_ORCS[i].hit, 0.78);
      if (!hit) continue;
      strike = hit;
      break;
    }
  }
  return { x: 0, y: kuyuHeroY(t), z: 0, yaw: 0, strike };
}

export function kuyuOrcPose(orc: (typeof KUYU_ORCS)[number], t: number) {
  const y = kuyuHeroY(orc.hit) + 0.02;
  const heroY = kuyuHeroY(t);
  const dy = y - heroY;
  const fall = t < orc.hit ? 0 : Math.min(1, (t - orc.hit) / 0.26);
  return { x: orc.x, y: y - fall * 0.35, z: orc.z, show: dy < 1.6 && dy > -7.2, fall };
}

export function kuyuHand(t: number) {
  const up: KuyuStrike = { lift: 0.95, chop: 0.18 };
  let strike = GUARD;
  if (t < 15.5) strike = GUARD;
  else if (t < 16.6) strike = mix(GUARD, up, smo(t, 15.5, 16.6));
  else if (t < CATCH) strike = up;
  else if (t < CATCH + 1.1) strike = mix(up, GUARD, smo(t, CATCH, CATCH + 1.1));
  return {
    x: -0.22,
    y: KUYU_CATCH_Y,
    z: 0.72,
    yaw: Math.PI,
    strike,
    show: kuyuHeroY(t) - KUYU_CATCH_Y < 14,
  };
}

function cam(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): KuyuCam {
  return { x, y, z, lx, ly, lz, fov };
}

function mixCam(a: KuyuCam, b: KuyuCam, k: number): KuyuCam {
  const e = k * k * (3 - 2 * k);
  return cam(
    a.x + (b.x - a.x) * e,
    a.y + (b.y - a.y) * e,
    a.z + (b.z - a.z) * e,
    a.lx + (b.lx - a.lx) * e,
    a.ly + (b.ly - a.ly) * e,
    a.lz + (b.lz - a.lz) * e,
    a.fov + (b.fov - a.fov) * e,
  );
}

export function kuyuCam(t: number): KuyuCam {
  const y = kuyuHeroY(t);
  const fall = cam(0.2, y + 2.05, -1.62, -0.4, y + 0.15, 0.55, 66);
  const landed = cam(0.05, y + 1.85, -2.15, 0.05, y + 0.85, 0.7, 52);
  if (t < CATCH) return fall;
  if (t < CATCH + 0.7) return mixCam(fall, landed, (t - CATCH) / 0.7);
  return landed;
}

export function kuyuCard(t: number) {
  if (t < 1) return { lines: KUYU_LINES[0], opacity: 1 };
  if (t < 2) return { lines: KUYU_LINES[1], opacity: 1 };
  if (t < 3.85) return { lines: KUYU_LINES[2], opacity: t < 3.3 ? 1 : 1 - smo(t, 3.3, 3.85) };
  return { lines: [] as readonly string[], opacity: 0 };
}

export function kuyuLeftLedges() {
  return KUYU_ORCS.map((orc) => ({
    x: 0.78,
    y: kuyuHeroY(orc.hit + STEP * 0.5) + 0.5,
    z: 0.15,
  }));
}
