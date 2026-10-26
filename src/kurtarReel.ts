export const KURTAR_ID = "kurtar" as const;
export type KurtarId = typeof KURTAR_ID;
export const KURTAR_MODE = { id: KURTAR_ID, label: "kurtar" } as const;
export const KURTAR_SECONDS = 38;

export const KURTAR_LEAD = "/models/arena3/armored.glb";
export const KURTAR_ALLIES = [
  "/models/arena3/fantasy.glb",
  "/models/arena3/medieval.glb",
  "/models/arena3/fantasy-a.glb",
  "/models/arena3/fantasy-b.glb",
] as const;
/** Pointed-ear woman in green and gold. The blue-cape archer is a different figure. */
export const KURTAR_ELF = "/models/arena3/3.glb";
export const KURTAR_CAGE_Z = 36.2;
export const KURTAR_ELF_Z = 37.55;
export const KURTAR_ORC_A = "/models/new/orc1-lite.glb";
export const KURTAR_ORC_B = "/models/new/orc2-lite.glb";

export const KURTAR_URLS = [KURTAR_LEAD, ...KURTAR_ALLIES, KURTAR_ELF, KURTAR_ORC_A, KURTAR_ORC_B] as const;

/** Arena packs face +Z at this yaw. Adjusted if a screenshot shows a profile. */
export const KURTAR_FACE = 0;

export function isKurtar(id: string | null | undefined): id is KurtarId {
  return id === KURTAR_ID;
}

export type KurtarCam = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

export type KurtarStrike = { lift: number; chop: number };

