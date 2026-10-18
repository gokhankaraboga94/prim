export const ORDU_ID = "ordu" as const;
export type OrduId = typeof ORDU_ID;
export const ORDU_MODE = { id: ORDU_ID, label: "ordu" } as const;
export const ORDU_SECONDS = 13;

const PITCH = 2.48;
const GAP = 5.4;
const ROMAN_YAW = Math.PI / 2;

export function isOrdu(id: string | null | undefined): id is OrduId {
  return id === ORDU_ID;
}

function easeOut(u: number) {
  const x = Math.max(0, Math.min(1, u));
  return 1 - (1 - x) * (1 - x);
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
  const side = friends < 1 ? 0 : Math.ceil(Math.sqrt(friends));
  const cols = side;
  const rows = friends < 1 ? 0 : Math.ceil(friends / cols);
  const width = Math.max(0, cols - 1) * PITCH;
  const depth = Math.max(0, rows - 1) * PITCH;
  return { friends, foes: friends, cols, rows, pitchX: PITCH, pitchZ: PITCH, gap: GAP, width, depth };
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

function seat(cols: number, rows: number, count: number, i: number, pitch: number, z0: number, zSign: number) {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const inRow = row === rows - 1 ? count - row * cols : cols;
  const x = (col - (inRow - 1) / 2) * pitch;
  const z = z0 + zSign * row * pitch;
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
    const s = seat(form.cols, form.rows, form.friends, i, form.pitchX, -form.gap / 2, -1);
    layout.friendX[i] = s.x;
    layout.friendZ[i] = s.z;
    layout.friendRow[i] = s.row;
    layout.friendPhase[i] = (i % 17) * 0.37;
  }
  for (let i = 0; i < form.foes; i++) {
    const s = seat(form.cols, form.rows, form.foes, i, form.pitchX, form.gap / 2, 1);
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
  const ahead = -cz;
  if (ahead < 0.8) return { x: Number.NaN, y: Number.NaN };
  const tanV = Math.tan((cam.fov * Math.PI) / 360);
  const tanH = tanV * aspect;
  return { x: cx / ahead / tanH, y: cy / ahead / tanV };
}

function frameError(cam: Cam, xHalf: number, zNear: number, zFar: number) {
  const near = ndc(0, 2.4, zNear, cam);
  const far = ndc(0, 2.4, zFar, cam);
  const left = ndc(-xHalf, 1.2, zNear, cam);
  const right = ndc(xHalf, 1.2, zNear, cam);
  const farSide = ndc(xHalf, 1.2, zFar, cam);
  if (!Number.isFinite(near.x + far.x + left.x + right.x + farSide.x)) return 80;
  if (far.y <= near.y) return 80;
  const maxX = Math.max(Math.abs(left.x), Math.abs(right.x), Math.abs(farSide.x));
  return (
    Math.abs(maxX - 0.84) * 1.3 +
    Math.abs(near.y + 0.86) * 1.5 +
    Math.abs(far.y - 0.84) * 1.5 +
    Math.max(0, maxX - 0.92) * 10
  );
}

function fitCam(xHalf: number, zNear: number, zFar: number, fov: number): Cam {
  const span = Math.max(1, zFar - zNear);
  let extra = 2.8 + span * 0.09;
  let y = 3 + span * 1.2 + xHalf * 0.2;
  let frac = 0.42;
  let stepExtra = span * 0.25 + 1;
  let stepY = Math.max(span, xHalf * 2) * 0.5;
  let stepFrac = 0.18;
  for (let n = 0; n < 10; n++) {
    let bestErr = Infinity;
    let bestY = y;
    let bestExtra = extra;
    let bestFrac = frac;
    for (const de of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        for (const df of [-1, 0, 1]) {
          const nextExtra = Math.max(2.2, extra + de * stepExtra);
          const nextY = Math.max(4, y + dy * stepY);
          const nextFrac = Math.min(0.8, Math.max(0.08, frac + df * stepFrac));
          const cam: Cam = {
            x: 0,
            y: nextY,
            z: zNear - nextExtra,
            lx: 0,
            ly: 1.15,
            lz: zNear + (zFar - zNear) * nextFrac,
            fov,
          };
          const err = frameError(cam, xHalf, zNear, zFar);
          if (err >= bestErr) continue;
          bestErr = err;
          bestY = nextY;
          bestExtra = nextExtra;
          bestFrac = nextFrac;
        }
      }
    }
    y = bestY;
    extra = bestExtra;
    frac = bestFrac;
    stepExtra *= 0.5;
    stepY *= 0.5;
    stepFrac *= 0.5;
  }
  return {
    x: 0,
    y,
    z: zNear - extra,
    lx: 0,
    ly: 1.15,
    lz: zNear + (zFar - zNear) * frac,
    fov,
  };
}

export function orduCam(t: number, friends = 1): Cam {
  const form = orduForm(Math.max(1, friends));
  const drift = Math.sin(t * 0.35) * 0.35;
  const pull = t <= 3 ? 0 : easeOut((t - 3) / 1.7);
  const front = form.gap / 2;
  const zNear = -(front + form.depth * pull);
  const zFar = front + form.depth * pull;
  const xClose = Math.min(Math.max(form.width / 2, form.pitchX), form.pitchX * 1.7);
  const xHalf = xClose + (Math.max(form.width / 2, xClose) - xClose) * pull;
  const cam = fitCam(Math.max(form.pitchX * 0.8, xHalf), zNear, zFar, 48 - pull * 3);
  cam.x += drift;
  cam.lx += drift * 0.15;
  return cam;
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
