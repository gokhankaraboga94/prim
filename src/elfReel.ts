export const ELF_ID = "elf" as const;
export type ElfId = typeof ELF_ID;
export const ELF_MODE = { id: ELF_ID, label: "elf" } as const;
export const ELF_SECONDS = 24;

export const ELF_N = 10;
export const ORC_N = 52;

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

export function isElf(id: string | null | undefined): id is ElfId {
  return id === ELF_ID;
}

const ELF_PIECES = 4;
let elfLoaded = 0;
let elfPlayAt = 0;
const elfWait: Array<() => void> = [];

export function elfResetClock() {
  elfLoaded = 0;
  elfPlayAt = 0;
  elfWait.length = 0;
}

export function elfPieceReady() {
  elfLoaded += 1;
  if (elfLoaded < ELF_PIECES) return;
  for (const fn of elfWait.splice(0)) fn();
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

/** Elves hold a shallow crescent on the meydan floor. */
export function elfAt(i: number, _t: number): ElfPose {
  const u = (i - (ELF_N - 1) / 2) / Math.max(1, (ELF_N - 1) / 2);
  const span = (floor.x1 - floor.x0) * 0.36;
  const x = u * span;
  const z = floor.zElf + u * u * Math.min(1.4, (floor.z1 - floor.z0) * 0.03);
  return {
    x,
    y: elfFloor(x, z),
    z,
    yaw: 0,
    pitch: 0,
    roll: 0,
    hide: false,
  };
}

function orcSeat(i: number) {
  const col = i % 13;
  const row = Math.floor(i / 13);
  const pitch = ((floor.x1 - floor.x0) * 0.78) / 12;
  const x = (col - 6) * pitch + (row % 2) * pitch * 0.22;
  const run = Math.max(10, floor.zSpawn - floor.zElf);
  return {
    kind: (i + row) % 2,
    x,
    z0: floor.zSpawn + row * Math.min(3.2, run * 0.08),
    start: 2.4 + (col % 5) * 0.22 + row * 0.55 + hash(i, 1) * 0.4,
    speed: 2.05 + hash(i, 2) * 0.35 + run * 0.01,
    killZ: floor.zElf + 6.2 + hash(i, 3) * run * 0.26,
  };
}

export function orcKind(i: number) {
  return orcSeat(i).kind;
}

/** Orcs slide in; they drop mid-charge and just as they reach the elves. */
export function orcAt(i: number, t: number): ElfPose {
  const seat = orcSeat(i);
  const runT = t - seat.start;
  if (runT < 0) {
    return { x: seat.x, y: elfFloor(seat.x, seat.z0), z: seat.z0, yaw: Math.PI, pitch: -0.12, roll: 0, hide: false };
  }
  const killDist = seat.z0 - seat.killZ;
  const dist = runT * seat.speed;
  const dead = dist >= killDist;
  const fall = dead ? clamp01((dist - killDist) / Math.max(0.8, seat.speed * 0.55)) : 0;
  const z = dead ? seat.killZ : seat.z0 - dist;
  const x = seat.x + (dead ? Math.sign(seat.x || 1) * fall * 0.45 : 0);
  return {
    x,
    y: elfFloor(x, z),
    z,
    yaw: Math.PI,
    pitch: dead ? -1.28 * fall : -0.14,
    roll: dead ? (i % 2 ? 0.42 : -0.42) * fall : 0,
    hide: false,
  };
}

const ARROWS: ElfArrow[] = Array.from({ length: 28 }, () => ({ x: 0, y: 0, z: 0, dx: 0, dy: 1, dz: 0 }));

function arrowFlight(elf: number, t: number, out: ElfArrow) {
  const cycle = 0.78;
  const phase = (t * 1.12 + elf * 0.17 + (elf % 3) * 0.08) % cycle;
  if (phase < 0.2 || t < 3.1) return false;
  const u = (phase - 0.2) / (cycle - 0.2);
  const from = elfAt(elf, t);
  const aim = from.z + 8 + ((elf * 7) % 11) * 1.05 + Math.sin(t * 0.7 + elf) * 1.2;
  const x0 = from.x + 0.18;
  const y0 = from.y + 1.42;
  const z0 = from.z + 0.55;
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

/**
 * LOTR-style cuts: establish the field, ride with the charge, close on an elf,
 * follow the volley, then pull back over the fallen line.
 */
export function elfCam(t: number): ElfCam {
  const g = elfLift();
  const ez = floor.zElf;
  const mid = (floor.zElf + floor.zSpawn) * 0.5;
  const wide = look(20, g + 5.1, mid + 3, 0, g + 1.18, mid - 2, 40);
  const hold = look(15.2, g + 3.3, mid + 1, 0.3, g + 1.25, ez + 7, 36);
  const charge = look(11.5, g + 2.05, floor.zSpawn - 10, 1.2, g + 1.15, floor.zSpawn - 16, 38);
  const elfClose = look(2.15, g + 1.58, ez + 3.8, 0.2, g + 1.42, ez + 0.3, 32);
  const volley = look(1.4, g + 3.4, ez + 9.6, 0.6, g + 1.35, mid, 34);
  const rain = look(-2, g + 7.4, ez - 8, 0, g + 1.1, mid, 44);
  const last = look(-7.2, g + 1.72, ez + 14.8, 0.4, g + 1.05, ez + 17.4, 36);
  const line = look(0.3, g + 1.62, ez + 5.3, 0, g + 1.38, ez + 0.2, 34);
  const end = look(24, g + 17.5, ez, 0, g + 0.7, mid, 46);
  if (t < 2.7) return mixCam(wide, hold, t / 2.7);
  if (t < 6.1) return mixCam(hold, charge, (t - 2.7) / 3.4);
  if (t < 8.6) return mixCam(charge, elfClose, (t - 6.1) / 2.5);
  if (t < 11.2) return mixCam(elfClose, volley, (t - 8.6) / 2.6);
  if (t < 14.5) return mixCam(volley, rain, (t - 11.2) / 3.3);
  if (t < 18) return mixCam(rain, last, (t - 14.5) / 3.5);
  if (t < 20.6) return mixCam(last, line, (t - 18) / 2.6);
  return mixCam(line, end, Math.min(1, (t - 20.6) / 3.2));
}
