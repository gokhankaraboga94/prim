export const ELF_ID = "elf" as const;
export type ElfId = typeof ELF_ID;
export const ELF_MODE = { id: ELF_ID, label: "elf" } as const;
export const ELF_SECONDS = 24;
/** Alternating film beats: elves, orcs, elves, orcs… */
export const ELF_FILM_SEG = 4;

export const ELF_N = 8;
export const ELF_PER_RANK = 4;
export const ORC_N = 24;
export const ORC_COLS = 8;
export const ELF_ARROW_MAX = 6;

export const ELF_URLS = ["/models/new/elf.glb", "/models/new/orc1.glb", "/models/new/orc2.glb", "/models/new/meydan.glb"] as const;
export const ELF_LITE_URLS = ["/models/new/elf-lite.glb", "/models/new/orc1-lite.glb", "/models/new/orc2-lite.glb", "/models/new/meydan-lite.glb"] as const;

export function elfPhone() {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 900;
  } catch {
    return false;
  }
}

/** Always the lite pack — full 58 MB files blow the WebGL context. */
export function elfAssets() {
  return { elf: ELF_LITE_URLS[0], orc1: ELF_LITE_URLS[1], orc2: ELF_LITE_URLS[2], field: ELF_LITE_URLS[3], list: ELF_LITE_URLS };
}

type Floor = {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  cols: number;
  rows: number;
  ys: Float32Array;
  lift: number;
  zElf: number;
  zSpawn: number;
};

const floor: Floor = {
  x0: -18,
  x1: 18,
  z0: -12,
  z1: 40,
  cols: 1,
  rows: 1,
  ys: new Float32Array([0]),
  lift: 0,
  zElf: -8.4,
  zSpawn: 36,
};

export function setElfFloor(next: Floor) {
  floor.x0 = next.x0;
  floor.x1 = next.x1;
  floor.z0 = next.z0;
  floor.z1 = next.z1;
  floor.cols = next.cols;
  floor.rows = next.rows;
  floor.ys = next.ys;
  floor.lift = next.lift;
  floor.zElf = next.zElf;
  floor.zSpawn = next.zSpawn;
}

export function elfFloor(x: number, z: number) {
  const cols = floor.cols;
  const rows = floor.rows;
  if (cols < 2 || rows < 2) return floor.lift;
  const u = clamp01((x - floor.x0) / Math.max(1e-4, floor.x1 - floor.x0));
  const v = clamp01((z - floor.z0) / Math.max(1e-4, floor.z1 - floor.z0));
  const c = u * (cols - 1);
  const r = v * (rows - 1);
  const c0 = Math.floor(c);
  const r0 = Math.floor(r);
  const c1 = Math.min(cols - 1, c0 + 1);
  const r1 = Math.min(rows - 1, r0 + 1);
  const tx = c - c0;
  const ty = r - r0;
  const a = floor.ys[r0 * cols + c0];
  const b = floor.ys[r0 * cols + c1];
  const d = floor.ys[r1 * cols + c0];
  const e = floor.ys[r1 * cols + c1];
  return a + (b - a) * tx + (d - a) * ty + (a - b - d + e) * tx * ty;
}

export function elfLift() {
  return floor.lift;
}

export function elfFieldReady() {
  return floor.cols >= 2 && floor.rows >= 2;
}

export function isElf(id: string | null | undefined): id is ElfId {
  return id === ELF_ID;
}

export function elfWarm() {
  void import("./arenaPreload").then(({ preloadGlbs }) => preloadGlbs(elfAssets().list));
}

const ELF_PIECES = 3;
let elfLoaded = 0;
let elfFieldOk = false;
let elfLineOk = false;
let elfPlayAt = 0;
const elfWait: Array<() => void> = [];

export function elfResetClock() {
  elfLoaded = 0;
  elfFieldOk = false;
  elfLineOk = false;
  elfPlayAt = 0;
  elfWait.length = 0;
}

export function elfPieceReady(kind: "field" | "elf" | "orc", ok: boolean) {
  elfLoaded += 1;
  if (ok && kind === "field") elfFieldOk = true;
  if (ok && kind === "elf") elfLineOk = true;
  if (elfLoaded < ELF_PIECES) return;
  for (const fn of elfWait.splice(0)) fn();
}

export function elfLoadDone() {
  return elfLoaded;
}

export function elfLoadTotal() {
  return ELF_PIECES;
}

export function elfHasScene() {
  return elfFieldOk && elfLineOk;
}

