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

function swing(u: number) {
  const p = u - Math.floor(u);
  if (p < 0.36) {
    const k = p / 0.36;
    return { a: -(k * k), lunge: 0 };
  }
  if (p < 0.5) {
    const k = (p - 0.36) / 0.14;
    const e = k * k * (3 - 2 * k);
    return { a: -1 + e * 2, lunge: e };
  }
  if (p < 0.74) {
    const k = (p - 0.5) / 0.24;
    const e = k * k * (3 - 2 * k);
    return { a: 1 - e, lunge: 1 - e };
  }
  return { a: 0, lunge: 0 };
}

function heroBlow(i: number, t: number) {
  const period = 0.86 + (i % 3) * 0.07;
  return swing(t / period + i * 0.41);
}

function foeBlow(i: number, t: number) {
  const period = 1.08 + (i % 4) * 0.06;
  return swing(t / period + i * 0.17);
}

function heroOf(ang: number) {
  const turns = ang / (Math.PI * 2);
  const u = turns - Math.floor(turns);
  return Math.round(u * ARENA_HEROES) % ARENA_HEROES;
}

export function arenaFoe(i: number, t: number, out: ArenaPose) {
  const home = foeHome(i);
  const die = arenaDieAt(i);
  const rush = Math.max(0, Math.min(1, (t - 0.8) / 7.2));
  const ease = rush * rush * (3 - 2 * rush);
  const fighting = t < die;
  const mine = fighting ? foeBlow(i, t) : { a: 0, lunge: 0 };
  const fromHero = fighting ? heroBlow(heroOf(home.ang), t) : { a: 0, lunge: 0 };
  const inner = home.ring < 4;
  const connect = Math.max(0, fromHero.lunge) * (inner ? 1 : 0.32);
  const stung = fighting && die - t < 0.16 ? (0.16 - (die - t)) / 0.16 : 0;
  const knock = Math.max(connect * (inner ? 0.22 : 0.08), stung * 0.18);
  const stepIn = mine.lunge * (inner ? 0.18 : 0.1) * (1 - connect);
  const radius = home.ring - ease * (home.ring - (inner ? 2.45 : 3.85)) + Math.sin(t * 1.6 + i) * 0.05 - stepIn + knock;
  const side = Math.cos(t * 1.15 + i * 0.8) * 0.06;
  const x = Math.sin(home.ang) * radius + Math.cos(home.ang) * side;
  const z = Math.cos(home.ang) * radius - Math.sin(home.ang) * side;
  const face = Math.atan2(-x, -z) - Math.PI / 2;
  if (t < die) {
    out.x = x;
    out.y = 0.02 + Math.abs(Math.sin(t * 2.6 + i)) * 0.02 + mine.lunge * 0.03;
    out.z = z;
    out.rx = 0.05 + mine.a * 0.48 * (1 - connect) - connect * 0.62 - stung * 0.4;
    out.ry = face - connect * 0.18;
    out.rz = (i % 2 ? 1 : -1) * (Math.max(0, -mine.a) * 0.06 + connect * 0.1);
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
  const kneel = i === 1 && t > 15 && t < 27;
  const stumble = i === 3 && t > 33 && t < 40;
  const hit = kneel || stumble ? { a: 0, lunge: 0 } : heroBlow(i, t);
  const wind = Math.max(0, -hit.a);
  const step = hit.lunge * 0.28 - wind * 0.06;
  const sway = Math.sin(t * 2.1 + i * 1.1) * 0.04 * alive;
  out.x = Math.sin(ang) * (radius + step) + Math.cos(ang) * sway;
  out.z = Math.cos(ang) * (radius + step) - Math.sin(ang) * sway;
  out.ry = ang + hit.a * 0.24;
  out.rz = wind * 0.1;
  out.rx = hit.a * 0.82;
  out.y = hit.lunge * 0.03 + Math.abs(Math.sin(t * 2.2 + i)) * 0.012;
  out.s = 1;
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
  let dist = 21.6;
  let y = 10.9;
  let lookY = 1.15;
  let fov = 46;
  if (t < 4.5) {
    const k = t / 4.5;
    const e = k * k * (3 - 2 * k);
    dist = 34 - e * 12.4;
    y = 18.6 - e * 7.7;
    lookY = 1.1;
    fov = 51 - e * 5;
  } else if (t > 52) {
    const k = (t - 52) / 8;
    const e = k * k * (3 - 2 * k);
    dist = 21.6 + e * 2.4;
    y = 10.9 + e * 1.8;
    lookY = 1.35;
  } else {
    dist = 21.6 + Math.sin((t - 4.5) * 0.28) * 0.25;
    y = 10.9 + Math.sin((t - 4.5) * 0.21) * 0.16;
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
