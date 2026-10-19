export const ARENA_ID = "arena" as const;
export type ArenaId = typeof ARENA_ID;
export const ARENA_MODE = { id: ARENA_ID, label: "arena" } as const;
export const ARENA_SECONDS = 60;
export const ARENA_FOES = 50;
export const ARENA_HEROES = 5;

const INNER = 22;

export function isArena(id: string | null | undefined): id is ArenaId {
  return id === ARENA_ID;
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

export function arenaFoe(i: number, t: number, out: ArenaPose) {
  const home = foeHome(i);
  const die = arenaDieAt(i);
  const rush = Math.max(0, Math.min(1, (t - 0.8) / 7.2));
  const ease = rush * rush * (3 - 2 * rush);
  const radius = home.ring - ease * (home.ring - (home.ring < 4 ? 2.45 : 3.85)) + Math.sin(t * 1.6 + i) * 0.1;
  const bob = Math.sin(t * 6.5 + i) * 0.03;
  const side = Math.cos(t * 1.15 + i * 0.8) * 0.16;
  const x = Math.sin(home.ang) * radius + Math.cos(home.ang) * side;
  const z = Math.cos(home.ang) * radius - Math.sin(home.ang) * side;
  const face = Math.atan2(-x, -z) - Math.PI / 2;
  if (t < die) {
    out.x = x;
    out.y = 0.02 + Math.abs(bob);
    out.z = z;
    out.rx = 0.16 + Math.max(0, Math.sin(t * 5.2 + i * 0.7)) * 0.1;
    out.ry = face;
    out.rz = Math.sin(t * 4.4 + i) * 0.04;
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
  const sway = Math.sin(t * 2.4 + i * 1.1) * 0.1 * alive;
  out.x = Math.sin(ang) * radius + Math.cos(ang) * sway;
  out.z = Math.cos(ang) * radius - Math.sin(ang) * sway;
  out.ry = ang;
  out.rz = Math.sin(t * 8.2 + i) * 0.05;
  const chop = Math.max(0, Math.sin(t * 6.4 + i * 1.4));
  out.rx = chop * 0.55;
  out.y = chop * 0.02;
  out.x += Math.sin(ang) * chop * 0.14;
  out.z += Math.cos(ang) * chop * 0.14;
  out.s = 1;
  const kneel = i === 1 && t > 15 && t < 27;
  const stumble = i === 3 && t > 33 && t < 40;
  if (kneel) {
    const k = t < 17 ? (t - 15) / 2 : t > 24 ? (27 - t) / 3 : 1;
    out.rx = 1.05 * k;
    out.y = -0.28 * k;
    out.rz = 0.18 * k;
  } else if (stumble) {
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
  let dist = 32;
  let y = 16.8;
  let lookY = 1.45;
  let fov = 53;
  if (t < 4.5) {
    const k = t / 4.5;
    const e = k * k * (3 - 2 * k);
    dist = 42 - e * 10;
    y = 26 - e * 9.2;
    lookY = 1.25;
    fov = 54 - e * 1;
  } else if (t > 52) {
    const k = (t - 52) / 8;
    const e = k * k * (3 - 2 * k);
    dist = 32 + e * 3.5;
    y = 16.8 + e * 3.2;
    lookY = 1.7;
  } else {
    dist = 32 + Math.sin((t - 4.5) * 0.28) * 0.4;
    y = 16.8 + Math.sin((t - 4.5) * 0.21) * 0.3;
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
