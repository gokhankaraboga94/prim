export const ARENA_ID = "arena" as const;
export type ArenaId = typeof ARENA_ID;
export const ARENA_MODE = { id: ARENA_ID, label: "arena" } as const;
export const ARENA_SECONDS = 60;
export const ARENA_FOES = 50;
export const ARENA_HERO_URLS = [
  "/models/heroes/armored.glb",
  "/models/heroes/fantasy-a.glb",
  "/models/heroes/fantasy-b.glb",
  "/models/heroes/fantasy.glb",
  "/models/heroes/medieval.glb",
  "/models/mavi_püsküllü_knight.glb",
] as const;
export const ARENA_HEROES = ARENA_HERO_URLS.length;

export const ARENA2_ID = "arena2" as const;
export type Arena2Id = typeof ARENA2_ID;
export const ARENA2_MODE = { id: ARENA2_ID, label: "arena2" } as const;
export const ARENA2_SECONDS = ARENA_SECONDS;
export const ARENA2_HERO_URLS = [
  ...ARENA_HERO_URLS,
  "/models/1.glb",
  "/models/2.glb",
  "/models/3.glb",
] as const;
export const ARENA2_HEROES = ARENA2_HERO_URLS.length;
/** Arena2 only: foes stand one step further out so the 9 heroes have room. */
export const ARENA2_FOE_PUSH = 0.6;

/**
 * Arena3: same fight as arena2 on packed models. The source GLBs are 0.5–1.1M
 * vertices each (330 MB for 9 heroes), which phones cannot download, parse and
 * simplify inside the reel. These copies were built offline with gltf-transform
 * (weld, simplify to ~6% with 1% error, textures 1024 WebP): about 27 MB total.
 */
export const ARENA3_ID = "arena3" as const;
export type Arena3Id = typeof ARENA3_ID;
export const ARENA3_MODE = { id: ARENA3_ID, label: "arena3" } as const;
export const ARENA3_SECONDS = ARENA_SECONDS;
export const ARENA3_ARENA_URL = "/models/arena3/arena.glb";
export const ARENA3_HERO_URLS = [
  "/models/arena3/armored.glb",
  "/models/arena3/fantasy-a.glb",
  "/models/arena3/fantasy-b.glb",
  "/models/arena3/fantasy.glb",
  "/models/arena3/medieval.glb",
  "/models/arena3/mavi.glb",
  "/models/arena3/1.glb",
  "/models/arena3/2.glb",
  "/models/arena3/3.glb",
] as const;

const INNER = 22;

export function isArena(id: string | null | undefined): id is ArenaId {
  return id === ARENA_ID;
}

export function isArena2(id: string | null | undefined): id is Arena2Id {
  return id === ARENA2_ID;
}

export function isArena3(id: string | null | undefined): id is Arena3Id {
  return id === ARENA3_ID;
}

/** Newest joiners, one plate per hero. A later recording reads the list again. */
export function arenaHeroNames(names: string[], count: number = ARENA_HEROES): string[] {
  const picked: string[] = [];
  const seen = new Set<string>();
  for (let i = names.length - 1; i >= 0 && picked.length < count; i--) {
    const raw = String(names[i] || "").trim().replace(/^@+/, "");
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(raw);
  }
  return picked;
}

const ARENA_DEATHS = (() => {
  const times = new Array<number>(ARENA_FOES);
  const order = Array.from({ length: ARENA_FOES }, (_, i) => i);
  let seed = 91;
  for (let i = order.length - 1; i > 0; i--) {
    seed = (seed * 16807) % 2147483647;
    const j = seed % (i + 1);
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  let t = 0.85;
  let n = 0;
  let beat = 0;
  while (n < ARENA_FOES) {
    const pair = beat % 2 === 0 && n + 1 < ARENA_FOES;
    times[order[n]] = t;
    n += 1;
    if (pair) {
      times[order[n]] = t + 0.18;
      n += 1;
    }
    const wobble = ((beat * 3) % 5) * 0.08 - 0.16;
    t += (pair ? 1.9 : 1.35) + wobble;
    beat += 1;
  }
  return times;
})();

export function arenaDieAt(i: number) {
  return ARENA_DEATHS[i] ?? ARENA_SECONDS;
}

export function arenaAlive(t: number) {
  let n = 0;
  for (let i = 0; i < ARENA_FOES; i++) if (t < arenaDieAt(i)) n += 1;
  return n;
}

export type ArenaPose = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  s: number;
};

