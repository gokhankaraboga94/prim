import type { ShotPose } from "./shotModes";
import type { New1Pose } from "./new1Reel";

export const LAB_ID = "labirent1" as const;
export type LabId = typeof LAB_ID;
export const LAB_MODE = { id: LAB_ID, label: "labirent1" } as const;

export function isLab(id: string | null | undefined): id is LabId {
  return id === LAB_ID;
}

export const LAB_SECONDS = 60;
export const LAB_N = 100;

const COLS = 10;
const BURST = 3.4;
const RUN = 3.15;
const GAP = 2.2;
const HALF = 1.62;
const THICK = 1.45;
const RES = 0.8;
const GATE_Z = 6;
const WIN_ID = 6;

type Pt = [number, number];
export type LabWall = { x: number; y: number; z: number; w: number; h: number; d: number; ry: number };

const DEAD: Pt[][] = [
  [[0, 6], [0, 16], [-10, 16], [-10, 36], [-30, 36]],
  [[0, 6], [0, 16], [10, 16], [10, 36], [10, 46], [30, 46], [42, 46]],
  [[0, 6], [0, 16], [0, 36], [10, 36], [10, 56], [30, 56], [30, 76], [42, 76]],
  [[0, 6], [0, 16], [-10, 16], [-22, 16]],
  [[0, 6], [0, 16], [0, 36], [-10, 36], [-10, 56], [-10, 76], [-24, 76]],
  [[0, 6], [0, 16], [0, 36], [0, 56], [-20, 56], [-34, 56], [-34, 78], [-34, 98]],
];
const WIN: Pt[] = [
  [0, 6],
  [0, 20],
  [0, 40],
  [0, 60],
  [0, 72],
  [18, 72],
  [18, 90],
  [18, 104],
  [4, 104],
  [4, 112],
  [-10, 112],
];
const WIN_POCKETS = [58, 96, 128];

function polyLen(pts: Pt[]) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return n;
}

const DEAD_LEN = DEAD.map(polyLen);

function sample(pts: Pt[], dist: number) {
  let left = Math.max(0, dist);
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dz = pts[i][1] - pts[i - 1][1];
    const len = Math.hypot(dx, dz) || 1;
    if (left <= len) {
      const u = left / len;
      return { x: pts[i - 1][0] + dx * u, z: pts[i - 1][1] + dz * u, ry: Math.atan2(dx, dz) };
    }
    left -= len;
  }
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  return { x: b[0] + (dx / len) * left, z: b[1] + (dz / len) * left, ry: Math.atan2(dx, dz) };
}

function cellKey(ix: number, iz: number) {
  return `${ix},${iz}`;
}

function fillRect(into: Set<string>, x0: number, x1: number, z0: number, z1: number) {
  const ix0 = Math.floor(Math.min(x0, x1) / RES);
  const ix1 = Math.floor(Math.max(x0, x1) / RES);
  const iz0 = Math.floor(Math.min(z0, z1) / RES);
  const iz1 = Math.floor(Math.max(z0, z1) / RES);
  const loX = Math.min(x0, x1);
  const hiX = Math.max(x0, x1);
  const loZ = Math.min(z0, z1);
  const hiZ = Math.max(z0, z1);
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const cx = (ix + 0.5) * RES;
      const cz = (iz + 0.5) * RES;
      if (cx >= loX && cx <= hiX && cz >= loZ && cz <= hiZ) into.add(cellKey(ix, iz));
    }
  }
}

function stampSeg(floor: Set<string>, near: Set<string>, a: Pt, b: Pt) {
  const minX = Math.min(a[0], b[0]) - HALF;
  const maxX = Math.max(a[0], b[0]) + HALF;
  const minZ = Math.min(a[1], b[1]) - HALF;
  const maxZ = Math.max(a[1], b[1]) + HALF;
  fillRect(floor, minX, maxX, minZ, maxZ);
  fillRect(near, minX - THICK, maxX + THICK, minZ - THICK, maxZ + THICK);
}

