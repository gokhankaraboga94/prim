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

/** Side castle: army-facing wall left, volley on the right. Static hold. */
export function sampleMixTop(_recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle } = ctx;
  const gapZ = (castle.front + form.front) * 0.5;
  return pose(-42, 10.6, gapZ - 1.2, 8.5, Math.max(3.4, castle.midY * 0.14), gapZ + 2.4, 30);
}

function behindLine(form: ShotCtx["form"], x: number): ShotPose {
  const span = Math.max(4.2, form.width * 0.5 - 1.1);
  const cx = Math.max(-span, Math.min(span, x));
  return pose(cx, 3.62, form.back + 6.5, cx * 1.08, 1.78, form.back - 0.85, 34);
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
