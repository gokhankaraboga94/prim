export const OK_ID = "ok" as const;
export type OkId = typeof OK_ID;
export const OK_SECONDS = 18;
export const OK_MODE = { id: OK_ID, label: "ok" } as const;

export function isOk(id: string | null | undefined): id is OkId {
  return id === OK_ID;
}

export const OK_FRIENDS = 230;
export const OK_FOES = 216;
export const OK_DECK = { cx: 0, cz: -14, w: 26, d: 70 };

const START = 10;
const COLS = 10;
const PX = 1.68;
const PZ = 1.52;
const FRONT_Z = -6.4;
const SPAWN_Z = 16.2;

const JOINS = [
  { at: 4.7, add: 50, label: "+50 takipçi", until: 6.2 },
  { at: 8.7, add: 100, label: "+100 takipçi", until: 10.2 },
  { at: 12.5, add: 20, label: "+20 takipçi", until: 13.9 },
  { at: 15.4, add: 50, label: "+50 takipçi", until: 16.9 },
] as const;

const WAVES = [
  { at: 1.05, n: 16, speed: 6.6, cols: 8 },
  { at: 5.2, n: 36, speed: 7.0, cols: 9 },
  { at: 9.2, n: 64, speed: 7.3, cols: 10 },
  { at: 13.0, n: 100, speed: 7.7, cols: 12 },
] as const;

const FALLS: [number, number][] = [
  [1, 6.55],
  [4, 6.85],
  [8, 7.15],
  [15, 7.5],
  [27, 7.85],
  [6, 10.35],
  [13, 10.6],
  [22, 10.85],
  [36, 11.1],
  [48, 11.35],
  [62, 11.6],
  [78, 11.9],
  [96, 12.15],
  [3, 14.15],
  [19, 14.4],
  [33, 14.65],
  [51, 14.9],
  [69, 15.2],
  [88, 15.5],
  [112, 15.85],
  [134, 16.15],
  [156, 16.45],
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

function shotPhase(i: number, t: number) {
  return (t * 1.05 + (i % 2) * 0.5 + (i % 4) * 0.03) % 1;
}

export function okBorn(i: number) {
  if (i < 0 || i >= OK_FRIENDS) return 999;
  if (i < START) return 0;
  let n = START;
  for (const join of JOINS) {
    if (i < n + join.add) return join.at + (i - n) * 0.008;
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
    if (ph < 0.42) pitch = -0.5 * (ph / 0.42);
    else if (ph < 0.58) pitch = -0.5 + 1.05 * ((ph - 0.42) / 0.16);
    else pitch = 0.55 * (1 - (ph - 0.58) / 0.42);
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
  const delay = (col % wave.cols) * 0.05 + row * 0.14;
  const runT = t - wave.at - delay;
  if (runT < 0) return null;
  const x = (col - (wave.cols - 1) / 2) * 1.55 + (row % 2) * 0.28;
  const killZ = 1.15 + (row % 5) * 1.05 + (col % 3) * 0.35;
  const killDist = SPAWN_Z - killZ;
  const dist = runT * wave.speed;
  const dead = dist >= killDist;
  const fall = dead ? Math.min(1, (dist - killDist) / (wave.speed * 0.62)) : 0;
  const z = dead ? killZ : SPAWN_Z - dist;
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

function fillArrow(i: number, t: number, out: OkArrow) {
  if (fallAmount(i, t) > 0.02 || t < okBorn(i)) return false;
  const ph = shotPhase(i, t);
  if (ph < 0.42 || ph > 0.98) return false;
  const u = (ph - 0.42) / 0.56;
  const spot = seat(i);
  const x0 = spot.x;
  const y0 = 1.35 + (1 - Math.min(1, (t - okBorn(i)) / 0.34)) * -0.4;
  const z0 = spot.z + 0.35;
  const x1 = spot.x * 0.28 + Math.sin(i * 1.7) * 1.1;
  const y1 = 1.2;
  const z1 = 2.3 + (i % 5) * 0.85;
  const arc = Math.sin(u * Math.PI) * 1.45;
  const u2 = Math.min(1, u + 0.05);
  const x = x0 + (x1 - x0) * u;
  const y = y0 + (y1 - y0) * u + arc;
  const z = z0 + (z1 - z0) * u;
  const arc2 = Math.sin(u2 * Math.PI) * 1.45;
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
  const joined = okJoined(t);
  for (let i = 0; i < joined && n < ARROWS.length; i++) {
    if (fillArrow(i, t, ARROWS[n])) n++;
  }
  return { list: ARROWS, n };
}

const GROWTH = [
  { t: 0, u: 0 },
  { t: 4.7, u: 0 },
  { t: 6.3, u: 0.34 },
  { t: 8.7, u: 0.34 },
  { t: 10.5, u: 0.66 },
  { t: 12.5, u: 0.66 },
  { t: 14.0, u: 0.8 },
  { t: 15.4, u: 0.8 },
  { t: 17.2, u: 1 },
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
  return {
    x: 0,
    y: 15 + u * 9,
    z: Math.min(-38 - u * 26, back - 18),
    lx: 0,
    ly: 1.2,
    lz: 8 - u * 6,
    fov: 62,
  };
}

export function okAlive(t: number) {
  const n = okJoined(t);
  let live = 0;
  for (let i = 0; i < n; i++) if (fallAmount(i, t) < 0.999) live++;
  return live;
}
