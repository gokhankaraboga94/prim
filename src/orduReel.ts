export const ORDU_ID = "ordu" as const;
export type OrduId = typeof ORDU_ID;
export const ORDU_MODE = { id: ORDU_ID, label: "ordu" } as const;
export const ORDU_SECONDS = 13;

const PITCH = 2.48;
const GAP = 8.1;
const ROMAN_YAW = Math.PI / 2;

export function isOrdu(id: string | null | undefined): id is OrduId {
  return id === ORDU_ID;
}

function easeOut(u: number) {
  const x = Math.max(0, Math.min(1, u));
  return 1 - (1 - x) * (1 - x);
}

function easeInOut(u: number) {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
}

export type OrduForm = {
  friends: number;
  foes: number;
  cols: number;
  rows: number;
  foeCols: number;
  foeRows: number;
  pitchX: number;
  pitchZ: number;
  gap: number;
  width: number;
  depth: number;
  friendDepth: number;
  foeDepth: number;
};

function square(count: number) {
  const side = count < 1 ? 0 : Math.ceil(Math.sqrt(count));
  const cols = side;
  const rows = count < 1 ? 0 : Math.ceil(count / Math.max(1, cols));
  return {
    cols,
    rows,
    width: Math.max(0, cols - 1) * PITCH,
    depth: Math.max(0, rows - 1) * PITCH,
  };
}

export function orduForm(friendsIn: number): OrduForm {
  const friends = Math.max(0, Math.floor(friendsIn));
  const foes = friends * 2;
  const ours = square(friends);
  const theirs = square(foes);
  return {
    friends,
    foes,
    cols: ours.cols,
    rows: ours.rows,
    foeCols: theirs.cols,
    foeRows: theirs.rows,
    pitchX: PITCH,
    pitchZ: PITCH,
    gap: GAP,
    width: Math.max(ours.width, theirs.width),
    depth: ours.depth + theirs.depth,
    friendDepth: ours.depth,
    foeDepth: theirs.depth,
  };
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
    const s = seat(form.foeCols, form.foeRows, form.foes, i, form.pitchX, form.gap / 2, 1);
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

function frameError(cam: Cam, nearHalf: number, farHalf: number, zNear: number, zFar: number, zFront: number) {
  const near = ndc(0, 2.4, zNear, cam);
  const far = ndc(0, 2.4, zFar, cam);
  const left = ndc(-nearHalf, 1.2, zNear, cam);
  const right = ndc(nearHalf, 1.2, zNear, cam);
  const farSide = ndc(farHalf, 1.2, zFar, cam);
  const foeFront = ndc(farHalf, 1.2, zFront, cam);
  if (!Number.isFinite(near.x + far.x + left.x + right.x + farSide.x + foeFront.x)) return 80;
  if (far.y <= near.y) return 80;
  const maxX = Math.max(Math.abs(left.x), Math.abs(right.x), Math.abs(farSide.x), Math.abs(foeFront.x));
  return (
    Math.abs(maxX - 0.84) * 1.3 +
    Math.abs(near.y + 0.86) * 1.5 +
    Math.abs(far.y - 0.84) * 1.5 +
    Math.max(0, maxX - 0.92) * 10
  );
}

function fitCam(nearHalf: number, farHalf: number, zNear: number, zFar: number, zFront: number, fov: number): Cam {
  const span = Math.max(1, zFar - zNear);
  const xHalf = Math.max(nearHalf, farHalf);
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
          const err = frameError(cam, nearHalf, farHalf, zNear, zFar, zFront);
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

function fitPull(form: OrduForm, pull: number): Cam {
  const front = form.gap / 2;
  const zNear = -(front + form.friendDepth * pull);
  const zFar = front + form.foeDepth * pull;
  const friendHalf = Math.max(0, form.cols - 1) * form.pitchX * 0.5;
  const foeHalf = Math.max(0, form.foeCols - 1) * form.pitchX * 0.5;
  const xClose = Math.min(Math.max(foeHalf, form.pitchX), form.pitchX * 1.7);
  const nearHalf = Math.max(form.pitchX * 0.8, xClose + (Math.max(friendHalf, xClose) - xClose) * pull);
  const farHalf = Math.max(form.pitchX * 0.8, xClose + (Math.max(foeHalf, xClose) - xClose) * pull);
  return fitCam(nearHalf, farHalf, zNear, zFar, front, 48 - pull * 3);
}

function mixCam(a: Cam, b: Cam, u: number): Cam {
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    z: a.z + (b.z - a.z) * u,
    lx: a.lx + (b.lx - a.lx) * u,
    ly: a.ly + (b.ly - a.ly) * u,
    lz: a.lz + (b.lz - a.lz) * u,
    fov: a.fov + (b.fov - a.fov) * u,
  };
}

const PULL_END = 4.7;
const RETURN_END = 7.3;
const endCams = new Map<number, { close: Cam; wide: Cam; halfway: number }>();

function lookDist(cam: Cam) {
  return Math.hypot(cam.x - cam.lx, cam.y - cam.ly, cam.z - cam.lz);
}

function closerBy(full: Cam, close: Cam, keep: number) {
  const goal = lookDist(full) * keep;
  if (lookDist(close) >= goal) return { ...full };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (lookDist(mixCam(full, close, mid)) > goal) lo = mid;
    else hi = mid;
  }
  return mixCam(full, close, (lo + hi) / 2);
}

function halfwayMix(close: Cam, wide: Cam, zLimit: number) {
  const goal = lookDist(wide) * 0.375;
  let lo = 0;
  let hi = 1.85;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const cam = mixCam(wide, close, mid);
    if (lookDist(cam) > goal && cam.z <= zLimit) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function orduCam(t: number, friends = 1): Cam {
  const form = orduForm(Math.max(1, friends));
  let ends = endCams.get(form.friends);
  if (!ends) {
    const close = fitPull(form, 0);
    const full = fitPull(form, 1);
    const wide = closerBy(full, close, 0.7);
    ends = { close, wide, halfway: halfwayMix(close, wide, -form.gap / 2 - 1.2) };
    endCams.set(form.friends, ends);
  }
  let cam: Cam;
  if (t <= 3) cam = { ...ends.close };
  else if (t <= PULL_END) cam = mixCam(ends.close, ends.wide, easeOut((t - 3) / (PULL_END - 3)));
  else {
    const back = easeInOut((t - PULL_END) / (RETURN_END - PULL_END));
    cam = mixCam(ends.wide, ends.close, back * ends.halfway);
  }
  const drift = Math.sin(t * 0.35) * 0.35;
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
  const far = Math.max(420, form.width * 2.4 + form.depth * 4 + 160);
  return { near: 78, far };
}
