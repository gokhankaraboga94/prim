import { type ShotCtx, type ShotPose } from "./shotModes";

export const MIX1_ID = "mix1" as const;
export const MIX2_ID = "mix2" as const;
export const MIX3_ID = "mix3" as const;
export type MixId = typeof MIX1_ID | typeof MIX2_ID | typeof MIX3_ID;
export const MIX_MODES = [
  { id: MIX1_ID, label: "Mix 1" },
  { id: MIX2_ID, label: "Mix 2" },
  { id: MIX3_ID, label: "Mix 3" },
] as const;
export const MIX_SECONDS = 15;

export function isMix(id: string | null | undefined): id is MixId {
  return id === MIX1_ID || id === MIX2_ID || id === MIX3_ID;
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

/** Mix 1 left 3/4, Mix 2 high rear diagonal, Mix 3 right 3/4. Bottom sweep is shared. */
export function sampleMixTop(_recT: number, ctx: ShotCtx, id: MixId = MIX1_ID): ShotPose {
  const { form, castle } = ctx;
  const lookZ = (castle.front + form.midZ) * 0.5;
  if (id === MIX2_ID) {
    const x = -64;
    const y = 46;
    const z = form.back + 34;
    const lx = 0;
    const ly = 3.8;
    const lz = form.midZ;
    return pose(x, y, z, lx, ly, lz, armyFitFov(x, y, z, lx, ly, lz, form));
  }
  if (id === MIX3_ID) {
    const x = 100;
    const y = 33;
    const z = form.back + 16;
    const lx = 0;
    const ly = 5.8;
    const lz = lookZ;
    return pose(x, y, z, lx, ly, lz, armyFitFov(x, y, z, lx, ly, lz, form));
  }
  const x = -100;
  const y = 33;
  const z = form.back + 16;
  const lx = 0;
  const ly = 5.8;
  const lz = lookZ;
  return pose(x, y, z, lx, ly, lz, armyFitFov(x, y, z, lx, ly, lz, form));
}

function behindLine(form: ShotCtx["form"], x: number): ShotPose {
  const span = Math.max(4.2, form.width * 0.5 - 1.1);
  const cx = Math.max(-span, Math.min(span, x));
  return pose(cx, 4.4, form.back + 10.4, cx * 1.04, 2.42, form.back - 1.8, 36);
}

/** Behind the archers: slow constant crawl, center → right → left. */
export function sampleMixBottom(recT: number, ctx: ShotCtx): ShotPose {
  const { form } = ctx;
  const half = Math.max(4.2, form.width * 0.42);
  const t = Math.max(0, recT);
  const center = behindLine(form, 0);
  const right = behindLine(form, half);
  const left = behindLine(form, -half);
  if (t < 6) return lerpLinear(center, right, t / 6);
  return lerpLinear(right, left, (t - 6) / 9);
}
