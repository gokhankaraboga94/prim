import { type ShotCtx, type ShotPose } from "./shotModes";

export const MIX1_ID = "mix1" as const;
export const MIX2_ID = "mix2" as const;
export const MIX6_ID = "mix6" as const;
export const MIX7_ID = "mix7" as const;
export type MixId = typeof MIX1_ID | typeof MIX2_ID | typeof MIX6_ID | typeof MIX7_ID;
export const MIX_MODES = [
  { id: MIX1_ID, label: "Mix 1" },
  { id: MIX2_ID, label: "Mix 2" },
  { id: MIX6_ID, label: "Mix 6" },
  { id: MIX7_ID, label: "Mix 7" },
] as const;
export const MIX_SECONDS = 15;

/** Army fills this so MixSplitCam can restack names before each pane render. */
export const mixTagPass = {
  apply(_pane: "top" | "bottom", _camX?: number) {},
};

export function isMix(id: string | null | undefined): id is MixId {
  return MIX_MODES.some((m) => m.id === id);
}

function pose(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): ShotPose {
  return { x, y: Math.max(3.4, y), z, lx, ly: Math.max(1.45, ly), lz, fov };
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

function lerpLinear(a: ShotPose, b: ShotPose, t: number): ShotPose {
  const u = clamp01(t);
  return pose(
    a.x + (b.x - a.x) * u,
    a.y + (b.y - a.y) * u,
    a.z + (b.z - a.z) * u,
    a.lx + (b.lx - a.lx) * u,
    a.ly + (b.ly - a.ly) * u,
    a.lz + (b.lz - a.lz) * u,
    a.fov + (b.fov - a.fov) * u
  );
}

function armyFitFov(camX: number, camY: number, camZ: number, lookX: number, lookY: number, lookZ: number, form: ShotCtx["form"]) {
  const dist = Math.hypot(camX - lookX, camY - lookY, camZ - lookZ);
  const half = form.width * 0.5 + 3.4;
  const deep = (form.back - form.front) * 0.5 + 3.2;
  const need = Math.max(half, deep) / Math.max(18, dist * 0.78);
  return Math.max(36, Math.min(50, (Math.atan(need) * 360) / Math.PI));
}

function armyCastleFitFov(
  camX: number,
  camY: number,
  camZ: number,
  lookX: number,
  lookY: number,
  lookZ: number,
  form: ShotCtx["form"],
  castle: ShotCtx["castle"]
) {
  const dist = Math.hypot(camX - lookX, camY - lookY, camZ - lookZ);
  const half = form.width * 0.5 + 4.6;
  const deep = Math.max((form.back - form.front) * 0.5 + 3.6, Math.abs(castle.front - form.back) * 0.34 + 7);
  const need = Math.max(half, deep) / Math.max(16, dist * 0.72);
  return Math.max(38, Math.min(50, (Math.atan(need) * 360) / Math.PI));
}

/** Mix 1 left 3/4, Mix 2 high left, Mix 6 high right, Mix 7 closer 3/4 + castle. Bottom 1/2/6 shared. */
export function sampleMixTop(_recT: number, ctx: ShotCtx, id: MixId = MIX1_ID): ShotPose {
  const { form, castle } = ctx;
  const lookZ = (castle.front + form.midZ) * 0.5;
  if (id === MIX7_ID) {
    const s = { x: -58, y: 22, z: form.back + 7, lx: 0, ly: 5.15, lz: lookZ };
    return pose(s.x, s.y, s.z, s.lx, s.ly, s.lz, armyCastleFitFov(s.x, s.y, s.z, s.lx, s.ly, s.lz, form, castle));
  }
  const shots: Record<Exclude<MixId, typeof MIX7_ID>, { x: number; y: number; z: number; lx: number; ly: number; lz: number }> = {
    mix1: { x: -100, y: 33, z: form.back + 16, lx: 0, ly: 5.8, lz: lookZ },
    mix2: { x: -64, y: 46, z: form.back + 34, lx: 0, ly: 3.8, lz: form.midZ },
    mix6: { x: 64, y: 46, z: form.back + 34, lx: 0, ly: 3.8, lz: form.midZ },
  };
  const s = shots[id];
  return pose(s.x, s.y, s.z, s.lx, s.ly, s.lz, armyFitFov(s.x, s.y, s.z, s.lx, s.ly, s.lz, form));
}

function behindLine(form: ShotCtx["form"], x: number): ShotPose {
  const span = Math.max(4.2, form.width * 0.5 - 1.1);
  const cx = Math.max(-span, Math.min(span, x));
  return pose(cx, 4.4, form.back + 10.4, cx * 1.04, 2.42, form.back - 1.8, 36);
}

function behindLineFar(form: ShotCtx["form"], x: number): ShotPose {
  const span = Math.max(4.2, form.width * 0.5 - 1.1);
  const cx = Math.max(-span, Math.min(span, x));
  return pose(cx, 9.4, form.back + 16.6, cx * 1.02, 2.12, form.front + 1.4, 34);
}

/** Behind the archers: Mix 7 is higher, further, slower. Others share the same crawl. */
export function sampleMixBottom(recT: number, ctx: ShotCtx, id: MixId = MIX1_ID): ShotPose {
  const { form } = ctx;
  const t = Math.max(0, recT);
  if (id === MIX7_ID) {
    const half = Math.max(3.2, form.width * 0.24);
    const center = behindLineFar(form, 0);
    const right = behindLineFar(form, half);
    const left = behindLineFar(form, -half);
    if (t < 7.5) return lerpLinear(center, right, t / 7.5);
    return lerpLinear(right, left, (t - 7.5) / 7.5);
  }
  const half = Math.max(4.2, form.width * 0.42);
  const center = behindLine(form, 0);
  const right = behindLine(form, half);
  const left = behindLine(form, -half);
  if (t < 6) return lerpLinear(center, right, t / 6);
  return lerpLinear(right, left, (t - 6) / 9);
}
