export const OK_ID = "ok" as const;
export type OkId = typeof OK_ID;
export const OK_SECONDS = 96;
export const OK_MODE = { id: OK_ID, label: "ok" } as const;

export function isOk(id: string | null | undefined): id is OkId {
  return id === OK_ID;
}

export const OK_FRIENDS = 230;
export const OK_DECK = { cx: 0, cz: 58, w: 40, d: 240 };

const START = 10;
const COLS = 10;
const PX = 1.68 * 1.25;
const PZ = 1.52;
const FRONT_Z = -6.4;
const SPAWN_Z = 78;
const ROW_GAP = 1.24;

const JOINS = [
  { at: 11.6, add: 50, label: "+50 takipçi", until: 15 },
  { at: 24.8, add: 100, label: "+100 takipçi", until: 28.2 },
  { at: 40.4, add: 20, label: "+20 takipçi", until: 43.8 },
  { at: 52.4, add: 50, label: "+50 takipçi", until: 55.8 },
] as const;

const WAVES = [
  { at: 2.2, n: 50, speed: 4.62, cols: 10 },
  { at: 18, n: 112, speed: 4.9, cols: 14 },
  { at: 33.2, n: 224, speed: 5.18, cols: 16 },
  { at: 76, n: 360, speed: 5.6, cols: 20 },
] as const;

export const OK_FOES = WAVES.reduce((sum, wave) => sum + wave.n, 0);

const FALLS: [number, number][] = [
  [0, 18.7],
  [4, 19.4],
  [8, 20.1],
  [2, 33.7],
  [6, 34.4],
  [11, 35.1],
  [15, 35.8],
  [1, 48.1],
  [5, 48.8],
  [12, 49.5],
  [16, 50.2],
  [3, 88.4],
  [7, 89.1],
  [13, 90],
];

const FALL_AT = new Map(FALLS);

export type OkPose = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  scale: number;
};

export type OkArrow = {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
};

const ARROWS: OkArrow[] = Array.from({ length: 140 }, () => ({ x: 0, y: 0, z: 0, dx: 0, dy: 1, dz: 0 }));

const GIANT_LIFE = 40;
const GIANT_SPEED = 1.7;
const GIANT_Z0 = 94;

export type OkGiant = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  fall: number;
};

export function okGiant(t: number): OkGiant | null {
  const at = WAVES[2].at;
  if (t < at) return null;
  const age = t - at;
  const hp = Math.max(0, 1 - Math.min(age, GIANT_LIFE) / GIANT_LIFE);
  const fall = age <= GIANT_LIFE ? 0 : Math.min(1, (age - GIANT_LIFE) / 1.35);
  const walked = Math.min(age, GIANT_LIFE) * GIANT_SPEED;
  return {
    x: 0,
    y: fall > 0 ? Math.sin(fall * Math.PI) * 0.9 : Math.abs(Math.sin(age * 2.6)) * 0.16,
    z: Math.max(8, GIANT_Z0 - walked),
    yaw: -Math.PI / 2,
    pitch: fall * 1.2,
    hp,
    fall,
  };
}

function shotPhase(i: number, t: number) {
  return (t * 1.05 + (i % 2) * 0.5 + (i % 4) * 0.03) % 1;
}

export function okBorn(i: number) {
  if (i < 0 || i >= OK_FRIENDS) return 999;
  if (i < START) return 0;
  let n = START;
  for (const join of JOINS) {
    if (i < n + join.add) return join.at + (i - n) * 0.016;
    n += join.add;
  }
  return 999;
}

export function okJoined(t: number) {
  let n = 0;
  for (let i = 0; i < OK_FRIENDS; i++) {
    if (okBorn(i) > t) break;
    n++;
  }
  return n;
}

