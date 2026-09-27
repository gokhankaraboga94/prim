import type { ShotPose } from "./shotModes";
import type { New1Pose } from "./new1Reel";

export const LAB_ID = "labirent1" as const;
export type LabId = typeof LAB_ID;
export const LAB_MODE = { id: LAB_ID, label: "labirent1" } as const;

export function isLab(id: string | null | undefined): id is LabId {
  return id === LAB_ID;
}
export const LAB_SECONDS = 34;
export const LAB_N = 36;
export const LAB_FOES = 9;

const SPEED = 5.05;
const GAP = 1.58;
const HEAD0 = 6;
const SIDE = 1.12;

const MAIN: Array<[number, number]> = [
  [0, 0],
  [0, 15],
  [13, 15],
  [13, 30],
  [1, 30],
  [1, 46],
  [1, 60],
  [16, 60],
];
const WRONG: Array<[number, number]> = [
  [16, 60],
  [28, 60],
  [28, 74],
];
const RIGHT: Array<[number, number]> = [
  [16, 60],
  [16, 78],
  [4, 78],
  [4, 94],
];

export const LAB_WALLS: Array<[number, number, number, number]> = [
  ...pairs(MAIN),
  ...pairs(WRONG),
  ...pairs(RIGHT),
  [0, 15, -14, 15],
  [-14, 15, -14, 30],
  [13, 22, 13, 6],
  [13, 6, 26, 6],
  [1, 46, -14, 46],
  [-14, 46, -14, 60],
  [16, 68, 28, 68],
  [4, 86, -8, 86],
];

function pairs(pts: Array<[number, number]>) {
  const out: Array<[number, number, number, number]> = [];
  for (let i = 1; i < pts.length; i++) out.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
  return out;
}

function polyLen(pts: Array<[number, number]>) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return n;
}

const FORK = polyLen(MAIN);
const WRONG_LEN = polyLen(WRONG);

function sample(pts: Array<[number, number]>, dist: number) {
  let left = Math.max(0, dist);
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dz = pts[i][1] - pts[i - 1][1];
    const len = Math.hypot(dx, dz) || 1;
    if (left <= len || i === pts.length - 1) {
      const u = Math.min(1, left / len);
      return { x: pts[i - 1][0] + dx * u, z: pts[i - 1][1] + dz * u, ry: Math.atan2(dx, dz) };
    }
    left -= len;
  }
  const last = pts[pts.length - 1];
  return { x: last[0], z: last[1], ry: 0 };
}

export function labDieAt(i: number) {
  if (i < 8) return 7.5 + i * 0.22;
  if (i < 21) return 13.3 + (i - 8) * 0.28;
  if (i < 30) {
    const back = Math.floor(i / 2) * GAP;
    return (FORK + WRONG_LEN - 0.6 + back - HEAD0) / SPEED;
  }
  return 1e9;
}

function headAt(t: number) {
  return HEAD0 + SPEED * Math.max(0, t);
}

function place(i: number, t: number) {
  const moving = Math.min(Math.max(0, t), labDieAt(i));
  const along = headAt(moving) - Math.floor(i / 2) * GAP;
  const branch = i >= 30 ? RIGHT : i >= 21 ? WRONG : null;
  const pose = !branch || along <= FORK ? sample(MAIN, along) : sample(branch, along - FORK);
  const lane = (i % 2) - 0.5;
  const rx = Math.cos(pose.ry);
  const rz = -Math.sin(pose.ry);
  return { x: pose.x + rx * lane * SIDE, z: pose.z + rz * lane * SIDE, ry: pose.ry };
}

export function labFriendAt(i: number, n: number, recT: number, out: New1Pose) {
  const count = Math.max(1, Math.min(n, LAB_N));
  const t = Math.max(0, recT);
  if (i >= count) {
    out.x = 0;
    out.y = -40;
    out.z = 0;
    out.rx = 0;
    out.ry = 0;
    out.rz = 0;
    out.s = 0;
    return;
  }
  const dieAt = labDieAt(i);
  const p = place(i, t);
  const bob = Math.sin(t * 11 + i);
  out.x = p.x;
  out.z = p.z;
  out.ry = p.ry;
  out.rz = 0;
  out.y = Math.abs(bob) * 0.05;
  out.rx = 0.28 + bob * 0.06;
  out.s = 1;
  if (t >= dieAt && dieAt < 1e8 && t < dieAt + 1.5) {
    const u = Math.min(1, (t - dieAt) / 0.34);
    out.rx = u * 1.45;
    out.y = 0.06;
    out.rz = 0;
  } else if (t >= dieAt + 1.5) {
    out.y = -40;
    out.s = 0;
  }
}

export function labFoeAt(i: number, recT: number, out: New1Pose) {
  const t = Math.max(0, recT);
  const col = i % 3;
  const row = Math.floor(i / 3);
  const dieAt = 7.7 + i * 0.16;
  out.x = 11.2 + col * 1.15;
  out.z = 32.2 + row * 1.35;
  out.ry = Math.PI;
  out.rx = 0.08;
  out.rz = 0;
  out.y = 0;
  out.s = 1;
  if (t >= dieAt && t < dieAt + 1.4) {
    const u = Math.min(1, (t - dieAt) / 0.32);
    out.rx = u * 1.45;
    out.y = 0.06;
  } else if (t >= dieAt + 1.4) {
    out.y = -40;
    out.s = 0;
  }
}

export const LAB_DRAGON = { x: 1, z: 52, die: 17.4 };

export function labDragonFall(recT: number) {
  const t = Math.max(0, recT);
  if (t < LAB_DRAGON.die) return { u: 0, gone: false, flap: t };
  if (t < LAB_DRAGON.die + 1.6) return { u: Math.min(1, (t - LAB_DRAGON.die) / 0.45), gone: false, flap: t };
  return { u: 1, gone: true, flap: t };
}

export function labAlive(recT: number) {
  const t = Math.max(0, recT);
  let n = 0;
  for (let i = 0; i < LAB_N; i++) if (t < labDieAt(i)) n += 1;
  return n;
}

export function labLead(recT: number) {
  const t = Math.max(0, recT);
  let i = 0;
  while (i < LAB_N - 1 && t >= labDieAt(i)) i += 1;
  return place(i, t);
}

export function sampleLabCam(recT: number): ShotPose {
  const t = Math.max(0, recT);
  const lead = labLead(t);
  const rise = t <= 3 ? 0 : Math.min(1, (t - 3) / 4.2);
  const e = rise * rise * (3 - 2 * rise);
  let height = 11.5 + e * 16;
  let back = 6.4 + e * 3.2;
  let fov = 30 + e * 12;
  if (t > 12.4 && t < 18.2) {
    const k = Math.min(1, (t - 12.4) / 1.2);
    height = height * (1 - k) + 13.5 * k;
    back = back * (1 - k) + 8 * k;
    fov = fov * (1 - k) + 36 * k;
  }
  const fx = Math.sin(lead.ry);
  const fz = Math.cos(lead.ry);
  return {
    x: lead.x - fx * back,
    y: height,
    z: lead.z - fz * back,
    lx: lead.x + fx * 2.2,
    ly: 1.15,
    lz: lead.z + fz * 2.2,
    fov,
  };
}
