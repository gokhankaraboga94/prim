export const ARENA_ID = "arena" as const;
export type ArenaId = typeof ARENA_ID;
export const ARENA_MODE = { id: ARENA_ID, label: "arena" } as const;
export const ARENA_SECONDS = 60;
export const ARENA_FOES = 50;
export const ARENA_HEROES = 5;

export const ARENA_FLOOR = 3.35;
export const ARENA_CAGE = 3.72;
export const ARENA_CAGE_H = 3.45;

const INNER = 22;

export function isArena(id: string | null | undefined): id is ArenaId {
  return id === ARENA_ID;
}

export function arenaDieAt(i: number) {
  const u = ARENA_FOES <= 1 ? 1 : i / (ARENA_FOES - 1);
  const e = Math.pow(u, 2.15);
  return 11 + e * 43;
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
  return { ang, ring: inner ? 2.15 : 2.95 };
}

export function arenaFoe(i: number, t: number, out: ArenaPose) {
  const home = foeHome(i);
  const die = arenaDieAt(i);
  const rush = Math.max(0, Math.min(1, (t - 0.8) / 7.2));
  const ease = rush * rush * (3 - 2 * rush);
  const radius = home.ring - ease * (home.ring - (home.ring < 2.4 ? 1.72 : 2.15));
  const bob = Math.sin(t * 6.5 + i) * 0.03;
  const x = Math.sin(home.ang) * radius;
  const z = Math.cos(home.ang) * radius;
  if (t < die) {
    out.x = x;
    out.y = Math.abs(bob);
    out.z = z;
    out.rx = 0.08 + bob;
    out.ry = Math.atan2(-x, -z) - Math.PI / 2;
    out.rz = 0;
    out.s = 1;
    return;
  }
  const u = (t - die) / 0.9;
  if (u >= 1) {
    out.x = 0;
    out.y = -20;
    out.z = 0;
    out.rx = 0;
    out.ry = 0;
    out.rz = 0;
    out.s = 0;
    return;
  }
  const dirx = Math.sin(home.ang);
  const dirz = Math.cos(home.ang);
  out.x = x + dirx * u * u * 0.62;
  out.z = z + dirz * u * u * 0.62;
  out.y = Math.sin(u * Math.PI) * 1.45;
  out.rx = u * 2.4;
  out.ry = Math.atan2(-x, -z) - Math.PI / 2 + u * 2;
  out.rz = (i % 2 ? 1 : -1) * u * 1.2;
  out.s = 1;
}

export function arenaHero(i: number, t: number, out: ArenaPose) {
  const ang = (i / ARENA_HEROES) * Math.PI * 2;
  const alive = arenaAlive(t) / ARENA_FOES;
  const radius = 1.05 * (0.78 + alive * 0.42);
  const sway = Math.sin(t * 2.4 + i * 1.1) * 0.07 * alive;
  out.x = Math.sin(ang) * radius + Math.cos(ang) * sway;
  out.z = Math.cos(ang) * radius - Math.sin(ang) * sway;
  out.ry = ang;
  out.rz = Math.sin(t * 8.2 + i) * 0.05;
  const chop = Math.max(0, Math.sin(t * 6.4 + i * 1.4));
  out.rx = chop * 0.42;
  out.y = Math.abs(Math.sin(t * 6.4 + i * 1.4)) * 0.03;
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
  let dist = 15.4;
  let y = 4.15;
  let lookY = 1.2;
  let fov = 50;
  if (t < 7) {
    const k = t / 7;
    const e = k * k * (3 - 2 * k);
    dist = 18.6 - e * 2.0;
    y = 8.4 - e * 4.35;
    lookY = 1.05;
    fov = 52 - e * 2;
  } else if (t > 51) {
    const k = (t - 51) / 9;
    const e = k * k * (3 - 2 * k);
    dist = 16.6 + e * 2.2;
    y = 4.05 + e * 3.1;
    lookY = 1.35;
  } else {
    dist = 16.6 + Math.sin((t - 7) * 0.31) * 0.4;
    y = 4.05 + Math.sin((t - 7) * 0.23) * 0.35;
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