export function okBanner(t: number) {
  for (let i = 0; i < WAVES.length; i++) {
    const at = WAVES[i].at;
    if (t >= at && t < at + 3.6) return `${i + 1}. dalga`;
  }
  for (const join of JOINS) {
    if (t >= join.at && t < join.until) return join.label;
  }
  return null;
}

function fallAmount(i: number, t: number) {
  const at = FALL_AT.get(i);
  if (at == null || t < at || t < okBorn(i)) return 0;
  return Math.min(1, (t - at) / 0.8);
}

function seat(i: number) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return {
    x: (col - (COLS - 1) / 2) * PX,
    z: FRONT_Z - row * PZ,
    row,
  };
}

export function okFriend(i: number, t: number): OkPose | null {
  if (i < 0 || i >= OK_FRIENDS) return null;
  const born = okBorn(i);
  if (t < born) return null;
  const spot = seat(i);
  const age = t - born;
  const fall = fallAmount(i, t);
  const popping = born > 0 && fall < 0.02 && age < 0.34;
  const pop = popping ? age / 0.34 : 1;
  const scale = pop * pop * (3 - 2 * pop);
  if (fall < 0.02) {
    const ph = shotPhase(i, t);
    let pitch = 0;
    if (ph < 0.42) pitch = -0.2 * (ph / 0.42);
    else if (ph < 0.58) pitch = -0.2 + 0.38 * ((ph - 0.42) / 0.16);
    else pitch = 0.18 * (1 - (ph - 0.58) / 0.42);
    return {
      x: spot.x,
      y: (1 - scale) * -0.55,
      z: spot.z,
      yaw: 0,
      pitch,
      roll: Math.sin(t * 2.1 + i) * 0.03,
      scale,
    };
  }
  return {
    x: spot.x,
    y: Math.sin(fall * Math.PI) * 0.16,
    z: spot.z,
    yaw: 0,
    pitch: -1.28 * fall,
    roll: (i % 2 ? 0.42 : -0.42) * fall,
    scale: 1,
  };
}

function waveOf(i: number) {
  let base = 0;
  for (const wave of WAVES) {
    if (i < base + wave.n) return { wave, local: i - base };
    base += wave.n;
  }
  return null;
}

export function okFoe(i: number, t: number): OkPose | null {
  const found = waveOf(i);
  if (!found) return null;
  const { wave, local } = found;
  const col = local % wave.cols;
  const row = Math.floor(local / wave.cols);
  const delay = (col % 4) * 0.06 + row * 0.09;
  const runT = t - wave.at - delay;
  if (runT < 0) return null;
  const pitchX = Math.min(1.38, 30 / Math.max(1, wave.cols - 1));
  const x = (col - (wave.cols - 1) / 2) * pitchX + (row % 2) * 0.22;
  const z0 = SPAWN_Z + row * ROW_GAP;
  const killZ = 1.5 + (row % 4) * 0.9 + (col % 3) * 0.28;
  const killDist = z0 - killZ;
  const dist = runT * wave.speed;
  const dead = dist >= killDist;
  const fall = dead ? Math.min(1, (dist - killDist) / (wave.speed * 0.62)) : 0;
  const z = dead ? killZ : z0 - dist;
  return {
    x,
    y: (dead ? Math.sin(fall * Math.PI) * 0.1 : Math.abs(Math.sin(runT * 12 + local)) * 0.07),
    z,
    yaw: Math.PI / 2,
    pitch: dead ? -1.22 * fall : -0.16,
    roll: dead ? (local % 2 ? 0.38 : -0.38) * fall : Math.sin(runT * 12 + local) * 0.04,
    scale: 1,
  };
}

function approachZ(t: number) {
  let front = 8;
  let seen = false;
  for (const wave of WAVES) {
    if (t < wave.at) continue;
    const rows = Math.ceil(wave.n / wave.cols);
    for (let row = 0; row < rows; row++) {
      const z0 = SPAWN_Z + row * ROW_GAP;
      const runT = t - wave.at - row * 0.09;
      if (runT < 0) continue;
      const z = z0 - runT * wave.speed;
      if (z > 3.2) {
        front = seen ? Math.min(front, z) : z;
        seen = true;
      }
    }
  }
  return Math.max(5, Math.min(34, front));
}

