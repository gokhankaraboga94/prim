import { lerpPose, type ShotCtx, type ShotPose } from "./shotModes";

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

function ease(u: number) {
  const x = clamp01(u);
  return x * x * (3 - 2 * x);
}

/** Side castle: higher and further so the full army sits on the right. */
export function sampleMixTop(_recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle } = ctx;
  const midZ = (castle.front + form.midZ) * 0.5;
  return pose(-68, 24, form.midZ - 6, 0, 4.1, midZ + 2, 36);
}

function behindLine(form: ShotCtx["form"], x: number): ShotPose {
  const span = Math.max(4.2, form.width * 0.5 - 1.1);
  const cx = Math.max(-span, Math.min(span, x));
  return pose(cx, 4.4, form.back + 10.4, cx * 1.04, 2.42, form.back - 1.8, 36);
}

/** Behind the archers: center → right → center → left over 15s. */
export function sampleMixBottom(recT: number, ctx: ShotCtx): ShotPose {
  const { form } = ctx;
  const half = Math.max(4.2, form.width * 0.5 - 1.1);
  const t = Math.max(0, recT);
  const center = behindLine(form, 0);
  const right = behindLine(form, half);
  const left = behindLine(form, -half);
  if (t < 5) return lerpPose(center, right, ease(t / 5));
  if (t < 8) return lerpPose(right, center, ease((t - 5) / 3));
  return lerpPose(center, left, ease((t - 8) / 7));
}
