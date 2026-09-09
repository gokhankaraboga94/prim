import { normalizeHandle } from "./game";
import { lerpPose, type ShotCtx, type ShotPose } from "./shotModes";

export const ROSTER_ID = "isimavi" as const;
export const HOOK_ID = "kanca" as const;
export const JOIN_ID = "katilan" as const;
export type PlanBId = typeof ROSTER_ID | typeof HOOK_ID | typeof JOIN_ID;

export const ROSTER_PACK = 5;
export const ROSTER_STAGE_Z = 36.2;
const CROSS = 0.44;
const JOIN_MARK_KEY = "wars.joinMark.v1";

export const ROSTER_MODE = { id: ROSTER_ID, label: "İsim avı" } as const;
export const HOOK_MODE = { id: HOOK_ID, label: "Kanca 15s" } as const;
export const JOIN_MODE = { id: JOIN_ID, label: "Yeni katılanlar" } as const;

export function isPlanB(id: string | null | undefined): id is PlanBId {
  return id === ROSTER_ID || id === HOOK_ID || id === JOIN_ID;
}

export function isJoin(id: string | null | undefined): id is typeof JOIN_ID {
  return id === JOIN_ID;
}

export function rosterSoldierIds(names: string[], soldiers: number): number[] {
  const cap = Math.max(0, Math.floor(soldiers));
  const ids: number[] = [];
  for (let i = 0; i < cap && i < names.length; i++) {
    if (normalizeHandle(names[i])) ids.push(i);
  }
  return ids;
}

export function rosterPackSize(kind: PlanBId, named: number) {
  if (kind !== JOIN_ID) return ROSTER_PACK;
  const n = Math.max(0, named);
  if (n <= 4) return 2;
  if (n <= 9) return 3;
  return 5;
}

export function rosterDuration(kind: PlanBId, named: number): number {
  if (kind === HOOK_ID) return 15;
  const size = rosterPackSize(kind, named);
  const packs = Math.max(1, Math.ceil(Math.max(1, named) / size));
  if (kind === JOIN_ID) {
    const raw = 1.65 + 2.05 + packs * 2.25 + 1.9;
    return Math.min(20, Math.max(10, Math.round(raw)));
  }
  const raw = 2.1 + 2.4 + packs * 3.15 + 3.05;
  return raw <= 34 ? 30 : 45;
}