function fillArrow(i: number, t: number, aim: number, out: OkArrow) {
  if (fallAmount(i, t) > 0.02 || t < okBorn(i)) return false;
  const ph = shotPhase(i, t);
  if (ph < 0.42 || ph > 0.98) return false;
  const u = (ph - 0.42) / 0.56;
  const spot = seat(i);
  const x0 = spot.x;
  const y0 = 1.35 + (1 - Math.min(1, (t - okBorn(i)) / 0.34)) * -0.4;
  const z0 = spot.z + 0.35;
  let x1 = spot.x * 0.22 + Math.sin(i * 1.7) * 1.4;
  let y1 = 1.25;
  let z1 = aim + (i % 5) * 0.7;
  const boss = okGiant(t);
  if (boss && boss.hp > 0.02 && i % 3 === 0) {
    x1 = Math.sin(i) * 1.6;
    y1 = 7.2;
    z1 = boss.z - 0.8;
  }
  const arc = Math.sin(u * Math.PI) * 2.1;
  const u2 = Math.min(1, u + 0.05);
  const x = x0 + (x1 - x0) * u;
  const y = y0 + (y1 - y0) * u + arc;
  const z = z0 + (z1 - z0) * u;
  const arc2 = Math.sin(u2 * Math.PI) * 2.1;
  out.x = x;
  out.y = y;
  out.z = z;
  out.dx = x0 + (x1 - x0) * u2 - x;
  out.dy = y0 + (y1 - y0) * u2 + arc2 - y;
  out.dz = z0 + (z1 - z0) * u2 - z;
  return true;
}

export function okArrows(t: number) {
  let n = 0;
  const aim = approachZ(t);
  const joined = okJoined(t);
  for (let i = 0; i < joined && n < ARROWS.length; i++) {
    if (fillArrow(i, t, aim, ARROWS[n])) n++;
  }
  return { list: ARROWS, n };
}

const GROWTH = [
  { t: 0, u: 0 },
  { t: 11.6, u: 0 },
  { t: 15.6, u: 0.3 },
  { t: 24.8, u: 0.3 },
  { t: 29.2, u: 0.58 },
  { t: 40.4, u: 0.58 },
  { t: 44, u: 0.74 },
  { t: 52.4, u: 0.74 },
  { t: 56.8, u: 1 },
];

function growth(t: number) {
  if (t <= GROWTH[0].t) return GROWTH[0].u;
  for (let i = 1; i < GROWTH.length; i++) {
    const b = GROWTH[i];
    if (t <= b.t) {
      const a = GROWTH[i - 1];
      const x = (t - a.t) / Math.max(0.001, b.t - a.t);
      const s = x * x * (3 - 2 * x);
      return a.u + (b.u - a.u) * s;
    }
  }
  return 1;
}

export function okCam(t: number) {
  const u = growth(Math.max(0, t));
  const rows = Math.max(1, Math.ceil(okJoined(t) / COLS));
  const back = FRONT_Z - (rows - 1) * PZ;
  const lx = 0;
  const ly = 1.15;
  const lz = 26 - u * 8;
  const x = 0;
  const y = 17 + u * 12;
  const z = Math.min(-34 - u * 30, back - 16);
  return {
    x: lx + (x - lx) * 0.9,
    y: ly + (y - ly) * 0.9,
    z: lz + (z - lz) * 0.9,
    lx,
    ly,
    lz,
    fov: 60,
  };
}

export function okAlive(t: number) {
  const n = okJoined(t);
  let live = 0;
  for (let i = 0; i < n; i++) if (fallAmount(i, t) < 0.999) live++;
  return live;
}
