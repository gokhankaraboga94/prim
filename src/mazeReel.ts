import type { ShotPose } from "./shotModes";
import type { New1Pose } from "./new1Reel";

export const LAB_ID = "labirent1" as const;
export type LabId = typeof LAB_ID;
export const LAB_MODE = { id: LAB_ID, label: "labirent1" } as const;

export function isLab(id: string | null | undefined): id is LabId {
  return id === LAB_ID;
}

export const LAB_SECONDS = 60;

const LANES = 3;
const GAP = 1.28;
const HEAD0 = -8;

type Pt = [number, number];
type Seg = { x1: number; z1: number; x2: number; z2: number; half: number };

const ENTRANCE: Pt[] = [
  [0, -16],
  [0, 0],
  [0, 18],
];
const DEAD: Pt[][] = [
  [[0, 18], [-16, 18], [-16, 34]],
  [[0, 18], [16, 18], [16, 4]],
  [[0, 18], [0, 34], [-14, 34], [-14, 48]],
  [[0, 18], [14, 30], [14, 46], [28, 46]],
  [[0, 18], [-12, 26], [-26, 26], [-26, 40]],
];
const FIGHT: Pt[] = [
  [0, 18],
  [10, 18],
  [10, 34],
  [24, 34],
  [24, 50],
  [12, 50],
  [12, 68],
  [12, 84],
];

function polyLen(pts: Pt[]) {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return n;
}

const SPLIT = polyLen(ENTRANCE);
const DEAD_LEN = DEAD.map(polyLen);
const FIGHT_LEN = polyLen(FIGHT);

function pairs(pts: Pt[], half: number): Seg[] {
  const out: Seg[] = [];
  for (let i = 1; i < pts.length; i++) out.push({ x1: pts[i - 1][0], z1: pts[i - 1][1], x2: pts[i][0], z2: pts[i][1], half });
  return out;
}

export const LAB_SEGMENTS: Seg[] = [
  ...pairs(ENTRANCE, 2.55),
  ...DEAD.flatMap((pts) => pairs(pts, 1.28)),
  ...pairs(FIGHT, 1.72),
];

