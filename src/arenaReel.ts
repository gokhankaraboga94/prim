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

const INNER = 22;

export function isArena(id: string | null | undefined): id is ArenaId {
  return id === ARENA_ID;
}

/** Newest joiners, one plate per hero. A later recording reads the list again. */
export function arenaHeroNames(names: string[]): string[] {
  const picked: string[] = [];
  const seen = new Set<string>();
  for (let i = names.length - 1; i >= 0 && picked.length < ARENA_HEROES; i--) {
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

function swing(u: number): ArmStrike {
  const p = u - Math.floor(u);
  if (p < 0.36) {
    const k = p / 0.36;
    return { lift: k * k, chop: 0 };
  }
  if (p < 0.5) {
    const k = (p - 0.36) / 0.14;
    const e = k * k * (3 - 2 * k);
    return { lift: 1 - e * 0.35, chop: e };
  }
  if (p < 0.74) {
    const k = (p - 0.5) / 0.24;
    const e = k * k * (3 - 2 * k);
    return { lift: 0.65 * (1 - e), chop: 1 - e };
  }
  return REST_STRIKE;
}

function heroBlow(i: number, t: number) {
  const period = 0.86 + (i % 3) * 0.07;
  return swing(t / period + i * 0.41);
}

function foeBlow(i: number, t: number) {
  const period = 1.08 + (i % 4) * 0.06;
  return swing(t / period + i * 0.17);
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

export function arenaFoe(i: number, t: number, out: ArenaPose) {
  const home = foeHome(i);
  const die = arenaDieAt(i);
  const rush = Math.max(0, Math.min(1, (t - 0.8) / 7.2));
  const ease = rush * rush * (3 - 2 * rush);
  const inner = home.ring < 4;
  const radius = home.ring - ease * (home.ring - (inner ? 2.45 : 3.85));
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

export function arenaHero(i: number, t: number, out: ArenaPose) {
  const ang = (i / ARENA_HEROES) * Math.PI * 2;
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
