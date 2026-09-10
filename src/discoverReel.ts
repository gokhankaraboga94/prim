import { frontWalk } from "./castleLayout";
import { lerpPose, type ShotCtx, type ShotPose } from "./shotModes";

export const DISCOVER_ID = "kesfet" as const;
export const DISCOVER2_ID = "kesfet2" as const;
export const DISCOVER3_ID = "kesfet3" as const;
export type DiscoverId = typeof DISCOVER_ID | typeof DISCOVER2_ID | typeof DISCOVER3_ID;
export const DISCOVER_MODE = { id: DISCOVER_ID, label: "Keşfet 15s" } as const;
export const DISCOVER2_MODE = { id: DISCOVER2_ID, label: "Keşfet 2" } as const;
export const DISCOVER3_MODE = { id: DISCOVER3_ID, label: "Keşfet 3" } as const;
export const DISCOVER_SECONDS = 15;
export const DISCOVER3_SECONDS = 40;

export function isDiscover(id: string | null | undefined): id is DiscoverId {
  return id === DISCOVER_ID || id === DISCOVER2_ID || id === DISCOVER3_ID;
}

export function isDiscoverEngage(id: string | null | undefined) {
  return id === DISCOVER2_ID;
}

export function isDiscoverTrailer(id: string | null | undefined): id is typeof DISCOVER3_ID {
  return id === DISCOVER3_ID;
}

export type DiscoverBeat = "hook" | "proof" | "hold" | "storm" | "next" | "loop";

export const DISCOVER_HOOK_END = 2.45;
export const DISCOVER_PROOF_END = 6.45;

function pose(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): ShotPose {
  return { x, y: Math.max(3.4, y), z, lx, ly: Math.max(1.45, ly), lz, fov };
}

function hookPose(form: ShotCtx["form"], castle: ShotCtx["castle"]): ShotPose {
  return pose(2.15, 3.55, form.front + 4.15, 0.08, 2.68, castle.front + 5.2, 34);
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

function armyWidePose(form: ShotCtx["form"]): ShotPose {
  const camX = 6.1;
  const camY = 24.2;
  const camZ = form.back + 52;
  const lookX = 0;
  const lookY = 2.45;
  const lookZ = form.midZ;
  const dist = Math.hypot(camX - lookX, camY - lookY, camZ - lookZ);
  const half = form.width * 0.5 + 3.1;
  const hHalf = half / Math.max(20, dist * 0.9);
  const vHalf = hHalf / (9 / 16);
  const fov = Math.max(50, Math.min(62, (Math.atan(vHalf) * 360) / Math.PI));
  return pose(camX, camY, camZ, lookX, lookY, lookZ, fov);
}

export function discoverGateRecT(id?: DiscoverId | null) {
  if (id === DISCOVER3_ID) return 22.4;
  return 8.55;
}

export type TrailerBeat = "title" | "army" | "volley" | "wall" | "gate" | "fight" | "cta";

export function trailerBeat(recT: number): TrailerBeat {
  const t = Math.max(0, recT);
  if (t < 3.2) return "title";
  if (t < 8.4) return "army";
  if (t < 13.6) return "volley";
  if (t < 19.2) return "wall";
  if (t < 25) return "gate";
  if (t < 32.4) return "fight";
  return "cta";
}

function sampleTrailer(recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle } = ctx;
  const walk = frontWalk(ctx.level ?? 1);
  const mid = (form.front + castle.front) * 0.52;
  const wy = walk.y;
  const wz = walk.z;
  const wx = walk.leftX;
  const titleA = pose(9.2, Math.max(18, castle.midY * 0.48), castle.front + 48, 0.15, castle.midY * 0.52, castle.midZ + 5, 36);
  const titleB = pose(4.8, Math.max(14, castle.midY * 0.38), castle.front + 32, 0.08, castle.midY * 0.4, castle.front + 3, 34);
  const army = armyWidePose(form);
  const volleyA = pose(8.4, 4.4, form.back + 6.2, -0.6, 1.95, form.midZ, 38);
  const volleyB = pose(2.2, 3.55, form.front + 3.1, 0.04, 2.35, castle.front + 5, 34);
  const wallA = pose(wx - 5.2, wy + 1.48, wz + 0.5, wx + 7.4, wy + 1.2, wz + 0.22, 28);
  const wallB = pose(wx - 0.8, wy + 1.56, wz + 0.68, 0.4, wy * 0.12, form.front + 3, 30);
  const gateA = pose(1.8, 4.8, castle.front + 22, 0.12, 3.05, castle.front + 1.2, 38);
  const gateB = pose(6.2, 4.1, castle.front + 28, 0.2, 2.4, mid, 40);
  const fightA = pose(14.2, 5.4, form.front - 2.4, -2.1, 1.9, form.front - 6, 36);
  const fightB = pose(8.1, 8.2, form.midZ + 8, 0, 2.25, castle.front + 4, 42);
  const cta = pose(11.2, 19.5, form.back + 22, 0, 4.2, mid, 44);
  const t = Math.max(0, recT);
  const cuts: { at: number; dur: number; a: ShotPose; b: ShotPose }[] = [
    { at: 0, dur: 3.2, a: titleA, b: titleB },
    { at: 3.2, dur: 5.2, a: titleB, b: army },
    { at: 8.4, dur: 5.2, a: volleyA, b: volleyB },
    { at: 13.6, dur: 5.6, a: wallA, b: wallB },
    { at: 19.2, dur: 5.8, a: gateA, b: gateB },
    { at: 25, dur: 7.4, a: fightA, b: fightB },
    { at: 32.4, dur: 7.6, a: fightB, b: cta },
  ];
  let cut = cuts[0];
  for (let i = 0; i < cuts.length; i++) {
    if (t >= cuts[i].at) cut = cuts[i];
  }
  return lerpPose(cut.a, cut.b, clamp01((t - cut.at) / Math.max(0.08, cut.dur)));
}

