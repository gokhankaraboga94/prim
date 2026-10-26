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
export const KURTAR_ELF = "/models/new/elf-lite.glb";
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
  const impact: KurtarStrike = { lift: 0.7, chop: 1 };
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

function strikeWindow(t: number, hit: number, dur = 0.72): KurtarStrike | null {
  const start = hit - 0.46 * dur;
  const p = (t - start) / dur;
  if (p < 0 || p > 1) return null;
  return swing(p);
}

const LEAD_HITS = [0.42, 4.85, 8.15, 9.25, 10.4, 14.15, 15.05, 15.95, 16.85, 21.05, 22.25];

const HP_CHIPS = [
  { t: 0.42, d: 5 },
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
  [3.05, 0.25],
  [4.7, 2.15],
  [5.55, 2.35],
  [7.45, 7.85],
  [8.05, 7.95],
  [8.9, 8.85],
  [10.05, 9.85],
  [10.55, 10.05],
  [12.15, 12.15],
  [13.85, 12.85],
  [14.9, 13.15],
  [15.8, 13.45],
  [16.7, 13.7],
  [18.15, 16.2],
  [20.35, 19.35],
  [20.9, 19.55],
  [22.1, 19.9],
  [23.2, 20.15],
  [38, 20.2],
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
  { id: 0, mesh: 0, x: 0.15, z: 1.62, fromX: 0.15, fromZ: 1.62, enter: -1, hit: 0.42, hide: 3.1 },
  { id: 1, mesh: 1, x: 0.72, z: 3.55, fromX: 1.85, fromZ: 5.4, enter: 3.15, hit: 4.85, hide: 7.2 },
  { id: 2, mesh: 0, x: -0.48, z: 8.85, fromX: -1.35, fromZ: 10.4, enter: 7.45, hit: 8.15, hide: 11.2 },
  { id: 3, mesh: 1, x: 0.55, z: 9.9, fromX: 1.45, fromZ: 11.6, enter: 8.45, hit: 9.25, hide: 12.1 },
  { id: 4, mesh: 0, x: 0.05, z: 11.15, fromX: 0.2, fromZ: 13.1, enter: 9.55, hit: 10.4, hide: 13.0 },
  { id: 5, mesh: 1, x: -1.05, z: 14.15, fromX: -1.7, fromZ: 16.6, enter: 13.35, hit: 14.15, hide: 18.2 },
  { id: 6, mesh: 0, x: -0.25, z: 14.55, fromX: -0.4, fromZ: 17.1, enter: 13.45, hit: 15.05, hide: 18.4 },
  { id: 7, mesh: 1, x: 0.55, z: 14.35, fromX: 0.9, fromZ: 16.9, enter: 13.55, hit: 15.95, hide: 18.6 },
  { id: 8, mesh: 0, x: 1.15, z: 14.85, fromX: 1.8, fromZ: 17.3, enter: 13.65, hit: 16.85, hide: 18.8 },
  { id: 9, mesh: 1, x: -0.95, z: 21.35, fromX: -0.95, fromZ: 21.35, enter: 19.6, hit: 21.05, hide: 24.2 },
  { id: 10, mesh: 0, x: 0.95, z: 21.45, fromX: 0.95, fromZ: 21.45, enter: 19.6, hit: 22.25, hide: 24.4 },
  { id: 11, mesh: 1, x: -1.55, z: 19.15, fromX: -4.2, fromZ: 18.2, enter: 24.35, hit: 34.55, hide: 37.6 },
  { id: 12, mesh: 0, x: 1.55, z: 19.05, fromX: 4.3, fromZ: 18.4, enter: 24.45, hit: 34.8, hide: 37.6 },
  { id: 13, mesh: 1, x: -1.15, z: 21.15, fromX: -3.4, fromZ: 22.4, enter: 24.55, hit: 35.05, hide: 37.6 },
  { id: 14, mesh: 0, x: 1.2, z: 21.25, fromX: 3.5, fromZ: 22.5, enter: 24.65, hit: 35.3, hide: 37.6 },
  { id: 15, mesh: 1, x: -0.35, z: 18.55, fromX: -2.2, fromZ: 16.4, enter: 24.5, hit: 35.55, hide: 37.6 },
  { id: 16, mesh: 0, x: 0.4, z: 18.45, fromX: 2.4, fromZ: 16.2, enter: 24.6, hit: 35.8, hide: 37.6 },
];

export const KURTAR_ALLY_SLOTS = [
  { x: -1.35, z: 19.35, side: -1, run: 28.45, zoom0: 28.85, zoom1: 29.95, hit: 34.55 },
  { x: 1.4, z: 19.25, side: 1, run: 29.95, zoom0: 30.15, zoom1: 31.25, hit: 34.8 },
  { x: -1.05, z: 20.55, side: -1, run: 31.25, zoom0: 31.45, zoom1: 32.55, hit: 35.05 },
  { x: 1.15, z: 20.65, side: 1, run: 32.55, zoom0: 32.75, zoom1: 33.85, hit: 35.3 },
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
  const open = strikeWindow(t, LEAD_HITS[0], 2.62);
  if (open) strike = open;
  else {
    for (let i = 1; i < LEAD_HITS.length; i++) {
      const hit = strikeWindow(t, LEAD_HITS[i], 0.7);
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
  const fall = clamp((t - orc.hit) / 0.48, 0, 1);
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
  const x = slot.side * 7.2 + (slot.x - slot.side * 7.2) * arrive;
  const z = 16.2 + (slot.z - 16.2) * arrive;
  const zooming = t >= slot.zoom0 && t <= slot.zoom1;
  const yaw = zooming ? Math.PI : 0;
  const strike = strikeWindow(t, slot.hit, 0.62) ?? GUARD;
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

export function kurtarCam(t: number): KurtarCam {
  for (let i = 0; i < KURTAR_ALLY_SLOTS.length; i++) {
    const slot = KURTAR_ALLY_SLOTS[i];
    if (t >= slot.zoom0 && t <= slot.zoom1) return faceCam(i);
  }
  const hero = kurtarLead(t);
  if (t >= 36.2) {
    const k = smo(t, 36.2, 37);
    const followZ = hero.z - 2.85;
    return {
      x: 0.62 + (0.15 - 0.62) * k,
      y: 1.9 + (1.62 - 1.9) * k,
      z: followZ + (20.15 - followZ) * k,
      lx: 0,
      ly: 1.32,
      lz: 23.2,
      fov: 50 - 6 * k,
    };
  }
  const breathe = t < 3.2 ? 0 : Math.sin(t * 1.4) * 0.04;
  const close = t < 3.2;
  return {
    x: close ? 0.42 : 0.62,
    y: (close ? 1.68 : 2.02) - hero.kneel * 0.25,
    z: hero.z - (close ? 2.05 : 2.85),
    lx: 0.08,
    ly: close ? 1.38 : 1.22,
    lz: hero.z + (close ? 1.15 : 1.85),
    fov: (close ? 46 : 50) + breathe,
  };
}
