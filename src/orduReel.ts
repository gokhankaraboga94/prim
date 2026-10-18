export const ORDU_ID = "ordu" as const;
export type OrduId = typeof ORDU_ID;
export const ORDU_MODE = { id: ORDU_ID, label: "ordu" } as const;
export const ORDU_SECONDS = 13;

const PITCH_X = 2.72;
const PITCH_Z = 2.18;
const GAP = 7.4;
const ROMAN_YAW = Math.PI / 2;

export function isOrdu(id: string | null | undefined): id is OrduId {
  return id === ORDU_ID;
}

function smooth(u: number) {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * u);
}

export type OrduForm = {
  friends: number;
  foes: number;
  cols: number;
  rows: number;
  pitchX: number;
  pitchZ: number;
  gap: number;
  width: number;
  depth: number;
};

export function orduForm(friendsIn: number): OrduForm {
  const friends = Math.max(0, Math.floor(friendsIn));
  const rows = friends < 1 ? 0 : Math.min(8, Math.max(1, Math.ceil(Math.sqrt(friends * 0.55))));
  const cols = friends < 1 ? 0 : Math.ceil(friends / rows);
  const width = Math.max(0, cols - 1) * PITCH_X;
  const depth = Math.max(0, rows - 1) * PITCH_Z;
  return { friends, foes: friends, cols, rows, pitchX: PITCH_X, pitchZ: PITCH_Z, gap: GAP, width, depth };
}

export type OrduLayout = OrduForm & {
  friendX: Float32Array;
  friendZ: Float32Array;
  friendRow: Uint8Array;
  friendPhase: Float32Array;
  romanX: Float32Array;
  romanZ: Float32Array;
  romanRow: Uint8Array;
  romanPhase: Float32Array;
  liveX: Float32Array;
  liveZ: Float32Array;
};

function seat(cols: number, i: number, pitchX: number, pitchZ: number, z0: number, zSign: number) {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const stagger = (row % 2) * pitchX * 0.38;
  const x = (col - (cols - 1) / 2) * pitchX + stagger;
  const z = z0 + zSign * row * pitchZ;
  return { x, z, row };
}

export function makeOrduLayout(friendsIn: number): OrduLayout {
  const form = orduForm(friendsIn);
  const layout: OrduLayout = {
    ...form,
    friendX: new Float32Array(form.friends),
    friendZ: new Float32Array(form.friends),
    friendRow: new Uint8Array(form.friends),
    friendPhase: new Float32Array(form.friends),
    romanX: new Float32Array(form.foes),
    romanZ: new Float32Array(form.foes),
    romanRow: new Uint8Array(form.foes),
    romanPhase: new Float32Array(form.foes),
    liveX: new Float32Array(form.friends),
    liveZ: new Float32Array(form.friends),
  };
  for (let i = 0; i < form.friends; i++) {
    const s = seat(form.cols, i, form.pitchX, form.pitchZ, -form.gap / 2, -1);
    layout.friendX[i] = s.x;
    layout.friendZ[i] = s.z;
    layout.friendRow[i] = s.row;
    layout.friendPhase[i] = (i % 17) * 0.37;
  }
  for (let i = 0; i < form.foes; i++) {
    const s = seat(form.cols, i, form.pitchX, form.pitchZ, form.gap / 2, 1);
    layout.romanX[i] = s.x;
    layout.romanZ[i] = s.z;
    layout.romanRow[i] = s.row;
    layout.romanPhase[i] = (i % 19) * 0.31;
  }
  return layout;
}

export type OrduPose = { x: number; z: number; yaw: number; pitch: number; roll: number };

function ready(x: number, z: number, phase: number, t: number, yaw: number, lean: number): OrduPose {
  const sway = Math.sin(t * 1.05 + phase);
  return {
    x: x + sway * 0.045,
    z: z + Math.cos(t * 0.82 + phase) * 0.03,
    yaw: yaw + sway * 0.035,
    pitch: lean,
    roll: sway * 0.018,
  };
}

export function orduKnight(layout: OrduLayout, i: number, t: number) {
  return ready(layout.friendX[i], layout.friendZ[i], layout.friendPhase[i], t, 0, -0.05);
}

export function orduRoman(layout: OrduLayout, i: number, t: number) {
  return ready(layout.romanX[i], layout.romanZ[i], layout.romanPhase[i], t, ROMAN_YAW, -0.04);
}