const GUARD: KurtarStrike = { lift: 0.38, chop: 0.22 };

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function kurtarMarkReady() {
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function kurtarIsReady() {
  return ready;
}

export function kurtarWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function kurtarHold() {
  playAt = 0;
}

export function kurtarStart() {
  playAt = performance.now() / 1000;
}

export function kurtarT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function kurtarReset() {
  ready = false;
  playAt = 0;
}

function smo(t: number, a: number, b: number) {
  if (t <= a) return 0;
  if (t >= b) return 1;
  const k = (t - a) / (b - a);
  return k * k * (3 - 2 * k);
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function mix(a: KurtarStrike, b: KurtarStrike, k: number): KurtarStrike {
  return { lift: a.lift + (b.lift - a.lift) * k, chop: a.chop + (b.chop - a.chop) * k };
}

function swing(p: number): KurtarStrike {
  const cocked: KurtarStrike = { lift: 1, chop: 0 };
  const impact: KurtarStrike = { lift: 0.55, chop: 1 };
  if (p <= 0 || p >= 1) return GUARD;
  if (p < 0.12) return mix(GUARD, cocked, smo(p, 0, 0.12));
  if (p < 0.28) {
    const k = (p - 0.12) / 0.16;
    return mix(cocked, impact, 1 - (1 - k) * (1 - k) * (1 - k));
  }
  if (p < 0.36) return impact;
  if (p < 0.68) return mix(impact, GUARD, smo(p, 0.36, 0.68));
  return GUARD;
}

function strikeWindow(t: number, hit: number, dur = 0.38): KurtarStrike | null {
  const start = hit - 0.32 * dur;
  const p = (t - start) / dur;
  if (p < 0 || p > 1) return null;
  return swing(p);
}

const LEAD_HITS = [0.16, 4.85, 8.15, 9.25, 10.4, 14.15, 15.05, 15.95, 16.85, 21.05, 22.25];

const HP_CHIPS = [
  { t: 0.16, d: 5 },
  { t: 4.85, d: 6 },
  { t: 8.15, d: 5 },
  { t: 9.25, d: 6 },
  { t: 10.4, d: 6 },
  { t: 14.15, d: 4 },
  { t: 15.05, d: 5 },
  { t: 15.95, d: 5 },
  { t: 16.85, d: 6 },
  { t: 21.05, d: 4 },
  { t: 22.25, d: 5 },
];

const HERO_Z: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [3.05, 0.45],
  [4.7, 3.6],
  [5.55, 3.9],
  [7.45, 12.8],
  [8.05, 13.0],
  [8.9, 14.4],
  [10.05, 16.1],
  [10.55, 16.4],
  [12.15, 19.8],
  [13.85, 20.9],
  [14.9, 21.4],
  [15.8, 21.9],
  [16.7, 22.3],
  [18.15, 26.4],
  [20.35, 31.4],
  [20.9, 31.8],
  [22.1, 32.4],
  [23.2, 32.8],
  [38, 33.0],
];

export type KurtarOrc = {
  id: number;
  mesh: 0 | 1;
  x: number;
  z: number;
  fromX: number;
  fromZ: number;
  enter: number;
  hit: number;
  hide: number;
};

export const KURTAR_ORCS: readonly KurtarOrc[] = [
  { id: 0, mesh: 0, x: 0.2, z: 2.55, fromX: 0.2, fromZ: 2.55, enter: -1, hit: 0.16, hide: 3.1 },
  { id: 1, mesh: 1, x: 0.9, z: 5.7, fromX: 2.3, fromZ: 8.6, enter: 3.15, hit: 4.85, hide: 7.2 },
  { id: 2, mesh: 0, x: -0.7, z: 14.2, fromX: -1.8, fromZ: 16.8, enter: 7.45, hit: 8.15, hide: 11.2 },
  { id: 3, mesh: 1, x: 0.75, z: 16.0, fromX: 1.9, fromZ: 18.6, enter: 8.45, hit: 9.25, hide: 12.1 },
  { id: 4, mesh: 0, x: 0.05, z: 18.0, fromX: 0.3, fromZ: 21.0, enter: 9.55, hit: 10.4, hide: 13.0 },
  { id: 5, mesh: 1, x: -1.45, z: 22.8, fromX: -2.3, fromZ: 26.6, enter: 13.35, hit: 14.15, hide: 18.2 },
  { id: 6, mesh: 0, x: -0.35, z: 23.5, fromX: -0.5, fromZ: 27.4, enter: 13.45, hit: 15.05, hide: 18.4 },
  { id: 7, mesh: 1, x: 0.7, z: 23.1, fromX: 1.2, fromZ: 27.0, enter: 13.55, hit: 15.95, hide: 18.6 },
  { id: 8, mesh: 0, x: 1.55, z: 23.9, fromX: 2.4, fromZ: 27.8, enter: 13.65, hit: 16.85, hide: 18.8 },
  { id: 9, mesh: 1, x: -1.35, z: 35.25, fromX: -1.35, fromZ: 35.25, enter: -1, hit: 21.05, hide: 24.2 },
  { id: 10, mesh: 0, x: 1.35, z: 35.4, fromX: 1.35, fromZ: 35.4, enter: -1, hit: 22.25, hide: 24.4 },
  { id: 11, mesh: 1, x: -2.55, z: 31.1, fromX: -4.5, fromZ: 29.4, enter: 24.35, hit: 34.55, hide: 37.6 },
  { id: 12, mesh: 0, x: 2.55, z: 30.9, fromX: 4.5, fromZ: 29.6, enter: 24.45, hit: 34.8, hide: 37.6 },
  { id: 13, mesh: 1, x: -1.9, z: 34.3, fromX: -4.2, fromZ: 36.6, enter: 24.55, hit: 35.05, hide: 37.6 },
  { id: 14, mesh: 0, x: 1.95, z: 34.4, fromX: 4.2, fromZ: 36.8, enter: 24.65, hit: 35.3, hide: 37.6 },
  { id: 15, mesh: 1, x: -0.7, z: 30.1, fromX: -3.4, fromZ: 26.8, enter: 24.5, hit: 35.55, hide: 37.6 },
  { id: 16, mesh: 0, x: 0.75, z: 29.9, fromX: 3.4, fromZ: 26.6, enter: 24.6, hit: 35.8, hide: 37.6 },
];

export const KURTAR_ALLY_SLOTS = [
  { x: -2.15, z: 31.4, side: -1, run: 28.45, zoom0: 28.85, zoom1: 29.95, hit: 34.55 },
  { x: 2.2, z: 31.2, side: 1, run: 29.95, zoom0: 30.15, zoom1: 31.25, hit: 34.8 },
  { x: -1.65, z: 33.4, side: -1, run: 31.25, zoom0: 31.45, zoom1: 32.55, hit: 35.05 },
  { x: 1.75, z: 33.5, side: 1, run: 32.55, zoom0: 32.75, zoom1: 33.85, hit: 35.3 },
] as const;

export function kurtarHeroZ(t: number) {
  const keys = HERO_Z;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const k = smo(t, keys[i - 1][0], keys[i][0]);
      return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * k;
    }
  }
  return keys[keys.length - 1][1];
}

export function kurtarLead(t: number) {
  const z = kurtarHeroZ(t);
  let strike = GUARD;
  const open = strikeWindow(t, LEAD_HITS[0], 1.05);
  if (open) strike = open;
  else {
    for (let i = 1; i < LEAD_HITS.length; i++) {
      const hit = strikeWindow(t, LEAD_HITS[i], 0.38);
      if (hit) {
        strike = hit;
        break;
      }
    }
  }
  const kneel = t < 24.6 ? 0 : t < 29 ? smo(t, 24.8, 27.2) * 0.42 : 0.42 * (1 - smo(t, 29.2, 33.4));
  return { x: 0, y: 0, z, yaw: 0, kneel, strike };
}