export function discoverBeat(recT: number): DiscoverBeat {
  const t = Math.max(0, recT);
  if (t < DISCOVER_HOOK_END) return "hook";
  if (t < DISCOVER_PROOF_END) return "proof";
  if (t < 8.55) return "hold";
  if (t < 11.7) return "storm";
  if (t < 13.25) return "next";
  return "loop";
}

export function sampleDiscover(recT: number, ctx: ShotCtx, id?: DiscoverId | null): ShotPose {
  if (id === DISCOVER3_ID) return sampleTrailer(recT, ctx);
  const { form, castle } = ctx;
  const mid = (form.front + castle.front) * 0.52;
  const hook = hookPose(form, castle);
  const hookPush = pose(1.35, 3.72, form.front + 2.55, 0.04, 2.42, castle.front + 3.1, 32);
  const proof = armyWidePose(form);
  const hold = pose(10.6, 4.35, form.midZ + 5.2, -1.6, 1.85, form.front + 1, 36);
  const storm = pose(4.2, 4.7, castle.front + 19, 0.15, 2.55, mid, 38);
  const t = Math.max(0, recT);
  const pullEnd = DISCOVER_HOOK_END + 1.65;
  if (t >= 14.82) return hook;
  if (t < DISCOVER_HOOK_END) return lerpPose(hook, hookPush, clamp01(t / DISCOVER_HOOK_END));
  if (t < pullEnd) return lerpPose(hookPush, proof, clamp01((t - DISCOVER_HOOK_END) / (pullEnd - DISCOVER_HOOK_END)));
  if (t < DISCOVER_PROOF_END) return proof;
  if (t < 8.55) return lerpPose(proof, hold, clamp01((t - DISCOVER_PROOF_END) / (8.55 - DISCOVER_PROOF_END)));
  if (t < 13.15) return lerpPose(hold, storm, clamp01((t - 8.55) / 4.6));
  const u = clamp01((t - 13.15) / 1.67);
  return lerpPose(storm, hook, u * u);
}
