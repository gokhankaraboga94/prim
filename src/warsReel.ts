export const WARS_ID = "wars" as const;
export type WarsId = typeof WARS_ID;
export const WARS_MODE = { id: WARS_ID, label: "WARS" } as const;
export const WARS_SECONDS = 26;

const BASE = 50;
const GOLD = Math.PI * (3 - Math.sqrt(5));
const DUEL_GAP = 0.9;
const Z_OPEN = 1.86;
const FALL_TIME = 2.9;

export function isWars(id: string | null | undefined): id is WarsId {
  return id === WARS_ID;
}

export function warsSpan(friends: number) {
  return Math.sqrt(Math.max(1, Math.floor(friends)) / BASE);
}

export function warsView(friends: number) {
  return Math.pow(warsSpan(friends), 0.62);
}

function ramp(t: number, a: number, b: number) {
  const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

function mix(i: number, salt: number) {
  let n = Math.imul(i + 1, 374761393) + Math.imul(salt, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function warsCam(t: number, friends = BASE) {
  const view = warsView(friends);
  const spin = t * 0.04;
  const elev = 58 * Math.PI / 180;
  const dist = 56 * view;
  const ring = Math.cos(elev) * dist;
  const y = 0.6 + Math.sin(elev) * dist;
  return { x: Math.sin(spin) * ring, y, z: Math.cos(spin) * ring, lx: 0, ly: 0.6, lz: 0, fov: 58 };
}

export type WarsLayout = {
  friends: number;
  foes: number;
  span: number;
  view: number;
  knightR: Float32Array;
  knightMeet: Float32Array;
  knightAng: Float32Array;
  knightPhase: Float32Array;
  knightDie: Float32Array;
  knightFoe: Int32Array;
  romanStart: Float32Array;
  romanClose: Float32Array;
  romanAng: Float32Array;
  romanPhase: Float32Array;
  romanDie: Float32Array;
  romanKnight: Int32Array;
  liveX: Float32Array;
  liveZ: Float32Array;
  liveFall: Float32Array;
};

export function makeWarsLayout(friendsIn: number): WarsLayout {
  const friends = Math.max(0, Math.floor(friendsIn));
  const foes = friends * 2;
  const span = warsSpan(friends);
  const layout: WarsLayout = {
    friends,
    foes,
    span,
    view: warsView(friends),
    knightR: new Float32Array(friends),
    knightMeet: new Float32Array(friends),
    knightAng: new Float32Array(friends),
    knightPhase: new Float32Array(friends),
    knightDie: new Float32Array(friends),
    knightFoe: new Int32Array(friends).fill(-1),
    romanStart: new Float32Array(foes),
    romanClose: new Float32Array(foes),
    romanAng: new Float32Array(foes),
    romanPhase: new Float32Array(foes),
    romanDie: new Float32Array(foes),
    romanKnight: new Int32Array(foes).fill(-1),
    liveX: new Float32Array(friends),
    liveZ: new Float32Array(friends),
    liveFall: new Float32Array(friends),
  };
  for (let i = 0; i < friends; i++) {
    const disk = Math.sqrt((i + 0.5) / Math.max(1, friends));
    layout.knightAng[i] = i * GOLD;
    layout.knightR[i] = (1.25 + disk * 4.55) * span;
    layout.knightMeet[i] = (0.22 + mix(i, 4) * 0.48) * span;
    layout.knightPhase[i] = mix(i, 22) * 6.2;
    layout.knightDie[i] = 11.2 + mix(i, 1) * 11.2;
  }
  const romanIn = 8.15;
  const romanOut = 12.45;
  for (let i = 0; i < foes; i++) {
    const u = (i + 0.5) / Math.max(1, foes);
    const band = Math.sqrt(romanIn * romanIn + u * (romanOut * romanOut - romanIn * romanIn));
    layout.romanAng[i] = i * GOLD + 1.7;
    layout.romanStart[i] = band * span;
    layout.romanClose[i] = (0.26 + mix(i, 9) * 0.38) * span;
    layout.romanPhase[i] = mix(i, 24) * 6.2;
    layout.romanDie[i] = mix(i, 5) < 0.2 ? 11.6 + mix(i, 6) * 10.8 : 1e9;
  }
  const duelBudget = Math.min(36, Math.floor(friends * 0.42));
  const used = new Set<number>();
  let duels = 0;
  for (let i = 0; i < friends && duels < duelBudget; i++) {
    if (mix(i, 20) >= 0.42) continue;
    if (foes < 1) break;
    let foe = Math.floor(mix(i, 21) * foes) % foes;
    for (let n = 0; n < 16 && used.has(foe); n++) foe = (foe + 11) % foes;
    if (used.has(foe)) continue;
    used.add(foe);
    layout.knightFoe[i] = foe;
    layout.romanKnight[foe] = i;
    duels++;
  }
  return layout;
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

function fallen(t: number, die: number) {
  if (t <= die) return 0;
  const u = Math.min(1, (t - die) / FALL_TIME);
  return u * u * (3 - 2 * u);
}

function knightAt(layout: WarsLayout, i: number, t: number) {
  const die = layout.knightDie[i];
  const fall = fallen(t, die);
  const meet = ramp(Math.min(t, die), 2.4, 8.4);
  const r = layout.knightR[i] + meet * layout.knightMeet[i];
  const a = layout.knightAng[i];
  return { x: Math.sin(a) * r, z: Math.cos(a) * r * Z_OPEN, fall, die };
}

function romanAt(layout: WarsLayout, i: number, t: number) {
  const die = layout.romanDie[i];
  const fall = fallen(t, die);
  const meet = ramp(Math.min(t, die), 2.4, 9.0);
  const r = Math.max(7.85 * layout.span, layout.romanStart[i] - meet * layout.romanClose[i]);
  const a = layout.romanAng[i];
  return { x: Math.sin(a) * r, z: Math.cos(a) * r * Z_OPEN, fall, die };
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

export function warsKnight(layout: WarsLayout, i: number, t: number) {
  const foe = layout.knightFoe[i];
  const home = knightAt(layout, i, t);
  const phase = layout.knightPhase[i];
  if (foe < 0) {
    const lean = home.fall > 0 ? 0 : strike(t, phase);
    const step = footwork(home.x, home.z, home.x, home.z, t, phase, lean);
    const twist = lean * (phase > 3.1 ? 0.46 : -0.46);
    return { x: step.x, z: step.z, yaw: Math.atan2(home.x, home.z) + twist, fall: home.fall, lean };
  }
  const clock = Math.min(t, home.die, layout.romanDie[foe]);
  const self = knightAt(layout, i, clock);
  const other = romanAt(layout, foe, clock);
  const u = ramp(clock, 4.8, 6.7);
  const lean = home.fall > 0 ? 0 : strike(t, phase) * Math.min(1, u + 0.25);
  const arc = (1 - u) * Math.sin(phase) * 0.9;
  const side = home.fall > 0 ? 0 : Math.sin(t * 1.15 + phase) * 0.2 * u + arc;
  const pair = lockPair(self.x, self.z, other.x, other.z, u, lean, side);
  return { x: pair.x, z: pair.z, yaw: Math.atan2(pair.nx, pair.nz) + lean * 0.5, fall: home.fall, lean };
}

export function warsRoman(layout: WarsLayout, i: number, t: number) {
  const knight = layout.romanKnight[i];
  const home = romanAt(layout, i, t);
  const phase = layout.romanPhase[i];
  if (knight < 0) {
    const lean = home.fall > 0 ? 0 : strike(t, phase);
    const step = footwork(home.x, home.z, -home.x, -home.z, t, phase, lean);
    const twist = lean * (phase > 3.1 ? 0.4 : -0.4);
    return { x: step.x, z: step.z, yaw: Math.atan2(-home.x, -home.z) - Math.PI / 2 + twist, fall: home.fall, lean };
  }
  const clock = Math.min(t, home.die, layout.knightDie[knight]);
  const self = romanAt(layout, i, clock);
  const other = knightAt(layout, knight, clock);
  const u = ramp(clock, 4.8, 6.7);
  const foePhase = layout.knightPhase[knight];
  const lean = home.fall > 0 ? 0 : strike(t, foePhase + 0.72);
  const arc = (1 - u) * Math.sin(foePhase) * 0.9;
  const side = home.fall > 0 ? 0 : Math.sin(t * 1.15 + foePhase) * 0.2 * u + arc;
  const pair = lockPair(other.x, other.z, self.x, self.z, u, lean, side);
  return { x: pair.fx, z: pair.fz, yaw: Math.atan2(-pair.nx, -pair.nz) - Math.PI / 2 - lean * 0.42, fall: home.fall, lean };
}