function foeHome(i: number) {
  const inner = i < INNER;
  const idx = inner ? i : i - INNER;
  const count = inner ? INNER : ARENA_FOES - INNER;
  const ang = (idx / count) * Math.PI * 2 + (inner ? 0.18 : 0.04);
  return { ang, ring: inner ? 3.45 : 5.05 };
}

export type ArmStrike = { lift: number; chop: number };

const REST_STRIKE: ArmStrike = { lift: 0, chop: 0 };

/** Between strikes a fighter holds the weapon half raised in front, never hanging. */
const GUARD_STRIKE: ArmStrike = { lift: 0.38, chop: 0.22 };

function mixStrike(a: ArmStrike, b: ArmStrike, k: number): ArmStrike {
  return { lift: a.lift + (b.lift - a.lift) * k, chop: a.chop + (b.chop - a.chop) * k };
}

/**
 * One strike, from guard back to guard. Windup 0–28% cocks the arm out and back
 * (elbow bent), the chop lands over the next 16% (about 120 ms at 0.75 s), the
 * hand holds on the target 8%, recovery eases back into guard by 85%. `amp`
 * lowers the windup for a lighter cut.
 */
function swing(p: number, amp: number): ArmStrike {
  const cocked: ArmStrike = { lift: amp, chop: 0 };
  const impact: ArmStrike = { lift: amp * 0.7, chop: 1 };
  if (p < 0.28) {
    const k = p / 0.28;
    return mixStrike(GUARD_STRIKE, cocked, k * k * (3 - 2 * k));
  }
  if (p < 0.44) {
    const k = (p - 0.28) / 0.16;
    return mixStrike(cocked, impact, 1 - (1 - k) * (1 - k) * (1 - k));
  }
  if (p < 0.52) return impact;
  if (p < 0.85) {
    const k = (p - 0.52) / 0.33;
    return mixStrike(impact, GUARD_STRIKE, k * k * (3 - 2 * k));
  }
  return GUARD_STRIKE;
}

/**
 * Combos, not a metronome: `blows` quick strikes of `dur` seconds each, then
 * guard until the bar of `bar` seconds ends. Every other strike is lighter.
 */
function combo(t: number, bar: number, blows: number, dur: number, phase: number): ArmStrike {
  const local = (((t + phase) % bar) + bar) % bar;
  const n = Math.floor(local / dur);
  if (n >= blows) return GUARD_STRIKE;
  const beat = Math.floor((t + phase) / bar) * blows + n;
  return swing((local - n * dur) / dur, beat % 2 === 0 ? 1 : 0.8);
}

function heroBlow(i: number, t: number) {
  const blows = 2 + (i % 2);
  const dur = 0.72 + (i % 3) * 0.05;
  const bar = blows * dur + 0.7 + (i % 4) * 0.22;
  return combo(t, bar, blows, dur, i * 0.53);
}

function foeBlow(i: number, t: number) {
  const dur = 0.86 + (i % 4) * 0.05;
  const bar = dur + 0.9 + (i % 5) * 0.21;
  return combo(t, bar, 1, dur, i * 0.37);
}

export function arenaHeroStrike(i: number, t: number): ArmStrike {
  if (i === 1 && t > 15) return REST_STRIKE;
  if (i === 3 && t > 33 && t < 40) return REST_STRIKE;
  return heroBlow(i, t);
}

