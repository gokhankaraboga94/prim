import type { ShotCtx, ShotPose } from "./shotModes";

export const KAYIT_ID = "kayit" as const;
export type KayitId = typeof KAYIT_ID;
export const KAYIT_MODE = { id: KAYIT_ID, label: "kayıt" } as const;
export const KAYIT_SECONDS = 15;
/** Green field big enough that the high pull-back stays inside the grass. */
export const KAYIT_FIELD = 36000;

export function isKayit(id: string | null | undefined): id is KayitId {
  return id === KAYIT_ID;
}

function ease(u: number) {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
}

function mixPose(a: ShotPose, b: ShotPose, u: number): ShotPose {
  const t = ease(u);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    lx: a.lx + (b.lx - a.lx) * t,
    ly: a.ly + (b.ly - a.ly) * t,
    lz: a.lz + (b.lz - a.lz) * t,
    fov: a.fov + (b.fov - a.fov) * t,
  };
}

/** Front-rank width that reads as about thirty soldiers in a 9:16 frame. */
function openPose(ctx: ShotCtx, aspect: number): ShotPose {
  const aspectClamped = Math.max(0.35, aspect);
  const want = Math.min(21, Math.max(10, ctx.form.width * 1.08));
  const gap = Math.max(14, ctx.form.front - ctx.castle.front - 7.5);
  let fov = 60;
  let dist = want / 2 / Math.max(0.08, Math.tan((fov * Math.PI) / 360) * aspectClamped);
  if (dist > gap) {
    dist = gap;
    const tanV = want / 2 / dist / aspectClamped;
    fov = Math.min(66, (Math.atan(tanV) * 360) / Math.PI);
  }
  const depth = Math.max(0, ctx.form.back - ctx.form.front);
  return {
    x: 0,
    y: 5.6,
    z: ctx.form.front - dist,
    lx: 0,
    ly: 3.05,
    lz: ctx.form.front + Math.min(4.4, depth * 0.55),
    fov,
  };
}

function widePose(ctx: ShotCtx, aspect: number, distMul: number): ShotPose {
  const aspectClamped = Math.max(0.35, aspect);
  const depth = Math.max(8, ctx.form.back - ctx.form.front);
  const rows = Math.max(1, Math.round(depth / 2.55) + 1);
  const nameTop = (2.5 + Math.max(0, rows - 1) * 1.22) * 1.28;
  const fov = 50;
  const hHalf = Math.tan((fov * Math.PI) / 360) * aspectClamped;
  const half = Math.max(ctx.form.width, depth, nameTop) * 0.62;
  const dist = Math.max(24, half / Math.max(0.08, hHalf)) * distMul;
  return {
    x: 0,
    y: nameTop + dist,
    z: ctx.form.midZ + dist * 0.2,
    lx: 0,
    ly: nameTop * 0.22,
    lz: ctx.form.midZ,
    fov,
  };
}

function castlePose(ctx: ShotCtx): ShotPose {
  const fov = 46;
  const ly = ctx.castle.midY * 0.4;
  const lz = ctx.castle.midZ;
  const z = ctx.castle.front + 14;
  const y = ctx.castle.midY + ctx.castle.height * 0.85;
  return { x: 0, y, z, lx: 0, ly, lz, fov };
}

export function sampleKayitCam(t: number, ctx: ShotCtx, aspect = 1080 / 1920): ShotPose {
  const open = openPose(ctx, aspect);
  const wide = widePose(ctx, aspect, 1);
  const castle = castlePose(ctx);
  const back = widePose(ctx, aspect, 1);
  if (t <= 3.2) return open;
  if (t <= 6.6) return mixPose(open, wide, (t - 3.2) / 3.4);
  if (t <= 7.3) return wide;
  if (t <= 9.2) return mixPose(wide, castle, (t - 7.3) / 1.9);
  if (t <= 12.2) return castle;
  if (t <= 14.2) return mixPose(castle, back, (t - 12.2) / 2);
  return back;
}