function buildWalls(): LabWall[] {
  const floor = new Set<string>();
  const near = new Set<string>();
  fillRect(floor, -8.6, 8.6, -18, GATE_Z + 0.4);
  fillRect(near, -8.6 - THICK, 8.6 + THICK, -18 - THICK, GATE_Z + 0.4 + THICK);
  for (const pts of DEAD) {
    for (let i = 1; i < pts.length; i++) stampSeg(floor, near, pts[i - 1], pts[i]);
  }
  for (let i = 1; i < WIN.length; i++) stampSeg(floor, near, WIN[i - 1], WIN[i]);
  const walls = new Set<string>();
  for (const key of near) if (!floor.has(key)) walls.add(key);
  const exit = WIN[WIN.length - 1];
  const prev = WIN[WIN.length - 2];
  const dx = exit[0] - prev[0];
  const dz = exit[1] - prev[1];
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  for (const key of [...walls]) {
    const [ix, iz] = key.split(",").map(Number);
    const cx = (ix + 0.5) * RES - exit[0];
    const cz = (iz + 0.5) * RES - exit[1];
    const along = cx * ux + cz * uz;
    const side = cx * -uz + cz * ux;
    if (along > -0.6 && along < 7 && Math.abs(side) < HALF + 0.35) walls.delete(key);
  }
  for (const key of [...walls]) {
    const [ix, iz] = key.split(",").map(Number);
    const cx = (ix + 0.5) * RES;
    const cz = (iz + 0.5) * RES;
    if (cz < -16.8 && Math.abs(cx) < 7.6) walls.delete(key);
  }
  const used = new Set<string>();
  const cells: [number, number][] = [];
  for (const key of walls) {
    const [ix, iz] = key.split(",").map(Number);
    cells.push([ix, iz]);
  }
  cells.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const boxes: LabWall[] = [];
  const wallH = 4;
  for (const [ix, iz] of cells) {
    const origin = cellKey(ix, iz);
    if (used.has(origin)) continue;
    let w = 1;
    while (walls.has(cellKey(ix + w, iz)) && !used.has(cellKey(ix + w, iz))) w += 1;
    let d = 1;
    for (;;) {
      let rowOk = true;
      for (let dxn = 0; dxn < w; dxn++) {
        const kk = cellKey(ix + dxn, iz + d);
        if (!walls.has(kk) || used.has(kk)) {
          rowOk = false;
          break;
        }
      }
      if (!rowOk) break;
      d += 1;
    }
    for (let dz = 0; dz < d; dz++) for (let dxn = 0; dxn < w; dxn++) used.add(cellKey(ix + dxn, iz + dz));
    const x0 = ix * RES;
    const z0 = iz * RES;
    boxes.push({
      x: (x0 + (ix + w) * RES) / 2,
      y: wallH / 2 - 0.04,
      z: (z0 + (iz + d) * RES) / 2,
      w: w * RES,
      h: wallH,
      d: d * RES,
      ry: 0,
    });
  }
  return boxes;
}

export const LAB_WALLS: LabWall[] = buildWalls();

export function labRosterIds(names: string[], soldiers: number) {
  const cap = Math.max(0, Math.min(Math.floor(soldiers), names.length));
  const named: number[] = [];
  for (let i = 0; i < cap; i++) if (names[i]?.trim()) named.push(i);
  const pool = named.length ? named : Array.from({ length: cap }, (_, i) => i);
  return pool.slice(-Math.min(LAB_N, pool.length));
}

function home(i: number) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return { x: (col - (COLS - 1) / 2) * 1.16, z: -1.1 - row * 0.74 };
}

function branchOf(i: number) {
  const col = i % COLS;
  if (col === 4) return WIN_ID;
  if (col <= 1) return 0;
  if (col <= 3) return 1;
  if (col <= 6) return 2;
  if (col === 7) return 3;
  if (col === 8) return 4;
  return 5;
}

const FOE_SPOTS: { path: Pt[]; dist: number; n: number; row: number }[] = [
  ...DEAD.map((pts, k) => ({ path: pts, dist: Math.max(8, DEAD_LEN[k] - 4.4), n: 3, row: 0 })),
  { path: WIN, dist: WIN_POCKETS[0], n: 4, row: 0 },
  { path: WIN, dist: WIN_POCKETS[1], n: 4, row: 1 },
  { path: WIN, dist: WIN_POCKETS[2], n: 4, row: 2 },
];

export const LAB_FOES = FOE_SPOTS.reduce((n, spot) => n + spot.n, 0);

function buildPlan() {
  const die = new Float64Array(LAB_N);
  const kind = new Uint8Array(LAB_N);
  for (let i = 0; i < LAB_N; i++) {
    const kindId = branchOf(i);
    kind[i] = kindId;
    const row = Math.floor(i / COLS);
    if (kindId < DEAD.length) {
      const dist = Math.max(4, DEAD_LEN[kindId] - 2.2);
      die[i] = BURST + (dist + row * GAP) / RUN;
    } else if (row < 4) {
      const pocket = row <= 1 ? WIN_POCKETS[row] : WIN_POCKETS[2];
      die[i] = BURST + (pocket + row * GAP) / RUN;
    } else die[i] = 1e9;
  }
  return { die, kind };
}

const PLAN = buildPlan();

