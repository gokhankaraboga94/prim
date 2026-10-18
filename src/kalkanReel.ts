export const KALKAN_ID = "kalkan" as const;
export type KalkanId = typeof KALKAN_ID;
export const KALKAN_SECONDS = 9;
export const KALKAN_MODE = { id: KALKAN_ID, label: "kalkan" } as const;
export const KALKAN_N = 100;

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

const COLS = 10;
const ROWS = 10;
const PX = 0.66;
const PZ = 0.58;
const LINE_Z = 0.95;
const RUN = 0.28;
const ARROW_LEN = 0.72;

const SLOTS = (() => {
  const slots: { x: number; z: number }[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) slots.push({ x: (col - 4.5) * PX, z: LINE_Z + row * PZ });
  }
  slots.sort((a, b) => a.z - b.z || Math.abs(a.x) - Math.abs(b.x));
  return slots;
})();

function plantAt(i: number) {
  if (i <= 0) return 1.02;
  if (i < COLS) return 1.38 + (i - 1) * 0.045;
  return 1.5 + ((i - COLS) / (KALKAN_N - COLS - 1)) * 1.38;
}

const CLOSE: KalkanCam = { x: 0, y: 1.62, z: 2.72, lx: 0, ly: 1.58, lz: 0.25, fov: 30 };
const MID: KalkanCam = { x: 0, y: 2.55, z: 6.6, lx: 0, ly: 1.4, lz: 1.05, fov: 46 };
const WIDE: KalkanCam = { x: 0, y: 8.6, z: 15.2, lx: 0, ly: 0.7, lz: 3.4, fov: 58 };
const HOLD: KalkanCam = { x: 0, y: 7.9, z: 14.2, lx: 0, ly: 0.85, lz: 3.3, fov: 56 };

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
  return easeOut((t - 3.05) / 2.05);
}

export function kalkanShield(i: number, t: number): KalkanPose | null {
  if (i < 0 || i >= KALKAN_N) return null;
  const plant = plantAt(i);
  const start = i === 0 ? plant - RUN : Math.max(1.16, plant - RUN);
  if (t < start) return null;
  const u = easeOut((t - start) / Math.max(0.08, plant - start));
  const slot = i === 0 ? { x: 0, z: LINE_Z } : SLOTS[i];
  const side = slot.x < 0 ? -1 : 1;
  const fromX = i === 0 ? -0.55 : slot.x + side * 6.2;
  const fromZ = i === 0 ? 1.7 : slot.z;
  const brace = kalkanBrace(t);
  return {
    x: fromX + (slot.x - fromX) * u,
    y: Math.sin(clamp01(u) * Math.PI) * 0.04,
    z: fromZ + (slot.z - fromZ) * u,
    yaw: 0,
    pitch: -brace * 0.42,
    roll: -side * brace * 0.04,
    scale: 1,
  };
}

export function kalkanHeld(t: number) {
  let n = 0;
  for (let i = 0; i < KALKAN_N; i++) if (t >= plantAt(i)) n++;
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
  const u = easeOut((t - (plantAt(0) - 0.12)) / 0.2);
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
    y: mix(6.4, 2.45, u),
    z: 3.35,
    pitch: mix(-0.2, -0.04, u),
    yaw: 0,
    show: t >= 2.7,
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
  for (let i = 5; i >= 0; i--) {
    const at = plantAt(i);
    if (t >= at && t < at + 0.4) {
      const next = kalkanClean(names[i + 1] || "");
      if (next) return next;
    }
  }
  return victim;
}

export function kalkanLine(t: number) {
  if (t < plantAt(0)) return "bunu kimse tutmazsa ölür";
  return `tutan: ${kalkanHeld(t)}`;
}

export function kalkanHudOpen(t: number) {
  return 1 - easeOut((t - 2.55) / 0.85);
}
