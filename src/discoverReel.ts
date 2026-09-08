import { lerpPose, type ShotCtx, type ShotPose } from "./shotModes";

export const DISCOVER_ID = "kesfet" as const;
export type DiscoverId = typeof DISCOVER_ID;
export const DISCOVER_MODE = { id: DISCOVER_ID, label: "Keşfet 15s" } as const;
export const DISCOVER_SECONDS = 15;

export function isDiscover(id: string | null | undefined): id is DiscoverId {
  return id === DISCOVER_ID;
}

export type DiscoverBeat = "hook" | "proof" | "hold" | "storm" | "next" | "loop";

function pose(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): ShotPose {
  return { x, y: Math.max(3.4, y), z, lx, ly: Math.max(1.45, ly), lz, fov };
}

function hookPose(form: ShotCtx["form"], castle: ShotCtx["castle"]): ShotPose {
  return pose(2.15, 3.55, form.front + 4.15, 0.08, 2.68, castle.front + 5.2, 34);
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

export function discoverGateRecT() {
  return 8.55;
}

export function discoverBeat(recT: number): DiscoverBeat {
  const t = Math.max(0, recT);
  if (t < 2.95) return "hook";
  if (t < 5.45) return "proof";
  if (t < 8.55) return "hold";
  if (t < 11.7) return "storm";
  if (t < 13.25) return "next";
  return "loop";
}

export function sampleDiscover(recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle } = ctx;
  const mid = (form.front + castle.front) * 0.52;
  const hook = hookPose(form, castle);
  const hookPush = pose(1.35, 3.72, form.front + 2.55, 0.04, 2.42, castle.front + 3.1, 32);
  const proof = pose(2.2, 16.2, form.back + 26, 0, 2.35, form.midZ - 2, 48);
  const hold = pose(10.6, 4.35, form.midZ + 5.2, -1.6, 1.85, form.front + 1, 36);
  const storm = pose(4.2, 4.7, castle.front + 19, 0.15, 2.55, mid, 38);
  const t = Math.max(0, recT);
  if (t >= 14.82) return hook;
  if (t < 2.95) return lerpPose(hook, hookPush, clamp01(t / 2.95));
  if (t < 5.45) return lerpPose(hookPush, proof, clamp01((t - 2.95) / 2.5));
  if (t < 8.55) return lerpPose(proof, hold, clamp01((t - 5.45) / 3.1));
  if (t < 13.15) return lerpPose(hold, storm, clamp01((t - 8.55) / 4.6));
  const u = clamp01((t - 13.15) / 1.67);
  return lerpPose(storm, hook, u * u);
}
