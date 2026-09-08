import { normalizeHandle } from "./game";
import { lerpPose, type ShotCtx, type ShotPose } from "./shotModes";

export const ROSTER_ID = "isimavi" as const;
export const HOOK_ID = "kanca" as const;
export type PlanBId = typeof ROSTER_ID | typeof HOOK_ID;

export const ROSTER_PACK = 5;
export const ROSTER_STAGE_Z = 36.2;

export const ROSTER_MODE = { id: ROSTER_ID, label: "İsim avı" } as const;
export const HOOK_MODE = { id: HOOK_ID, label: "Kanca 15s" } as const;

export function isPlanB(id: string | null | undefined): id is PlanBId {
  return id === ROSTER_ID || id === HOOK_ID;
}

export function rosterSoldierIds(names: string[], soldiers: number): number[] {
  const cap = Math.max(0, Math.floor(soldiers));
  const ids: number[] = [];
  for (let i = 0; i < cap && i < names.length; i++) {
    if (normalizeHandle(names[i])) ids.push(i);
  }
  return ids;
}

export function rosterDuration(kind: PlanBId, named: number): number {
  if (kind === HOOK_ID) return 15;
  const packs = Math.max(1, Math.ceil(Math.max(1, named) / ROSTER_PACK));
  const raw = 2.2 + 3.35 + packs * 3.05 + 2.55;
  return raw <= 33 ? 30 : 45;
}

function pose(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): ShotPose {
  return { x, y, z, lx, ly, lz, fov };
}

export type RosterBeat =
  | { id: "hook" }
  | { id: "overview" }
  | { id: "pack"; pack: number; packs: number; ids: number[] }
  | { id: "cta" };

export function rosterTimeline(kind: PlanBId, named: number, duration: number) {
  const allPacks = Math.max(1, Math.ceil(Math.max(1, named) / ROSTER_PACK));
  const packs = kind === HOOK_ID ? Math.min(3, allPacks) : allPacks;
  const hook = kind === HOOK_ID ? 2.05 : 2.2;
  const overview = kind === HOOK_ID ? 2.35 : 3.35;
  const cta = kind === HOOK_ID ? 2.2 : 2.55;
  const hold = Math.max(2.35, (duration - hook - overview - cta) / packs);
  return { hook, overview, cta, packs, hold, packStart: hook + overview, ctaAt: duration - cta };
}

export function rosterBeat(kind: PlanBId, recT: number, duration: number, ids: number[]): RosterBeat {
  const tl = rosterTimeline(kind, ids.length, duration);
  const t = Math.max(0, recT);
  if (t < tl.hook) return { id: "hook" };
  if (t < tl.packStart) return { id: "overview" };
  if (t >= tl.ctaAt) return { id: "cta" };
  const pack = Math.min(tl.packs - 1, Math.floor((t - tl.packStart) / Math.max(0.08, tl.hold)));
  const shown = kind === HOOK_ID ? ids.slice(0, tl.packs * ROSTER_PACK) : ids;
  const start = pack * ROSTER_PACK;
  return { id: "pack", pack, packs: tl.packs, ids: shown.slice(start, start + ROSTER_PACK) };
}

export function sampleRoster(
  kind: PlanBId,
  recT: number,
  duration: number,
  ctx: ShotCtx,
  ids: number[]
): ShotPose {
  const beat = rosterBeat(kind, recT, duration, ids);
  const { form } = ctx;
  const overview = pose(1.4, 56, form.midZ + 7, 0, 0.55, form.midZ, 50);
  const overviewIn = pose(0.8, 44, form.midZ + 10, 0, 0.95, form.midZ, 46);
  const packCam = pose(0, 2.58, ROSTER_STAGE_Z + 7.6, 0, 1.52, ROSTER_STAGE_Z, 26);
  const tl = rosterTimeline(kind, ids.length, duration);
  if (beat.id === "hook") return overview;
  if (beat.id === "overview") {
    const u = Math.max(0, Math.min(1, (recT - tl.hook) / Math.max(0.2, tl.overview)));
    return lerpPose(overview, overviewIn, u);
  }
  if (beat.id === "cta") return lerpPose(packCam, overviewIn, 0.42);
  return packCam;
}

export function rosterStageSlot(i: number, n: number, out: { x: number; y: number; z: number }) {
  const gap = 2.28;
  out.x = (i - (Math.max(1, n) - 1) / 2) * gap;
  out.y = 0;
  out.z = ROSTER_STAGE_Z;
}