function poseAt(i: number, t: number) {
  const start = home(i);
  const burstU = Math.min(1, Math.max(0, t) / BURST);
  const x = start.x * (1 - burstU * 0.28);
  const z = start.z + (GATE_Z - start.z) * burstU;
  if (t <= BURST) return { x, z, ry: 0 };
  const kind = PLAN.kind[i];
  const pts = kind < DEAD.length ? DEAD[kind] : WIN;
  const row = Math.floor(i / COLS);
  const along = RUN * (Math.min(t, PLAN.die[i]) - BURST) - row * GAP;
  const hold = sample(pts, Math.max(0, along));
  const col = i % COLS;
  const lane = kind === WIN_ID ? (row % 2) - 0.5 : (col % 2 === 0 ? -0.46 : 0.46);
  const rx = Math.cos(hold.ry);
  const rz = -Math.sin(hold.ry);
  const blend = Math.min(1, (t - BURST) / 0.55);
  const px = hold.x + rx * lane;
  const pz = hold.z + rz * lane;
  return {
    x: x * (1 - blend) + px * blend,
    z: z * (1 - blend) + pz * blend,
    ry: hold.ry * blend,
  };
}

export function labAlive(recT: number, soldiers = LAB_N) {
  const n = Math.max(1, Math.min(LAB_N, Math.floor(soldiers) || LAB_N));
  const t = Math.max(0, recT);
  let alive = 0;
  for (let i = 0; i < n; i++) if (t < PLAN.die[i]) alive += 1;
  return alive;
}

export function labFriendAt(i: number, n: number, recT: number, out: New1Pose) {
  const count = Math.max(1, Math.min(LAB_N, Math.floor(n) || LAB_N));
  const t = Math.max(0, recT);
  if (i < 0 || i >= count) {
    out.x = 0;
    out.y = -40;
    out.z = 0;
    out.rx = 0;
    out.ry = 0;
    out.rz = 0;
    out.s = 0;
    return;
  }
  const dieAt = PLAN.die[i];
  const p = poseAt(i, Math.min(t, dieAt < 1e8 ? dieAt : t));
  const bob = Math.sin(t * 9 + i);
  out.x = p.x;
  out.z = p.z;
  out.ry = p.ry;
  out.rz = 0;
  out.y = t < dieAt ? Math.abs(bob) * 0.04 : 0;
  out.rx = t < dieAt ? 0.22 + bob * 0.04 : 0;
  out.s = 1;
  if (t >= dieAt && dieAt < 1e8 && t < dieAt + 1.45) {
    const u = Math.min(1, (t - dieAt) / 0.32);
    out.rx = u * 1.45;
    out.y = 0.05;
  } else if (dieAt < 1e8 && t >= dieAt + 1.45) {
    out.y = -40;
    out.s = 0;
  }
}

export function labFoeAt(i: number, recT: number, out: New1Pose) {
  const t = Math.max(0, recT);
  let cursor = i;
  let spot = FOE_SPOTS[0];
  for (const item of FOE_SPOTS) {
    if (cursor < item.n) {
      spot = item;
      break;
    }
    cursor -= item.n;
  }
  const at = sample(spot.path, spot.dist);
  const col = cursor % 4;
  const span = spot.n <= 3 ? col - 1 : col - 1.5;
  const rx = Math.cos(at.ry);
  const rz = -Math.sin(at.ry);
  out.x = at.x + rx * span * 0.72;
  out.z = at.z + rz * span * 0.72;
  out.ry = at.ry + Math.PI;
  out.rx = 0.08;
  out.rz = 0;
  out.y = 0;
  out.s = 1;
  const dieAt = BURST + Math.max(0.4, spot.dist + spot.row * GAP - 0.85) / RUN;
  if (t >= dieAt && t < dieAt + 1.35) {
    const u = Math.min(1, (t - dieAt) / 0.28);
    out.rx = u * 1.45;
    out.y = 0.05;
  } else if (t >= dieAt + 1.35) {
    out.y = -40;
    out.s = 0;
  }
}

export function sampleLabCam(recT: number): ShotPose {
  const t = Math.max(0, recT);
  const u = t <= 5 ? 0 : Math.min(1, (t - 5) / 8);
  const e = u * u * (3 - 2 * u);
  let survivor = 44;
  for (let i = 0; i < LAB_N; i++) {
    if (PLAN.die[i] > 1e8) {
      survivor = i;
      break;
    }
  }
  const lead = poseAt(survivor, t);
  const lookX = lead.x * e;
  const lookZ = -3.2 * (1 - e) + lead.z * e;
  const height = 44 - e * 24;
  const back = 34 - e * 18;
  const ahead = 4.5 * e;
  const fx = Math.sin(lead.ry);
  const fz = Math.cos(lead.ry);
  const faceX = fx * e;
  const faceZ = fz * e + (1 - e);
  return {
    x: lookX - faceX * back * 0.22 + fx * ahead * e,
    y: height,
    z: lookZ - faceZ * back,
    lx: lookX + fx * ahead,
    ly: 1.15,
    lz: lookZ + 1.5 + fz * ahead,
    fov: 50 - e * 10,
  };
}
