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
  return { ang, ring: inner ? 3.45 : 5.05 };
}

export function arenaFoe(i: number, t: number, out: ArenaPose) {
  const home = foeHome(i);
  const die = arenaDieAt(i);
  const rush = Math.max(0, Math.min(1, (t - 0.8) / 7.2));
  const ease = rush * rush * (3 - 2 * rush);
  const radius = home.ring - ease * (home.ring - (home.ring < 4 ? 2.45 : 3.85));
  const bob = Math.sin(t * 6.5 + i) * 0.03;
  const x = Math.sin(home.ang) * radius;
  const z = Math.cos(home.ang) * radius;
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
  let dist = 38.6;
  let y = 8.2;
  let lookY = 1.2;
  let fov = 50;
  if (t < 7) {
    const k = t / 7;
    const e = k * k * (3 - 2 * k);
    dist = 46 - e * 7.4;
    y = 18.5 - e * 10.3;
    lookY = 1.15;
    fov = 52 - e * 2;
  } else if (t > 51) {
    const k = (t - 51) / 9;
    const e = k * k * (3 - 2 * k);
    dist = 38.6 + e * 6;
    y = 8.2 + e * 5;
    lookY = 1.45;
  } else {
    dist = 38.6 + Math.sin((t - 7) * 0.31) * 0.7;
    y = 8.2 + Math.sin((t - 7) * 0.23) * 0.4;
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
