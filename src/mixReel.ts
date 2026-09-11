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

/** Side castle: behind the last rank, far and high, looking at the gate. */
export function sampleMixTop(_recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle } = ctx;
  return pose(-86, 30, form.back + 12, 0, 5.2, castle.front + 5, 38);
}

function behindLine(form: ShotCtx["form"], x: number): ShotPose {
  const span = Math.max(4.2, form.width * 0.5 - 1.1);
  const cx = Math.max(-span, Math.min(span, x));
  return pose(cx, 4.4, form.back + 10.4, cx * 1.04, 2.42, form.back - 1.8, 36);
}

/** Behind the archers: center → right → center → left, slow crawl. */
export function sampleMixBottom(recT: number, ctx: ShotCtx): ShotPose {
  const { form } = ctx;
  const half = Math.max(4.2, form.width * 0.5 - 1.1);
  const t = Math.max(0, recT);
  const center = behindLine(form, 0);
  const right = behindLine(form, half);
  const left = behindLine(form, -half);
  if (t < 7) return lerpPose(center, right, ease(t / 7));
  if (t < 10.4) return lerpPose(right, center, ease((t - 7) / 3.4));
  return lerpPose(center, left, ease((t - 10.4) / 4.6));
}
