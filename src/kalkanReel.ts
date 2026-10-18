export const KALKAN_ID = "kalkan" as const;
export type KalkanId = typeof KALKAN_ID;
export const KALKAN_SECONDS = 9;
export const KALKAN_MODE = { id: KALKAN_ID, label: "kalkan" } as const;
export const KALKAN_N = 7;

export function isKalkan(id: string | null | undefined): id is KalkanId {
  return id === KALKAN_ID;
}

export type KalkanPose = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  scale: number;
};

export type KalkanCam = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

export type KalkanArrow = {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
};

export type KalkanSword = {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw: number;
  show: boolean;
};

const SLOT_X = [0, -0.58, 0.58, -1.16, 1.16, -1.74, 1.74];
const PLANT = [1.02, 2.0, 2.08, 2.38, 2.48, 2.72, 2.9];
const RUN = 0.34;
const LINE_Z = 0.92;
const ARROW_LEN = 0.72;

const CLOSE: KalkanCam = { x: 0, y: 1.62, z: 2.72, lx: 0, ly: 1.58, lz: 0.25, fov: 30 };
const MID: KalkanCam = { x: 0, y: 1.9, z: 5.15, lx: 0, ly: 1.48, lz: 0.45, fov: 42 };
const WIDE: KalkanCam = { x: 0, y: 2.25, z: 10.2, lx: 0, ly: 1.62, lz: 0.55, fov: 54 };
const HOLD: KalkanCam = { x: 0, y: 2.1, z: 9.6, lx: 0, ly: 1.56, lz: 0.5, fov: 52 };

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function easeOut(v: number) {
  const x = clamp01(v);
  return 1 - (1 - x) * (1 - x) * (1 - x);
}

function mix(a: number, b: number, u: number) {
  return a + (b - a) * u;
}

function mixCam(a: KalkanCam, b: KalkanCam, u: number): KalkanCam {
  return {
    x: mix(a.x, b.x, u),
    y: mix(a.y, b.y, u),
    z: mix(a.z, b.z, u),
    lx: mix(a.lx, b.lx, u),
    ly: mix(a.ly, b.ly, u),
    lz: mix(a.lz, b.lz, u),
    fov: mix(a.fov, b.fov, u),
  };
}

export function kalkanClean(name: string) {
  return String(name || "").trim().replace(/^@+/, "");
}

/** Knight faces +Z, toward the camera. */
export function kalkanVictim(): KalkanPose {
  return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, scale: 1 };
}

export function kalkanBrace(t: number) {
  return easeOut((t - 2.9) / 2.15);
}

export function kalkanShield(i: number, t: number): KalkanPose | null {
  if (i < 0 || i >= KALKAN_N) return null;
  const plant = PLANT[i];
  const start = plant - RUN;
  if (t < start) return null;
  const u = easeOut((t - start) / RUN);
  const side = SLOT_X[i] === 0 ? -1 : Math.sign(SLOT_X[i]);
  const fromX = i === 0 ? -0.55 : side * 3.6;
  const brace = kalkanBrace(t);
  return {
    x: fromX + (SLOT_X[i] - fromX) * u,
    y: Math.sin(clamp01(u) * Math.PI) * 0.05,
    z: 1.85 + (LINE_Z - 1.85) * u,
    yaw: 0,
    pitch: -brace * 0.56,
    roll: -side * brace * 0.07,
    scale: 1,
  };
}

export function kalkanHeld(t: number) {
  let n = 0;
  for (let i = 0; i < KALKAN_N; i++) if (t >= PLANT[i]) n++;
  return n;
}

function arrowAt(x: number, y: number, z: number, tx: number, ty: number, tz: number): KalkanArrow {
  return { x, y, z, dx: tx - x, dy: ty - y, dz: tz - z };
}

/** Tail position. The mesh tip sits ARROW_LEN along the direction. */
export function kalkanArrow(t: number): KalkanArrow {
  const face = arrowAt(0.2, 1.5, 1.02, 0.02, 1.48, 0.3);
  const shield = kalkanShield(0, t);
  if (!shield) return face;
  const caught = arrowAt(shield.x + 0.04, 1.36 + shield.y, shield.z + 0.62, shield.x, 1.32 + shield.y, shield.z + 0.62 - ARROW_LEN);
  const u = easeOut((t - (PLANT[0] - 0.12)) / 0.2);
  return {
    x: mix(face.x, caught.x, u),
    y: mix(face.y, caught.y, u),
    z: mix(face.z, caught.z, u),
    dx: mix(face.dx, caught.dx, u),
    dy: mix(face.dy, caught.dy, u),
    dz: mix(face.dz, caught.dz, u),
  };
}

export function kalkanSword(t: number): KalkanSword {
  const u = kalkanBrace(t);
  return {
    x: 0.04,
    y: mix(3.85, 2.05, u),
    z: 1.22,
    pitch: mix(-0.08, -0.28, u),
    yaw: 0.06,
    show: t >= 2.75,
  };
}

export function kalkanCam(t: number): KalkanCam {
  if (t < 1.15) return CLOSE;
  if (t < 2.2) return mixCam(CLOSE, MID, easeOut((t - 1.15) / 1.05));
  if (t < 3.35) return mixCam(MID, WIDE, easeOut((t - 2.2) / 1.15));
  return mixCam(WIDE, HOLD, easeOut((t - 3.35) / 1.4));
}

export function kalkanFocus(t: number, names: string[]) {
  const victim = kalkanClean(names[0] || "") || "İSİM";
  for (let i = KALKAN_N - 1; i >= 0; i--) {
    const at = PLANT[i];
    if (t >= at && t < at + 0.48) {
      const next = kalkanClean(names[i + 1] || "");
      if (next) return next;
    }
  }
  return victim;
}

export function kalkanLine(t: number) {
  if (t < PLANT[0]) return "bunu kimse tutmazsa ölür";
  return `tutan: ${kalkanHeld(t)}`;
}

export function kalkanHudOpen(t: number) {
  return 1 - easeOut((t - 2.55) / 0.85);
}
