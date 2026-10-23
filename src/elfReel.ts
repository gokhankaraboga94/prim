export const ELF_ID = "elf" as const;
export type ElfId = typeof ELF_ID;
export const ELF_MODE = { id: ELF_ID, label: "elf" } as const;
export const ELF_SECONDS = 24;

export const ELF_N = 10;
export const ORC_N = 52;

export const ELF_URLS = ["/models/new/elf.glb", "/models/new/orc1.glb", "/models/new/orc2.glb", "/models/new/meydan.glb"] as const;
export const ELF_ELF_URL = ELF_URLS[0];
export const ELF_ORC1_URL = ELF_URLS[1];
export const ELF_ORC2_URL = ELF_URLS[2];
export const ELF_FIELD_URL = ELF_URLS[3];

export function isElf(id: string | null | undefined): id is ElfId {
  return id === ELF_ID;
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

/** Elves hold a shallow crescent; they never leave the line. */
export function elfAt(i: number, _t: number): ElfPose {
  const u = (i - (ELF_N - 1) / 2) / Math.max(1, (ELF_N - 1) / 2);
  return {
    x: u * 8.6,
    y: 0,
    z: -8.4 + u * u * 1.15,
    yaw: 0,
    pitch: 0,
    roll: 0,
    hide: false,
  };
}

function orcSeat(i: number) {
  const col = i % 13;
  const row = Math.floor(i / 13);
  return {
    kind: (i + row) % 2,
    x: (col - 6) * 2.28 + (row % 2) * 0.62,
    z0: 44 + row * 3.55,
    start: 1.05 + (col % 5) * 0.16 + row * 0.38 + hash(i, 1) * 0.35,
    speed: 3.55 + hash(i, 2) * 0.85,
    killZ: 4.8 + hash(i, 3) * 17.4,
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
    return { x: seat.x, y: 0, z: seat.z0, yaw: Math.PI, pitch: -0.12, roll: 0, hide: t < seat.start - 0.4 };
  }
  const killDist = seat.z0 - seat.killZ;
  const dist = runT * seat.speed;
  const dead = dist >= killDist;
  const fall = dead ? clamp01((dist - killDist) / Math.max(0.8, seat.speed * 0.55)) : 0;
  return {
    x: seat.x + (dead ? Math.sign(seat.x || 1) * fall * 0.55 : 0),
    y: 0,
    z: dead ? seat.killZ : seat.z0 - dist,
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
  if (phase < 0.2 || t < 1.6) return false;
  const u = (phase - 0.2) / (cycle - 0.2);
  const from = elfAt(elf, t);
  const aim = 6 + ((elf * 7) % 11) * 1.15 + Math.sin(t * 0.7 + elf) * 1.4;
  const x0 = from.x + 0.18;
  const y0 = 1.42;
  const z0 = from.z + 0.55;
  const x1 = from.x * 0.18 + Math.sin(elf * 1.8) * 1.6;
  const y1 = 1.05;
  const z1 = aim;
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
  const wide = look(22, 15.5, 6, 0, 1.1, 10, 42);
  const hold = look(16, 12.2, 10, 0.4, 1.2, 14, 40);
  const charge = look(11.5, 2.05, 30, 1.2, 1.15, 24, 38);
  const elfClose = look(2.15, 1.58, -4.6, 0.2, 1.42, -8.1, 32);
  const volley = look(1.4, 3.4, 1.2, 0.6, 1.35, 16, 34);
  const rain = look(-2, 7.4, -16, 0, 1.1, 12, 44);
  const last = look(-7.2, 1.72, 6.4, 0.4, 1.05, 9, 36);
  const line = look(0.3, 1.62, -3.1, 0, 1.38, -8.2, 34);
  const end = look(24, 17.5, -8, 0, 0.7, 8, 46);
  if (t < 2.7) return mixCam(wide, hold, t / 2.7);
  if (t < 6.1) return mixCam(hold, charge, (t - 2.7) / 3.4);
  if (t < 8.6) return mixCam(charge, elfClose, (t - 6.1) / 2.5);
  if (t < 11.2) return mixCam(elfClose, volley, (t - 8.6) / 2.6);
  if (t < 14.5) return mixCam(volley, rain, (t - 11.2) / 3.3);
  if (t < 18) return mixCam(rain, last, (t - 14.5) / 3.5);
  if (t < 20.6) return mixCam(last, line, (t - 18) / 2.6);
  return mixCam(line, end, Math.min(1, (t - 20.6) / 3.2));
}