export function arenaFoeStrike(i: number, t: number): ArmStrike {
  if (t >= arenaDieAt(i)) return REST_STRIKE;
  return foeBlow(i, t);
}

export function arenaFoe(i: number, t: number, out: ArenaPose, push = 0) {
  const home = foeHome(i);
  const die = arenaDieAt(i);
  const rush = Math.max(0, Math.min(1, (t - 0.8) / 7.2));
  const ease = rush * rush * (3 - 2 * rush);
  const inner = home.ring < 4;
  const radius = push + home.ring - ease * (home.ring - (inner ? 2.45 : 3.85));
  const x = Math.sin(home.ang) * radius;
  const z = Math.cos(home.ang) * radius;
  const face = Math.atan2(-x, -z) - Math.PI / 2;
  if (t < die) {
    out.x = x;
    out.y = 0;
    out.z = z;
    out.rx = 0;
    out.ry = face;
    out.rz = 0;
    out.s = 1;
    return;
  }
  const u = (t - die) / 0.8;
  if (u >= 1) {
    out.x = x;
    out.y = -24;
    out.z = z;
    out.rx = 0;
    out.ry = face;
    out.rz = 0;
    out.s = 0;
    return;
  }
  out.x = x;
  out.z = z;
  out.y = -u * u * 9;
  out.rx = Math.min(1.2, u * 1.7);
  out.ry = face;
  out.rz = (i % 2 ? 1 : -1) * u * 0.28;
  out.s = 1;
}

export function arenaHero(i: number, t: number, out: ArenaPose, heroes: number = ARENA_HEROES) {
  const count = Math.max(1, heroes);
  const ang = (i / count) * Math.PI * 2;
  const alive = arenaAlive(t) / ARENA_FOES;
  const radius = 1.65 * (0.74 + alive * 0.38);
  const stumble = i === 3 && t > 33 && t < 40;
  out.x = Math.sin(ang) * radius;
  out.z = Math.cos(ang) * radius;
  out.ry = ang;
  out.rx = 0;
  out.rz = 0;
  out.y = 0;
  out.s = 1;
  if (i === 1 && t > 15) {
    const u = Math.min(1, (t - 15) / 1.25);
    const e = u * u * (3 - 2 * u);
    out.rx = 1.4 * e;
    out.y = -0.08 * e;
    out.rz = 0.42 * e;
    return;
  }
  if (stumble) {
    const k = t < 34.2 ? (t - 33) / 1.2 : t > 37.5 ? (40 - t) / 2.5 : 1;
    out.rx = -0.55 * k;
    out.y = 0.04;
    out.rz = -0.28 * k;
  }
}

export type ArenaCam = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

export function arenaCam(t: number): ArenaCam {
  const u = Math.max(0, Math.min(1, t / ARENA_SECONDS));
  const ang = u * Math.PI * 2 * 1.05;
  let dist = 10.8;
  let y = 6.025;
  let lookY = 1.15;
  let fov = 46;
  if (t < 4.5) {
    const k = t / 4.5;
    const e = k * k * (3 - 2 * k);
    dist = 17 - e * 6.2;
    y = 9.85 - e * 3.825;
    lookY = 1.1;
    fov = 51 - e * 5;
  } else if (t > 52) {
    const k = (t - 52) / 8;
    const e = k * k * (3 - 2 * k);
    dist = 10.8 + e * 1.2;
    y = 6.025 + e * 0.9;
    lookY = 1.35;
  } else {
    dist = 10.8 + Math.sin((t - 4.5) * 0.28) * 0.125;
    y = 6.025 + Math.sin((t - 4.5) * 0.21) * 0.08;
  }
  return {
    x: Math.sin(ang) * dist,
    y,
    z: Math.cos(ang) * dist,
    lx: 0,
    ly: lookY,
    lz: 0,
    fov,
  };
}
