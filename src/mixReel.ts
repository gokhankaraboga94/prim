import { type ShotCtx, type ShotPose } from "./shotModes";

export const MIX_ID = "mix" as const;
export type MixId = typeof MIX_ID;
export const MIX_MODE = { id: MIX_ID, label: "Mix" } as const;
export const MIX_SECONDS = 15;

export function isMix(id: string | null | undefined): id is MixId {
  return id === MIX_ID;
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

/** Closer 3/4: castle stays the same mass, army reads diagonal so every rank fits. */
export function sampleMixTop(_recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle } = ctx;
  const lookZ = castle.front + (form.front - castle.front) * 0.22;
  return pose(-78, 26, form.back + 9, 2.2, 5.6, lookZ, 36);
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
