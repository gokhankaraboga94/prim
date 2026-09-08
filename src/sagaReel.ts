import { frontWalk } from "./castleLayout";
import { lerpPose, type ShotCtx, type ShotPose } from "./shotModes";

export const SAGA_KUSATMA = "kusatma" as const;
export const SAGA_SUR = "sur" as const;
export const SAGA_HUCUM = "hucum" as const;
export type SagaId = typeof SAGA_KUSATMA | typeof SAGA_SUR | typeof SAGA_HUCUM;

export const SAGA_MODES = [
  { id: SAGA_KUSATMA, label: "Kuşatma", seconds: 30 },
  { id: SAGA_SUR, label: "Sur bakışı", seconds: 15 },
  { id: SAGA_HUCUM, label: "Hücum", seconds: 20 },
] as const;

export function isSaga(id: string | null | undefined): id is SagaId {
  return id === SAGA_KUSATMA || id === SAGA_SUR || id === SAGA_HUCUM;
}

export function sagaDuration(id: SagaId) {
  return SAGA_MODES.find((m) => m.id === id)?.seconds ?? 30;
}

/** recT when the gate should start opening. null = no sally. */
export function sagaGateRecT(id: SagaId) {
  if (id === SAGA_SUR) return null;
  if (id === SAGA_HUCUM) return 4.1;
  return 12.8;
}

export type SagaBeat = "army" | "wall" | "volley" | "gate" | "fight" | "cta";

function pose(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): ShotPose {
  return { x, y, z, lx, ly, lz, fov };
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

type Cut = { id: SagaBeat; at: number; dur: number; a: ShotPose; b: ShotPose };

function cutsFor(id: SagaId, ctx: ShotCtx): Cut[] {
  const { form, castle } = ctx;
  const walk = frontWalk(ctx.level ?? 1);
  const mid = (form.front + castle.front) * 0.5;
  const wy = walk.y;
  const wz = walk.z;
  const wx = walk.leftX;

  const armyA = pose(1.15, 2.45, form.front - 9.2, 0.04, 1.28, form.front, 32);
  const armyB = pose(0.7, 2.65, form.front - 7.1, 0.02, 1.32, form.front + 0.8, 34);
  const wallA = pose(wx - 5.4, wy + 1.42, wz + 0.45, wx + 7.2, wy + 1.18, wz + 0.2, 28);
  const wallB = pose(wx - 1.2, wy + 1.52, wz + 0.7, wx + 9.5, wy + 1.22, wz + 0.25, 26);
  const lookA = pose(wx + 0.6, wy + 1.58, wz + 0.55, wx - 0.4, wy + 1.05, form.front, 30);
  const lookB = pose(wx - 1.8, wy + 1.48, wz + 0.35, 0.5, wy * 0.08, form.front + 4, 32);
  const volleyA = pose(7.6, 4.1, form.back + 5.5, -0.4, 1.95, form.midZ, 38);
  const volleyB = pose(2.4, 3.15, form.front + 1.4, 0, 1.55, castle.front + 5, 36);
  const gateA = pose(1.6, 4.6, castle.front + 21, 0.1, 3.1, castle.front + 1, 38);
  const gateB = pose(5.8, 3.9, castle.front + 27, 0.2, 2.35, mid, 40);
  const fightA = pose(13.5, 5.1, form.front - 3.2, -1.8, 1.85, form.front - 7, 36);
  const fightB = pose(7.4, 7.6, form.midZ + 7, 0, 2.15, castle.front + 5, 42);
  const wide = pose(9.5, 17.5, form.back + 15, 0, 4.1, mid, 44);

  if (id === SAGA_SUR) {
    return [
      { id: "army", at: 0, dur: 3.6, a: armyA, b: armyB },
      { id: "wall", at: 3.6, dur: 4.4, a: wallA, b: wallB },
      { id: "wall", at: 8, dur: 4.2, a: lookA, b: lookB },
      { id: "cta", at: 12.2, dur: 2.8, a: lookB, b: wide },
    ];
  }
  if (id === SAGA_HUCUM) {
    return [
      { id: "volley", at: 0, dur: 4.1, a: volleyA, b: volleyB },
      { id: "gate", at: 4.1, dur: 4.8, a: gateA, b: gateB },
      { id: "fight", at: 8.9, dur: 7.4, a: fightA, b: fightB },
      { id: "cta", at: 16.3, dur: 3.7, a: fightB, b: wide },
    ];
  }
  return [
    { id: "army", at: 0, dur: 4.1, a: armyA, b: armyB },
    { id: "wall", at: 4.1, dur: 4.2, a: wallA, b: wallB },
    { id: "wall", at: 8.3, dur: 4.5, a: lookA, b: lookB },
    { id: "volley", at: 12.8, dur: 4.4, a: volleyA, b: volleyB },
    { id: "gate", at: 17.2, dur: 4.2, a: gateA, b: gateB },
    { id: "fight", at: 21.4, dur: 5.4, a: fightA, b: fightB },
    { id: "cta", at: 26.8, dur: 3.2, a: fightB, b: wide },
  ];
}

export function sagaBeat(id: SagaId, recT: number, duration: number): SagaBeat {
  const t = Math.max(0, recT);
  if (id === SAGA_SUR) {
    if (t < 3.6) return "army";
    if (t < 12.2) return "wall";
    return "cta";
  }
  if (id === SAGA_HUCUM) {
    if (t < 4.1) return "volley";
    if (t < 8.9) return "gate";
    if (t < 16.3) return "fight";
    return "cta";
  }
  if (t < 4.1) return "army";
  if (t < 12.8) return "wall";
  if (t < 17.2) return "volley";
  if (t < 21.4) return "gate";
  if (t < 26.8) return "fight";
  return t >= duration - 0.05 ? "cta" : "cta";
}

export function sampleSaga(id: SagaId, recT: number, duration: number, ctx: ShotCtx): ShotPose {
  const cuts = cutsFor(id, ctx);
  const t = Math.max(0, recT);
  let cut = cuts[0];
  for (let i = 0; i < cuts.length; i++) {
    if (t >= cuts[i].at) cut = cuts[i];
  }
  const u = clamp01((t - cut.at) / Math.max(0.08, cut.dur));
  return lerpPose(cut.a, cut.b, u);
}
