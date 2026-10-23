export const ELF_ID = "elf" as const;
export type ElfId = typeof ELF_ID;
export const ELF_MODE = { id: ELF_ID, label: "elf" } as const;
export const ELF_SECONDS = 38;

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

/** Authored face points along -X. PI/2 turns it toward +Z (the orcs). */
const FACE_ORCS = Math.PI / 2;
/** Orc mesh is authored looking down +Z. PI turns that toward the elves. */
const FACE_ELVES = Math.PI;
const CHARGE = 24.2;

function lines() {
  const run = Math.max(10, floor.zSpawn - floor.zElf);
  const elfFront = floor.zElf + 1.05;
  const elfBack = elfFront + 1.15;
  const orcFront = floor.zElf + Math.max(elfBack + 7.2, run * 0.48);
  return { elfFront, elfBack, orcFront, orcDepth: 4.2, midZ: (elfBack + orcFront) * 0.5 };
}

/** Tight block in the middle of the portrait frame. Wide meydan spacing put every elf outside the 9:16 lens. */
export function elfAt(i: number, _t: number): ElfPose {
  const row = i < ELF_PER_RANK ? 0 : 1;
  const col = i % ELF_PER_RANK;
  const { elfFront } = lines();
  const x = (col - (ELF_PER_RANK - 1) / 2) * 0.78 + (row === 1 ? 0.39 : 0);
  const z = elfFront + row * 1.15;
  return {
    x,
    y: elfFloor(x, z) + 0.02,
    z,
    yaw: FACE_ORCS,
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
  const { elfBack, orcFront, orcDepth } = lines();
  const laneW = 3.2;
  const x = (col / Math.max(1, cols - 1) - 0.5) * laneW + (row % 2) * 0.2;
  const z0 = orcFront + (row / Math.max(1, rows - 1)) * orcDepth + hash(i, 4) * 0.28;
  return {
    kind: (i + row) % 2,
    x,
    z0,
    delay: row * 0.35 + hash(i, 1) * 2.6,
    speed: 1.65 + hash(i, 2) * 1.55,
    killZ: elfBack + 1.15 + hash(i, 3) * 4.4,
    drift: (hash(i, 8) - 0.5) * 5.6,
  };
}

export function orcKind(i: number) {
  return orcSeat(i).kind;
}

/** Orcs stand opposite the elves the whole film, then charge in the last shot. */
export function orcAt(i: number, t: number): ElfPose {
  const seat = orcSeat(i);
  const creep = t < 3 ? clamp01(t / 2.2) * 0.4 : 0.4;
  const standZ = seat.z0 - creep;
  const pose = {
    x: seat.x,
    y: elfFloor(seat.x, standZ) + 0.02,
    z: standZ,
    yaw: FACE_ELVES,
    pitch: -0.1,
    roll: 0,
    hide: !elfFieldReady(),
  };
  if (!elfFieldReady()) return pose;
  const runT = t - CHARGE - seat.delay;
  if (runT < 0) return pose;
  const killDist = Math.max(1.2, standZ - seat.killZ);
  const dist = runT * seat.speed;
  const dead = dist >= killDist;
  const fall = dead ? clamp01((dist - killDist) / Math.max(0.7, seat.speed * 0.55)) : 0;
  const along = clamp01(dist / killDist);
  const z = dead ? seat.killZ : standZ - dist;
  const x = seat.x + seat.drift * along;
  return {
    x,
    y: elfFloor(x, z) + 0.02,
    z,
    yaw: FACE_ELVES + (hash(i, 9) - 0.5) * 0.5 * along,
    pitch: dead ? -1.35 * fall : -0.18,
    roll: dead ? (hash(i, 5) - 0.5) * 1.5 * fall : (hash(i, 7) - 0.5) * 0.12,
    hide: false,
  };
}

const ARROWS: ElfArrow[] = Array.from({ length: ELF_ARROW_MAX }, () => ({ x: 0, y: 0, z: 0, dx: 0, dy: 1, dz: 0 }));

function arrowsLive(t: number) {
  return (t >= 0.2 && t < 2.9) || t >= CHARGE;
}

function arrowFlight(elf: number, t: number, out: ElfArrow) {
  if (!arrowsLive(t)) return false;
  const cycle = 0.72;
  const phase = (t * 1.15 + elf * 0.19 + (elf % 3) * 0.08) % cycle;
  if (phase < 0.16) return false;
  const u = (phase - 0.16) / (cycle - 0.16);
  const from = elfAt(elf, t);
  const aim = from.z + 6.4 + ((elf * 7) % 9) * 0.7 + Math.sin(t * 0.7 + elf) * 0.6;
  const x0 = from.x + (elf % 2 ? 0.16 : -0.16);
  const y0 = from.y + 1.34;
  const z0 = from.z + 0.48;
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

function cutFilm(t: number, shots: { until: number; a: ElfCam; b: ElfCam }[]) {
  let prev = 0;
  for (const shot of shots) {
    if (t <= shot.until) return mixCam(shot.a, shot.b, clamp01((t - prev) / Math.max(0.001, shot.until - prev)));
    prev = shot.until;
  }
  return shots[shots.length - 1].b;
}

/**
 * 0–3 wide hook. Faces, then full-length. The last shot is a high angle
 * over the elves so the scattered orc deaths stay in frame.
 */
export function elfCam(t: number): ElfCam {
  const { elfFront, elfBack, orcFront, midZ } = lines();
  const elfZ = (elfFront + elfBack) * 0.5;
  const feetE = elfFloor(0, elfZ);
  const feetO = elfFloor(0, orcFront);
  const waistE = feetE + 1.02;
  const nearZ = elfFront + 1.15;
  const wideA = look(-2.2, feetE + 2.9, elfFront - 7.2, 0.1, waistE + 0.15, midZ, 74);
  const wideB = look(-1.2, feetE + 2.35, elfFront - 5.6, 0, waistE + 0.1, midZ + 0.5, 66);
  const faceEA = look(-0.78, feetE + 1.78, nearZ + 3.05, -0.78, feetE + 1.55, nearZ, 38);
  const faceEB = look(0.72, feetE + 1.72, nearZ + 2.9, 0.72, feetE + 1.52, nearZ, 36);
  const faceOA = look(0.5, feetO + 1.28, orcFront - 2.7, 0.45, feetO + 1.12, orcFront, 40);
  const faceOB = look(-0.5, feetO + 1.22, orcFront - 2.5, -0.45, feetO + 1.1, orcFront, 38);
  const bodyEA = look(0, feetE + 1.15, elfFront + 6.5, 0, feetE + 0.72, elfZ, 54);
  const bodyEB = look(0.25, feetE + 1.0, elfFront + 6.05, 0.06, feetE + 0.68, elfZ, 52);
  const bodyOA = look(0.1, feetO + 0.95, orcFront - 5.6, 0, feetO + 0.52, orcFront + 1.1, 56);
  const bodyOB = look(-0.22, feetO + 0.82, orcFront - 5.0, 0, feetO + 0.5, orcFront + 1.4, 54);
  const grave = elfBack + 3.1;
  const sideA = look(0.8, feetE + 7.4, elfFront - 5.8, 0, feetE + 0.35, grave, 66);
  const sideB = look(-1.6, feetE + 9.2, elfFront - 3.4, 0.5, feetE + 0.15, grave + 1.4, 70);
  return cutFilm(t, [
    { until: 3, a: wideA, b: wideB },
    { until: 8, a: faceEA, b: faceEB },
    { until: 13, a: faceOA, b: faceOB },
    { until: 19, a: bodyEA, b: bodyEB },
    { until: 25, a: bodyOA, b: bodyOB },
    { until: ELF_SECONDS, a: sideA, b: sideB },
  ]);
}