export function elfIsReady() {
  return elfLoaded >= ELF_PIECES;
}

export function elfWhenReady() {
  if (elfIsReady()) return Promise.resolve();
  return new Promise<void>((ok) => elfWait.push(ok));
}

export function elfHold() {
  elfPlayAt = 0;
}

export function elfStartPlay() {
  elfPlayAt = performance.now() / 1000;
}

/** Frozen at the opening until the recorder writes its first frame. */
export function elfT() {
  if (!elfPlayAt) return 0;
  return Math.max(0, performance.now() / 1000 - elfPlayAt);
}

export type ElfPose = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  hide: boolean;
};

export type ElfCam = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

export type ElfArrow = {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
};

function clamp01(u: number) {
  return Math.max(0, Math.min(1, u));
}

function ease(u: number) {
  const x = clamp01(u);
  return x * x * (3 - 2 * x);
}

function hash(i: number, salt: number) {
  let n = Math.imul(i + 1, 374761393) + Math.imul(salt, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function mixCam(a: ElfCam, b: ElfCam, u: number): ElfCam {
  const k = ease(u);
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    z: a.z + (b.z - a.z) * k,
    lx: a.lx + (b.lx - a.lx) * k,
    ly: a.ly + (b.ly - a.ly) * k,
    lz: a.lz + (b.lz - a.lz) * k,
    fov: a.fov + (b.fov - a.fov) * k,
  };
}

function look(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): ElfCam {
  return { x, y, z, lx, ly, lz, fov };
}

export function elfFilmBeat(t: number) {
  return Math.min(5, Math.floor(t / ELF_FILM_SEG));
}

export function elfFilmKind(t: number): "elf" | "orc" {
  return elfFilmBeat(t) % 2 === 0 ? "elf" : "orc";
}

export function elfFilmLocal(t: number) {
  return t - elfFilmBeat(t) * ELF_FILM_SEG;
}

/** Two shallow ranks on the meydan, facing the charge. */
export function elfAt(i: number, _t: number): ElfPose {
  const row = i < ELF_PER_RANK ? 0 : 1;
  const col = i % ELF_PER_RANK;
  const laneW = (floor.x1 - floor.x0) * 0.48;
  const x = (col - (ELF_PER_RANK - 1) / 2) * (laneW / ELF_PER_RANK);
  const z = floor.zElf + row * 0.62;
  return {
    x,
    y: elfFloor(x, z) + 0.14,
    z,
    yaw: Math.PI,
    pitch: 0,
    roll: 0,
    hide: false,
  };
}

function orcSeat(i: number) {
  const cols = ORC_COLS;
  const rows = Math.ceil(ORC_N / cols);
  const col = i % cols;
  const row = Math.floor(i / cols);
  const run = Math.max(8, floor.zSpawn - floor.zElf);
  const laneW = (floor.x1 - floor.x0) * 0.84;
  const x = (col / Math.max(1, cols - 1) - 0.5) * laneW + (row % 2) * 0.4;
  const zBack = floor.zElf + run * 0.34;
  const zSpread = run * 0.52;
  const z0 = zBack + (row / Math.max(1, rows - 1)) * zSpread + hash(i, 4) * 0.6;
  return {
    kind: (i + row) % 2,
    x,
    z0,
    start: 2.8 + (col % 5) * 0.2 + row * 0.48 + hash(i, 1) * 0.35,
    speed: 2.15 + hash(i, 2) * 0.32,
    killZ: floor.zElf + 1.4 + row * 0.55 + hash(i, 3) * run * 0.14,
  };
}

export function orcKind(i: number) {
  return orcSeat(i).kind;
}

/** Orcs charge only on orc beats; hidden on elf beats. */
export function orcAt(i: number, t: number): ElfPose {
  const seat = orcSeat(i);
  const parked = {
    x: seat.x,
    y: elfFloor(seat.x, seat.z0) + 0.02,
    z: seat.z0,
    yaw: Math.PI,
    pitch: -0.12,
    roll: 0,
    hide: true,
  };
  if (elfFilmKind(t) !== "orc" || !elfFieldReady()) return parked;
  const lt = elfFilmLocal(t);
  const runT = lt - (0.35 + (i % 6) * 0.14 + Math.floor(i / 13) * 0.32 + hash(i, 1) * 0.22);
  if (runT < 0) {
    return { ...parked, hide: false };
  }
  const killDist = seat.z0 - seat.killZ;
  const dist = runT * seat.speed;
  const dead = dist >= killDist;
  const fall = dead ? clamp01((dist - killDist) / Math.max(0.65, seat.speed * 0.5)) : 0;
  const z = dead ? seat.killZ : seat.z0 - dist;
  const x = seat.x + (dead ? Math.sign(seat.x || 1) * fall * 0.45 : 0);
  return {
    x,
    y: elfFloor(x, z) + 0.02,
    z,
    yaw: Math.PI,
    pitch: dead ? -1.28 * fall : -0.14,
    roll: dead ? (i % 2 ? 0.42 : -0.42) * fall : 0,
    hide: false,
  };
}

const ARROWS: ElfArrow[] = Array.from({ length: ELF_ARROW_MAX }, () => ({ x: 0, y: 0, z: 0, dx: 0, dy: 1, dz: 0 }));

function arrowFlight(elf: number, t: number, out: ElfArrow) {
  if (elfFilmKind(t) !== "elf") return false;
  const lt = elfFilmLocal(t);
  const cycle = 0.78;
  const phase = (lt * 1.12 + elf * 0.17 + (elf % 3) * 0.08) % cycle;
  if (phase < 0.18 || lt < 0.55) return false;
  const u = (phase - 0.18) / (cycle - 0.18);
  const from = elfAt(elf, t);
  const aim = from.z + 7.2 + ((elf * 7) % 11) * 0.85 + Math.sin(t * 0.7 + elf) * 0.9;
  const x0 = from.x + 0.22;
  const y0 = from.y + 1.38;
  const z0 = from.z + 0.42;
  const x1 = from.x * 0.18 + Math.sin(elf * 1.8) * 1.6;
  const z1 = aim;
  const y1 = elfFloor(x1, z1) + 1.05;
  const arc = Math.sin(u * Math.PI) * 2.35;
  const u2 = Math.min(1, u + 0.045);
  const x = x0 + (x1 - x0) * u;
  const y = y0 + (y1 - y0) * u + arc;
  const z = z0 + (z1 - z0) * u;
  out.x = x;
  out.y = y;
  out.z = z;
  out.dx = x0 + (x1 - x0) * u2 - x;
  out.dy = y0 + (y1 - y0) * u2 + Math.sin(u2 * Math.PI) * 2.35 - y;
  out.dz = z0 + (z1 - z0) * u2 - z;
  return true;
}

export function elfArrows(t: number) {
  let n = 0;
  for (let i = 0; i < ELF_N && n < ARROWS.length; i++) {
    if (arrowFlight(i, t, ARROWS[n])) n += 1;
  }
  return { list: ARROWS, n };
}

/** Six 4s beats: elf → orc → elf → orc → elf → orc, each with A→B camera inside the beat. */
export function elfCam(t: number): ElfCam {
  const g = elfLift();
  const ez = floor.zElf;
  const run = Math.max(6, floor.zSpawn - floor.zElf);
  const oz = floor.zElf + run * 0.58;
  const elfMidZ = ez + 0.38;
  const elfA = look(0, g + 1.85, ez - 1.85, 0, g + 1.55, elfMidZ, 30);
  const elfB = look(0.35, g + 1.62, ez - 0.75, 0, g + 1.48, elfMidZ, 26);
  const elfC = look(-0.55, g + 1.68, ez - 1.15, 0.08, g + 1.5, elfMidZ + 0.2, 29);
  const elfD = look(0.22, g + 1.82, ez + 0.35, 0, g + 1.52, elfMidZ, 28);
  const orcA = look(0.15, g + 1.58, oz - 1.8, 0, g + 1.22, oz + 1.2, 33);
  const orcB = look(-0.35, g + 1.42, ez + 1.8, 0.12, g + 1.18, oz, 31);
  const orcC = look(0.65, g + 1.48, oz - 1.2, 0, g + 1.15, oz + 2.4, 34);
  const orcD = look(-0.9, g + 1.55, ez + 3.2, 0.2, g + 1.05, oz + 0.5, 32);
  const pairs: [ElfCam, ElfCam][] = [
    [elfA, elfB],
    [orcA, orcB],
    [elfC, elfD],
    [orcC, orcD],
    [elfB, elfA],
    [orcB, orcA],
  ];
  const beat = elfFilmBeat(t);
  const u = clamp01(elfFilmLocal(t) / ELF_FILM_SEG);
  const [a, b] = pairs[beat];
  return mixCam(a, b, u);
}