function sample(pts: Pt[], dist: number) {
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

function speedOf(n: number) {
  const count = Math.max(1, n);
  const back = Math.floor((count - 1) / LANES) * GAP;
  const raw = (SPLIT + FIGHT_LEN + back - HEAD0) / 56;
  return Math.max(2.4, Math.min(7.6, raw));
}

type Plan = { die: Float64Array; kind: Uint8Array };

const plans = new Map<number, Plan>();

function planOf(n: number): Plan {
  const count = Math.max(1, n);
  const hit = plans.get(count);
  if (hit) return hit;
  const liveN = Math.max(4, Math.min(7, Math.round(count * 0.02)));
  const fightN = Math.max(liveN, Math.round(count * 0.16));
  const deadN = Math.max(0, count - fightN - liveN);
  const speed = speedOf(count);
  const die = new Float64Array(count);
  const kind = new Uint8Array(count);
  const pockets = [polyLen(FIGHT.slice(0, 3)), polyLen(FIGHT.slice(0, 5)), polyLen(FIGHT.slice(0, 7))];
  let fightSeen = 0;
  for (let i = 0; i < count; i++) {
    const back = Math.floor(i / LANES) * GAP;
    if (i < deadN) {
      kind[i] = i % DEAD.length;
      const dist = SPLIT + DEAD_LEN[kind[i]] - 0.7;
      die[i] = (dist + back - HEAD0) / speed;
    } else if (i < deadN + fightN) {
      kind[i] = 5;
      const pocket = fightSeen % 3;
      fightSeen += 1;
      const dist = SPLIT + pockets[pocket] - 0.4;
      die[i] = (dist + back - HEAD0) / speed;
    } else {
      kind[i] = 6;
      die[i] = 1e9;
    }
  }
  const plan = { die, kind };
  plans.set(count, plan);
  return plan;
}

function poseAt(i: number, n: number, t: number) {
  const plan = planOf(n);
  const moving = Math.min(Math.max(0, t), plan.die[i] ?? 1e9);
  const along = HEAD0 + speedOf(n) * moving - Math.floor(i / LANES) * GAP;
  const kind = plan.kind[i] ?? 0;
  let pose = sample(ENTRANCE, along);
  if (along > SPLIT) {
    if (kind < DEAD.length) pose = sample(DEAD[kind], along - SPLIT);
    else pose = sample(FIGHT, along - SPLIT);
  }
  const narrow = kind < DEAD.length;
  const lane = (i % LANES) - (LANES - 1) / 2;
  const span = narrow ? 0.42 : 0.72;
  const rx = Math.cos(pose.ry);
  const rz = -Math.sin(pose.ry);
  return { x: pose.x + rx * lane * span, z: pose.z + rz * lane * span, ry: pose.ry };
}

export function labAlive(recT: number, soldiers: number) {
  const n = Math.max(1, Math.floor(soldiers));
  const plan = planOf(n);
  const t = Math.max(0, recT);
  let alive = 0;
  for (let i = 0; i < n; i++) if (t < plan.die[i]) alive += 1;
  return alive;
}

export function labFriendAt(i: number, n: number, recT: number, out: New1Pose) {
  const count = Math.max(1, Math.floor(n));
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
  const dieAt = planOf(count).die[i];
  const p = poseAt(i, count, t);
  const bob = Math.sin(t * 10 + i * 0.7);
  out.x = p.x;
  out.z = p.z;
  out.ry = p.ry;
  out.rz = 0;
  out.y = t < dieAt ? Math.abs(bob) * 0.045 : 0;
  out.rx = t < dieAt ? 0.26 + bob * 0.05 : 0;
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

const FOE_POCKETS = [polyLen(FIGHT.slice(0, 3)), polyLen(FIGHT.slice(0, 5)), polyLen(FIGHT.slice(0, 7))];
export const LAB_FOES = FOE_POCKETS.length * 6;

export function labFoeAt(i: number, recT: number, soldiers: number, out: New1Pose) {
  const t = Math.max(0, recT);
  const pocket = Math.floor(i / 6);
  const slot = i % 6;
  const col = slot % 3;
  const row = Math.floor(slot / 3);
  const at = sample(FIGHT, FOE_POCKETS[pocket] - 1.1 - row * 1.25);
  const rx = Math.cos(at.ry);
  const rz = -Math.sin(at.ry);
  const lane = col - 1;
  out.x = at.x + rx * lane * 0.78;
  out.z = at.z + rz * lane * 0.78;
  out.ry = at.ry + Math.PI;
  out.rx = 0.08;
  out.rz = 0;
  out.y = 0;
  out.s = 1;
  const n = Math.max(1, Math.floor(soldiers));
  const speed = speedOf(n);
  const dist = SPLIT + FOE_POCKETS[pocket] - 0.2;
  const dieAt = (dist - HEAD0) / speed + slot * 0.12;
  if (t >= dieAt && t < dieAt + 1.35) {
    const u = Math.min(1, (t - dieAt) / 0.3);
    out.rx = u * 1.45;
    out.y = 0.05;
  } else if (t >= dieAt + 1.35) {
    out.y = -40;
    out.s = 0;
  }
}

export function labLead(recT: number, soldiers: number) {
  const n = Math.max(1, Math.floor(soldiers));
  const plan = planOf(n);
  const t = Math.max(0, recT);
  let best = 0;
  for (let i = 0; i < n; i++) {
    if (plan.kind[i] >= 5 && t < plan.die[i]) {
      best = i;
      break;
    }
  }
  return poseAt(best, n, t);
}

export function sampleLabCam(recT: number, soldiers = 36): ShotPose {
  const t = Math.max(0, recT);
  const wide = t <= 9 ? 0 : Math.min(1, (t - 9) / 8);
  const e = wide * wide * (3 - 2 * wide);
  const lead = labLead(t, soldiers);
  const mouth = sample(ENTRANCE, SPLIT * 0.45);
  const lookX = mouth.x * (1 - e) + lead.x * e;
  const lookZ = mouth.z * (1 - e) + lead.z * e;
  const height = 46 - e * 18;
  const back = 34 - e * 16;
  const ry = e > 0.2 ? lead.ry : 0;
  const fx = Math.sin(ry);
  const fz = Math.cos(ry);
  return {
    x: lookX - fx * back,
    y: height,
    z: lookZ - fz * back - (1 - e) * 8,
    lx: lookX + fx * 3,
    ly: 1.2,
    lz: lookZ + fz * 3,
    fov: 48 - e * 8,
  };
}