type Cam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

function mixCam(a: Cam, b: Cam, u: number): Cam {
  const k = 1 - u;
  return {
    x: a.x * k + b.x * u,
    y: a.y * k + b.y * u,
    z: a.z * k + b.z * u,
    lx: a.lx * k + b.lx * u,
    ly: a.ly * k + b.ly * u,
    lz: a.lz * k + b.lz * u,
    fov: a.fov * k + b.fov * u,
  };
}

function ndc(px: number, py: number, pz: number, cam: Cam) {
  const zx = cam.x - cam.lx;
  const zy = cam.y - cam.ly;
  const zz = cam.z - cam.lz;
  const zl = Math.hypot(zx, zy, zz) || 1;
  const Zx = zx / zl;
  const Zy = zy / zl;
  const Zz = zz / zl;
  const ux = 0;
  const uy = 1;
  const uz = 0;
  let xx = uy * Zz - uz * Zy;
  let xy = uz * Zx - ux * Zz;
  let xz = ux * Zy - uy * Zx;
  const xl = Math.hypot(xx, xy, xz) || 1;
  xx /= xl;
  xy /= xl;
  xz /= xl;
  const yx = Zy * xz - Zz * xy;
  const yy = Zz * xx - Zx * xz;
  const yz = Zx * xy - Zy * xx;
  const dx = px - cam.x;
  const dy = py - cam.y;
  const dz = pz - cam.z;
  const cx = dx * xx + dy * xy + dz * xz;
  const cy = dx * yx + dy * yy + dz * yz;
  const cz = dx * Zx + dy * Zy + dz * Zz;
  const aspect = 1080 / 1920;
  const tanV = Math.tan((cam.fov * Math.PI) / 360);
  const tanH = tanV * aspect;
  return { x: cx / -cz / tanH, y: cy / -cz / tanV };
}

function wideCam(form: OrduForm): Cam {
  const back = form.gap / 2 + form.depth;
  const far = back;
  let y = Math.max(22, (form.width + back) * 1.05);
  let extra = Math.max(14, form.width * 0.28 + 8);
  const fov = 48;
  const pts = [
    [-form.width / 2, 2.3, -form.gap / 2],
    [form.width / 2, 2.3, -form.gap / 2],
    [-form.width / 2, 2.3, -back],
    [form.width / 2, 2.3, -back],
    [-form.width / 2, 1.6, far],
    [form.width / 2, 1.6, far],
  ];
  let cam: Cam = { x: form.width * 0.1, y, z: -back - extra, lx: 0, ly: 0.55, lz: 0, fov };
  for (let n = 0; n < 8; n++) {
    cam = { x: form.width * 0.1, y, z: -back - extra, lx: 0, ly: 0.55, lz: 0, fov };
    let maxX = 0;
    let maxY = 0;
    for (const p of pts) {
      const q = ndc(p[0], p[1], p[2], cam);
      if (!Number.isFinite(q.x)) continue;
      maxX = Math.max(maxX, Math.abs(q.x));
      maxY = Math.max(maxY, Math.abs(q.y));
    }
    if (maxX > 0.88 || maxY > 0.9) {
      y *= 1.1;
      extra *= 1.08;
    } else if (maxX < 0.7 && maxY < 0.7) {
      y *= 0.94;
      extra *= 0.94;
    } else break;
  }
  return cam;
}

export function orduCam(t: number, friends = 1): Cam {
  const form = orduForm(Math.max(1, friends));
  const drift = Math.sin(t * 0.42) * 0.55;
  const close: Cam = {
    x: 0.4 + drift,
    y: 9.6,
    z: -18,
    lx: drift * 0.25,
    ly: 1.05,
    lz: 3.2,
    fov: 50,
  };
  const u = smooth((t - 3) / 5.1);
  const wide = wideCam(form);
  wide.x += drift * 0.35;
  return mixCam(close, wide, u);
}

export function orduFar(friends: number) {
  const form = orduForm(friends);
  return Math.max(520, form.depth * 10 + form.width * 4 + 180);
}

export function orduHaze(friends: number) {
  const form = orduForm(friends);
  const far = Math.max(240, form.width * 2.4 + form.depth * 4 + 120);
  return { near: 36, far };
}