export function kurtarOrcPose(orc: KurtarOrc, t: number) {
  const k = smo(t, orc.enter, Math.max(orc.enter + 0.05, orc.hit - 0.12));
  const fall = clamp((t - orc.hit) / 0.28, 0, 1);
  return {
    x: orc.fromX + (orc.x - orc.fromX) * k,
    z: orc.fromZ + (orc.z - orc.fromZ) * k,
    fall,
    show: t >= orc.enter - 0.05 && t < orc.hide,
  };
}

export function kurtarHp(t: number) {
  let hp = 100;
  for (const chip of HP_CHIPS) if (t >= chip.t) hp -= chip.d;
  if (t >= 24.6) hp += (8 - hp) * smo(t, 24.6, 27.6);
  return Math.max(0, Math.round(hp));
}

export function kurtarChip(t: number) {
  for (let i = HP_CHIPS.length - 1; i >= 0; i--) {
    const age = t - HP_CHIPS[i].t;
    if (age >= 0 && age < 0.7) return { d: HP_CHIPS[i].d, age };
  }
  if (t >= 24.6 && t <= 27.7) {
    const age = (t - 24.6) % 0.55;
    return { d: 6, age };
  }
  return null;
}

export function kurtarBars(t: number) {
  return smo(t, 36.15, 37.35);
}

export function kurtarCard(t: number) {
  if (t < 3.15) return { line: "ONU KURTAR", opacity: t < 2.55 ? 1 : 1 - smo(t, 2.55, 3.15) };
  if (t > 24.7 && t < 27.35) return { line: "CANI BİTİYOR", opacity: t < 26.7 ? 1 : 1 - smo(t, 26.7, 27.35) };
  return { line: "", opacity: 0 };
}

export function kurtarAllyPose(i: number, t: number) {
  const slot = KURTAR_ALLY_SLOTS[i];
  const arrive = smo(t, slot.run, slot.zoom0);
  const x = slot.side * 4.7 + (slot.x - slot.side * 4.7) * arrive;
  const z = 26.4 + (slot.z - 26.4) * arrive;
  const zooming = t >= slot.zoom0 && t <= slot.zoom1;
  const yaw = zooming ? Math.PI : 0;
  const strike = strikeWindow(t, slot.hit, 0.36) ?? GUARD;
  return { x, y: 0, z, yaw, strike, show: t >= slot.run - 0.05 };
}

function faceCam(i: number): KurtarCam {
  const slot = KURTAR_ALLY_SLOTS[i];
  return {
    x: slot.x,
    y: 1.52,
    z: slot.z - 1.28,
    lx: slot.x,
    ly: 1.48,
    lz: slot.z + 0.05,
    fov: 32,
  };
}

function mixCam(a: KurtarCam, b: KurtarCam, k: number): KurtarCam {
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    z: a.z + (b.z - a.z) * k,
    lx: a.lx + (b.lx - a.lx) * k,
    ly: a.ly + (b.ly - a.ly) * k,
    lz: a.lz + (b.lz - a.lz) * k,
    fov: a.fov + (b.fov - a.fov) * k,
  };
}

function followCam(hero: { z: number; kneel: number }, close: boolean): KurtarCam {
  return {
    x: close ? 0.42 : 0.7,
    y: (close ? 1.72 : 2.15) - hero.kneel * 0.25,
    z: hero.z - (close ? 2.15 : 3.1),
    lx: 0.05,
    ly: close ? 1.4 : 1.28,
    lz: hero.z + (close ? 1.25 : 2.1),
    fov: close ? 46 : 50,
  };
}

function ringCam(heroZ: number): KurtarCam {
  return {
    x: 0,
    y: 1.95,
    z: Math.min(heroZ - 7.2, 25.8),
    lx: 0,
    ly: 1.4,
    lz: heroZ + 2.6,
    fov: 78,
  };
}

export function kurtarCam(t: number): KurtarCam {
  for (let i = 0; i < KURTAR_ALLY_SLOTS.length; i++) {
    const slot = KURTAR_ALLY_SLOTS[i];
    if (t >= slot.zoom0 && t <= slot.zoom1) return faceCam(i);
  }
  const hero = kurtarLead(t);
  if (t >= 33.85) {
    const wide = ringCam(hero.z);
    const finale: KurtarCam = {
      x: 0,
      y: 1.85,
      z: 25.2,
      lx: 0,
      ly: 1.4,
      lz: KURTAR_CAGE_Z + 0.6,
      fov: 76,
    };
    return mixCam(wide, finale, smo(t, 33.85, 34.45));
  }
  const follow = followCam(hero, t < 3.2);
  if (t >= 23.5) return mixCam(follow, ringCam(hero.z), smo(t, 23.5, 24.35));
  if (t < 3.2) return follow;
  return { ...follow, fov: follow.fov + Math.sin(t * 1.4) * 0.04 };
}