export function loadJoinMark(): string[] {
  try {
    const raw = localStorage.getItem(JOIN_MARK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeHandle(String(item || ""))).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveJoinMark(names: string[], soldiers: number) {
  const handles = rosterSoldierIds(names, soldiers).map((i) => normalizeHandle(names[i])).filter(Boolean);
  try {
    localStorage.setItem(JOIN_MARK_KEY, JSON.stringify(handles));
  } catch {
    /* ignore */
  }
}

export function ensureJoinMark(names: string[], soldiers: number) {
  try {
    if (localStorage.getItem(JOIN_MARK_KEY) == null) saveJoinMark(names, soldiers);
  } catch {
    /* ignore */
  }
}

export function joinSoldierIds(names: string[], soldiers: number, marked = loadJoinMark()): number[] {
  const seen = new Set(marked.map((n) => n.toLowerCase()));
  return rosterSoldierIds(names, soldiers).filter((i) => !seen.has(normalizeHandle(names[i]).toLowerCase()));
}

function pose(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): ShotPose {
  return { x, y, z, lx, ly, lz, fov };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

function easeOutCubic(t: number) {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

function lerpPoseU(a: ShotPose, b: ShotPose, t: number): ShotPose {
  const u = clamp01(t);
  return pose(
    lerp(a.x, b.x, u),
    lerp(a.y, b.y, u),
    lerp(a.z, b.z, u),
    lerp(a.lx, b.lx, u),
    lerp(a.ly, b.ly, u),
    lerp(a.lz, b.lz, u),
    lerp(a.fov, b.fov, u)
  );
}

export type RosterBeat =
  | { id: "hook" }
  | { id: "overview" }
  | {
      id: "pack";
      pack: number;
      packs: number;
      ids: number[];
      outgoing: number[];
      u: number;
      enter: number;
      exit: number;
    }
  | { id: "cta" };

export type RosterPose = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  scaleMul: number;
  nameMul: number;
};

export function rosterTimeline(kind: PlanBId, named: number, duration: number) {
  const size = rosterPackSize(kind, named);
  const allPacks = Math.max(1, Math.ceil(Math.max(1, named) / size));
  const packs = kind === HOOK_ID ? Math.min(3, allPacks) : allPacks;
  const hook = kind === JOIN_ID ? 1.65 : kind === HOOK_ID ? 1.85 : 2.1;
  const overview = kind === JOIN_ID ? 2.05 : kind === HOOK_ID ? 1.95 : 2.4;
  const cta = kind === JOIN_ID ? 1.9 : kind === HOOK_ID ? 2.35 : 3.05;
  const hold = Math.max(kind === JOIN_ID ? 2.05 : 2.45, (duration - hook - overview - cta) / packs);
  return { hook, overview, cta, packs, hold, packStart: hook + overview, ctaAt: duration - cta, size };
}

function packSlice(ids: number[], pack: number, size: number) {
  const start = pack * size;
  return ids.slice(start, start + size);
}

export function rosterBeat(kind: PlanBId, recT: number, duration: number, ids: number[]): RosterBeat {
  const tl = rosterTimeline(kind, ids.length, duration);
  const t = Math.max(0, recT);
  if (t < tl.hook) return { id: "hook" };
  if (t < tl.packStart) return { id: "overview" };
  if (t >= tl.ctaAt) return { id: "cta" };
  const shown = kind === HOOK_ID ? ids.slice(0, tl.packs * tl.size) : ids;
  const pack = Math.min(tl.packs - 1, Math.floor((t - tl.packStart) / Math.max(0.08, tl.hold)));
  const local = t - tl.packStart - pack * tl.hold;
  const u = clamp01(local / Math.max(0.08, tl.hold));
  const current = packSlice(shown, pack, tl.size);
  if (pack > 0 && local < CROSS) {
    const k = clamp01(local / CROSS);
    return {
      id: "pack",
      pack,
      packs: tl.packs,
      ids: current,
      outgoing: packSlice(shown, pack - 1, tl.size),
      u,
      enter: k,
      exit: k,
    };
  }
  const firstIn = pack === 0 ? clamp01(local / 0.48) : 1;
  return { id: "pack", pack, packs: tl.packs, ids: current, outgoing: [], u, enter: firstIn, exit: 0 };
}

function layoutSlot(layout: number, i: number, n: number, out: RosterPose) {
  const count = Math.max(1, n);
  const idx = Math.max(0, i);
  out.y = 0;
  const kind = ((layout % 4) + 4) % 4;
  if (count <= 3 || kind === 1) {
    out.x = (idx - (count - 1) / 2) * (kind === 1 ? 1.22 : 1.38);
    out.z = ROSTER_STAGE_Z;
    return;
  }
  if (kind === 2) {
    if (idx === 0) {
      out.x = 0;
      out.z = ROSTER_STAGE_Z - 0.12;
    } else if (idx < 3) {
      out.x = idx === 1 ? -1.28 : 1.28;
      out.z = ROSTER_STAGE_Z + 1.15;
    } else {
      out.x = idx === 3 ? -1.92 : 1.92;
      out.z = ROSTER_STAGE_Z + 2.2;
    }
    return;
  }
  if (kind === 3) {
    out.x = (idx - (count - 1) / 2) * 1.26;
    out.z = ROSTER_STAGE_Z + (idx % 2) * 1.5;
    return;
  }
  const front = Math.ceil(count / 2);
  const back = count - front;
  if (idx < front) {
    out.x = (idx - (front - 1) / 2) * 1.42;
    out.z = ROSTER_STAGE_Z;
  } else {
    const j = idx - front;
    out.x = (j - (back - 1) / 2) * 1.42;
    out.z = ROSTER_STAGE_Z + 2.05;
  }
}

function faceYaw(pack: number) {
  const s = ((pack % 6) + 6) % 6;
  if (s === 1) return -0.46;
  if (s === 2) return 0.48;
  if (s === 5) return 0.18;
  return 0.1;
}

export function stampRosterSoldier(
  slot: number,
  n: number,
  pack: number,
  recT: number,
  enter: number,
  exit: number,
  u: number,
  out: RosterPose
) {
  layoutSlot(pack, slot, n, out);
  const side = pack % 2 === 0 ? 1 : -1;
  const inn = clamp01(enter);
  const outp = clamp01(exit);
  if (pack === 0 && outp <= 0.001) {
    out.z += 7.2 * (1 - inn);
    out.x += 0.35 * (1 - inn);
  } else {
    out.x += side * 5.4 * (1 - inn);
    out.z += 2.1 * (1 - inn);
  }
  out.x -= side * 5.4 * outp;
  out.z -= 1.6 * outp;
  out.y = Math.sin(recT * 3.1 + slot * 1.7) * 0.03 * inn * (1 - outp);
  const face = faceYaw(pack);
  out.rx = 0.09 * inn * (1 - outp);
  out.ry = face * inn * (1 - outp) + -side * 1.12 * (1 - inn) + side * 1.18 * outp;
  out.rz = 0;
  out.scaleMul = 0.92 + 0.08 * inn * (1 - outp * 0.35);
  out.nameMul = inn * (1 - outp);
  if (inn > 0.55 && outp < 0.12) {
    const holdScan = clamp01((u - 0.1) / 0.72);
    const scan = Math.min(Math.max(0, n - 1), Math.floor(holdScan * Math.max(1, n)));
    if (slot === scan) {
      out.z += 0.7;
      out.scaleMul *= 1.08;
      out.nameMul *= 1.08;
      out.ry *= 0.72;
    }
  }
}

function packCamPair(style: number): [ShotPose, ShotPose] {
  const z = ROSTER_STAGE_Z;
  switch (((style % 6) + 6) % 6) {
    case 0:
      return [pose(0.2, 6.6, z + 17.8, 0, 1.32, z + 0.9, 46), pose(-0.25, 5.2, z + 14.6, 0, 1.48, z + 0.5, 42)];
    case 1:
      return [pose(-3.8, 5.2, z + 16.4, 0.15, 1.4, z + 0.65, 44), pose(-1.6, 5.35, z + 15.2, 0.05, 1.44, z + 0.55, 42)];
    case 2:
      return [pose(3.9, 5.3, z + 16.4, -0.15, 1.38, z + 0.65, 44), pose(1.65, 5.05, z + 15.1, -0.04, 1.46, z + 0.52, 42)];
    case 3:
      return [pose(0.55, 3.55, z + 17.6, 0, 1.62, z + 0.2, 42), pose(-0.3, 3.7, z + 15.8, 0, 1.56, z + 0.35, 40)];
    case 4:
      return [pose(1.1, 9.2, z + 15.2, 0, 0.95, z + 1.1, 46), pose(0.2, 6.3, z + 14.6, 0, 1.34, z + 0.7, 43)];
    default:
      return [pose(-2.8, 6.7, z + 16.8, 0.12, 1.24, z + 0.8, 46), pose(2.2, 5.5, z + 15.2, -0.1, 1.42, z + 0.55, 42)];
  }
}

export function sampleRoster(
  kind: PlanBId,
  recT: number,
  duration: number,
  ctx: ShotCtx,
  ids: number[]
): ShotPose {
  const beat = rosterBeat(kind, recT, duration, ids);
  const { form, castle } = ctx;
  const gate = pose(1.4, 7.4, castle.front + 19, 0.1, castle.midY * 0.4, castle.front + 1.5, 40);
  const hookMid = pose(1.2, 48, form.midZ + 8, 0, 0.7, form.midZ, 48);
  const dive = pose(0.4, 14, ROSTER_STAGE_Z + 18, 0, 1.55, ROSTER_STAGE_Z + 1.2, 46);
  const tl = rosterTimeline(kind, ids.length, duration);
  if (beat.id === "hook") {
    const u = clamp01(recT / Math.max(0.2, tl.hook));
    return lerpPose(gate, hookMid, u);
  }
  if (beat.id === "overview") {
    const u = clamp01((recT - tl.hook) / Math.max(0.2, tl.overview));
    return lerpPose(hookMid, dive, u);
  }
  if (beat.id === "cta") {
    const last = packCamPair(Math.max(0, tl.packs - 1))[1];
    const payoff = pose(7.2, 15.5, form.midZ + 6, 0, 4.4, (form.front + castle.front) * 0.52, 42);
    const u = clamp01((recT - tl.ctaAt) / Math.max(0.2, tl.cta));
    return lerpPose(last, payoff, u);
  }
  const [a, b] = packCamPair(beat.pack);
  if (beat.outgoing.length) {
    const from = packCamPair(beat.pack - 1)[1];
    const whip = lerpPoseU(from, a, easeOutCubic(beat.enter));
    return pose(whip.x, whip.y, whip.z, whip.lx, whip.ly, whip.lz, whip.fov + (1 - beat.enter) * 5);
  }
  if (beat.pack === 0 && beat.enter < 1) {
    return lerpPoseU(dive, a, easeOutCubic(beat.enter));
  }
  const holdU = clamp01((beat.u - 0.14) / 0.86);
  return lerpPose(a, b, holdU);
}

export function rosterStageSlot(i: number, n: number, out: { x: number; y: number; z: number }) {
  const poseOut: RosterPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scaleMul: 1, nameMul: 1 };
  layoutSlot(0, i, n, poseOut);
  out.x = poseOut.x;
  out.y = poseOut.y;
  out.z = poseOut.z;
}
