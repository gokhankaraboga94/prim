export const WARS_ID = "wars" as const;
export type WarsId = typeof WARS_ID;
export const WARS_MODE = { id: WARS_ID, label: "WARS" } as const;
export const WARS_SECONDS = 26;

export const WARS_FRIENDS = 50;
export const WARS_FOES = 200;

export function isWars(id: string | null | undefined): id is WarsId {
  return id === WARS_ID;
}

const GOLD = Math.PI * (3 - Math.sqrt(5));

function ramp(t: number, a: number, b: number) {
  const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

function mix(i: number, salt: number) {
  let n = Math.imul(i + 1, 374761393) + Math.imul(salt, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function warsCam(t: number) {
  const spin = t * 0.04;
  return { x: Math.sin(spin) * 34.5, y: 22.65, z: Math.cos(spin) * 34.5, lx: 0, ly: 0.6, lz: 0, fov: 58 };
}

const DUEL_GAP = 0.9;
const DUEL_PARTNER = new Array<number>(WARS_FRIENDS).fill(-1);
const ROMAN_DUEL = new Array<number>(WARS_FOES).fill(-1);
{
  const used = new Set<number>();
  for (let i = 0; i < WARS_FRIENDS; i++) {
    if (mix(i, 20) >= 0.42) continue;
    let foe = Math.floor(mix(i, 21) * WARS_FOES);
    for (let n = 0; n < 16 && used.has(foe); n++) foe = (foe + 11) % WARS_FOES;
    if (used.has(foe)) continue;
    used.add(foe);
    DUEL_PARTNER[i] = foe;
    ROMAN_DUEL[foe] = i;
  }
}

function knightDie(i: number) {
  return 7.1 + mix(i, 1) * 10.2;
}

function romanDie(i: number) {
  return mix(i, 5) < 0.2 ? 7.4 + mix(i, 6) * 10.6 : 1e9;
}

function knightHome(i: number, t: number) {
  const die = knightDie(i);
  const fall = t < die ? 0 : Math.min(1, (t - die) / 0.55);
  const meet = ramp(Math.min(t, die), 2.0, 7.2);
  const a = i * GOLD + mix(i, 2) * 1.7;
  const r = 2.2 + mix(i, 3) * 4.5 + meet * (0.35 + mix(i, 4) * 1.15);
  return { x: Math.sin(a) * r, z: Math.cos(a) * r, fall, die };
}

function romanHome(i: number, t: number) {
  const die = romanDie(i);
  const fall = t < die ? 0 : Math.min(1, (t - die) / 0.52);
  const meet = ramp(Math.min(t, die), 2.0, 8.0);
  const a = i * GOLD * 1.13 + mix(i, 7) * 2.1;
  const start = 8.05 + mix(i, 8) * 4.45;
  const r = Math.max(6.6, start - meet * (0.55 + mix(i, 9) * 1.45));
  return { x: Math.sin(a) * r, z: Math.cos(a) * r, fall, die };
}

function strike(t: number, phase: number) {
  const u = ((t + phase) % 1.45) / 1.45;
  if (u < 0.58) return 0;
  if (u < 0.74) return Math.sin(((u - 0.58) / 0.16) * Math.PI);
  return Math.max(0, 1 - (u - 0.74) / 0.26) * 0.18;
}

function footwork(x: number, z: number, fx: number, fz: number, t: number, phase: number, lean: number) {
  const len = Math.hypot(fx, fz) || 1;
  const nx = fx / len;
  const nz = fz / len;
  const step = Math.sin(t * 1.7 + phase) * 0.16;
  const plant = Math.sin(t * 0.95 + phase * 1.3) * 0.05;
  return {
    x: x + nx * (lean * 0.24 + plant) - nz * step,
    z: z + nz * (lean * 0.24 + plant) + nx * step,
  };
}

function lockPair(kx: number, kz: number, rx: number, rz: number, u: number, lunge: number, side: number) {
  const dx = rx - kx;
  const dz = rz - kz;
  const len = Math.hypot(dx, dz) || 1;
  const nx = dx / len;
  const nz = dz / len;
  const step = Math.max(0, len - DUEL_GAP) * u;
  const shove = lunge * 0.26;
  return {
    x: kx + nx * (step + shove) - nz * side,
    z: kz + nz * (step + shove) + nx * side,
    fx: rx - nx * (step + shove) - nz * side,
    fz: rz - nz * (step + shove) + nx * side,
    nx,
    nz,
  };
}

export function warsKnight(i: number, t: number) {
  const foe = DUEL_PARTNER[i];
  const home = knightHome(i, t);
  const phase = mix(i, 22) * 6.2;
  if (foe < 0) {
    const lean = home.fall > 0 ? 0 : strike(t, phase);
    const step = footwork(home.x, home.z, home.x, home.z, t, phase, lean);
    const twist = lean * (mix(i, 23) > 0.5 ? 0.46 : -0.46);
    return { x: step.x, z: step.z, yaw: Math.atan2(home.x, home.z) + twist, fall: home.fall, lean };
  }
  const clock = Math.min(t, home.die, romanDie(foe));
  const self = knightHome(i, clock);
  const other = romanHome(foe, clock);
  const u = ramp(clock, 4.8, 6.7);
  const lean = home.fall > 0 ? 0 : strike(t, phase) * Math.min(1, u + 0.25);
  const arc = (1 - u) * Math.sin(phase) * 0.9;
  const side = home.fall > 0 ? 0 : Math.sin(t * 1.15 + phase) * 0.2 * u + arc;
  const pair = lockPair(self.x, self.z, other.x, other.z, u, lean, side);
  return { x: pair.x, z: pair.z, yaw: Math.atan2(pair.nx, pair.nz) + lean * 0.5, fall: home.fall, lean };
}

export function warsRoman(i: number, t: number) {
  const knight = ROMAN_DUEL[i];
  const home = romanHome(i, t);
  const phase = mix(i, 24) * 6.2;
  if (knight < 0) {
    const lean = home.fall > 0 ? 0 : strike(t, phase);
    const step = footwork(home.x, home.z, -home.x, -home.z, t, phase, lean);
    const twist = lean * (mix(i, 25) > 0.5 ? 0.4 : -0.4);
    return { x: step.x, z: step.z, yaw: Math.atan2(-home.x, -home.z) - Math.PI / 2 + twist, fall: home.fall, lean };
  }
  const clock = Math.min(t, home.die, knightDie(knight));
  const self = romanHome(i, clock);
  const other = knightHome(knight, clock);
  const u = ramp(clock, 4.8, 6.7);
  const foePhase = mix(knight, 22) * 6.2;
  const lean = home.fall > 0 ? 0 : strike(t, foePhase + 0.72);
  const arc = (1 - u) * Math.sin(foePhase) * 0.9;
  const side = home.fall > 0 ? 0 : Math.sin(t * 1.15 + foePhase) * 0.2 * u + arc;
  const pair = lockPair(other.x, other.z, self.x, self.z, u, lean, side);
  return { x: pair.fx, z: pair.fz, yaw: Math.atan2(-pair.nx, -pair.nz) - Math.PI / 2 - lean * 0.42, fall: home.fall, lean };
}
