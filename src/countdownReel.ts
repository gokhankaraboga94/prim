import { lerpPose, type ShotCtx, type ShotPose } from "./shotModes";

export const COUNTDOWN_ID = "gerisayim" as const;
export type CountdownId = typeof COUNTDOWN_ID;

export const COUNTDOWN_MODE = { id: COUNTDOWN_ID, label: "Geri Sayım" } as const;
export const COUNTDOWN_SECONDS = 14;

export const COUNT_HOOK_END = 1.2;
export const COUNT_3_END = 2.4;
export const COUNT_2_END = 3.6;
export const COUNT_1_END = 4.8;
export const COUNT_FIRE_END = 6.0;
export const COUNT_PROOF_END = 9.0;
export const COUNT_YOU_END = 11.5;

export type CountdownBeat = "hook" | "count3" | "count2" | "count1" | "fire" | "proof" | "you" | "cta";

export function isCountdown(id: string | null | undefined): id is CountdownId {
  return id === COUNTDOWN_ID;
}

function pose(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): ShotPose {
  return { x, y: Math.max(3.4, y), z, lx, ly: Math.max(1.45, ly), lz, fov };
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

function easeOutCubic(t: number) {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
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

function armySpan(form: ShotCtx["form"]) {
  return Math.max(3.8, form.width * 0.4);
}

/** Mix-style: immediately behind the ranks — names and faces fill the frame. */
function armyFacePose(form: ShotCtx["form"], x: number): ShotPose {
  const cx = Math.max(-armySpan(form), Math.min(armySpan(form), x));
  return pose(cx, 4.55, form.back + 10.4, cx * 1.02, 2.38, form.back - 2.1, 34);
}

/** Through the ranks toward the front — bows, names, arrows leaving. Castle is only a sliver. */
function armyReadyPose(form: ShotCtx["form"], x: number, pull = 0): ShotPose {
  const cx = Math.max(-armySpan(form), Math.min(armySpan(form), x));
  return pose(
    cx,
    5.35 - pull * 0.25,
    form.back + 12.4 - pull * 2.2,
    cx * 0.55,
    2.22,
    form.front + 1.4 + pull * 1.1,
    36 - pull * 2
  );
}

function armyWidePose(form: ShotCtx["form"]): ShotPose {
  const camX = 5.4;
  const camY = 16.5;
  const camZ = form.back + 32;
  const lookX = 0;
  const lookY = 2.2;
  const lookZ = form.midZ;
  const dist = Math.hypot(camX - lookX, camY - lookY, camZ - lookZ);
  const half = form.width * 0.5 + 3.4;
  const hHalf = half / Math.max(20, dist * 0.9);
  const vHalf = hHalf / (9 / 16);
  const fov = Math.max(46, Math.min(58, (Math.atan(vHalf) * 360) / Math.PI));
  return pose(camX, camY, camZ, lookX, lookY, lookZ, fov);
}

/** Three-quarter: soldiers loosing toward the gate. */
function volleySidePose(form: ShotCtx["form"], castle: ShotCtx["castle"]): ShotPose {
  const lookZ = (form.front + castle.front) * 0.62;
  return pose(10.8, 5.05, form.midZ + 7.2, -2.4, 2.08, lookZ, 36);
}

function armyYouPose(form: ShotCtx["form"]): ShotPose {
  return pose(5.6, 6.4, form.back + 14.5, -0.35, 2.18, form.midZ, 38);
}

/** Army still in frame; castle as the target behind them. */
function armyCastlePayoff(form: ShotCtx["form"], castle: ShotCtx["castle"]): ShotPose {
  const lookZ = (form.front + castle.front) * 0.58;
  return pose(14.8, 8.6, form.back + 16, -1.6, 2.45, lookZ, 40);
}

export function countdownBeat(recT: number): CountdownBeat {
  const t = Math.max(0, recT);
  if (t < COUNT_HOOK_END) return "hook";
  if (t < COUNT_3_END) return "count3";
  if (t < COUNT_2_END) return "count2";
  if (t < COUNT_1_END) return "count1";
  if (t < COUNT_FIRE_END) return "fire";
  if (t < COUNT_PROOF_END) return "proof";
  if (t < COUNT_YOU_END) return "you";
  return "cta";
}

/** Camera shake on ATEŞ beat. */
export function countdownShake(recT: number) {
  const t = Math.max(0, recT);
  if (t < COUNT_1_END || t > COUNT_FIRE_END + 0.85) return 0;
  const peak = t < COUNT_FIRE_END ? (t - COUNT_1_END) / (COUNT_FIRE_END - COUNT_1_END) : 1 - (t - COUNT_FIRE_END) / 0.85;
  const wave = Math.sin((t - COUNT_1_END) * 38) * 0.35 + Math.sin((t - COUNT_1_END) * 21) * 0.2;
  return Math.max(0, peak) * wave * 0.14;
}

/** Brief screen flash intensity 0–1 on fire. */
export function countdownFlash(recT: number) {
  const t = Math.max(0, recT);
  if (t < COUNT_1_END + 0.05 || t > COUNT_FIRE_END + 0.35) return 0;
  const u = clamp01((t - COUNT_1_END - 0.05) / 0.22);
  const fade = t > COUNT_FIRE_END ? 1 - clamp01((t - COUNT_FIRE_END) / 0.35) : 1;
  return Math.sin(u * Math.PI) * 0.42 * fade;
}

export type CountdownVolley = {
  active: boolean;
  burst: number;
  pace: number;
  cap: number;
  gate: boolean;
};

export function countdownVolley(recT: number): CountdownVolley {
  const t = Math.max(0, recT);
  const beat = countdownBeat(t);
  if (beat === "hook") return { active: false, burst: 0, pace: 1, cap: 0, gate: true };
  if (beat === "count3") return { active: true, burst: 5, pace: 0.12, cap: 14, gate: true };
  if (beat === "count2") return { active: true, burst: 7, pace: 0.1, cap: 18, gate: true };
  if (beat === "count1") return { active: true, burst: 9, pace: 0.08, cap: 22, gate: true };
  if (beat === "fire") return { active: true, burst: 14, pace: 0.05, cap: 28, gate: true };
  if (beat === "proof" || beat === "you" || beat === "cta") {
    return { active: true, burst: 3, pace: 0.14, cap: 20, gate: true };
  }
  return { active: false, burst: 0, pace: 1, cap: 0, gate: true };
}

export function sampleCountdown(recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle } = ctx;
  const t = Math.max(0, recT);
  const span = armySpan(form);
  const hookStart = armyFacePose(form, 0.35);
  const hookEnd = armyReadyPose(form, -span * 0.18, 0.35);
  const countEnd = armyReadyPose(form, span * 0.72, 0.95);
  const fire = volleySidePose(form, castle);
  const wide = armyWidePose(form);
  const you = armyYouPose(form);
  const payoff = armyCastlePayoff(form, castle);

  if (t < COUNT_HOOK_END) {
    return lerpPose(hookStart, hookEnd, easeOutCubic(t / COUNT_HOOK_END));
  }
  if (t < COUNT_1_END) {
    return lerpLinear(hookEnd, countEnd, (t - COUNT_HOOK_END) / (COUNT_1_END - COUNT_HOOK_END));
  }
  if (t < COUNT_FIRE_END) {
    return lerpPose(countEnd, fire, easeOutCubic((t - COUNT_1_END) / (COUNT_FIRE_END - COUNT_1_END)));
  }
  if (t < COUNT_PROOF_END) {
    return lerpPose(fire, wide, easeOutCubic((t - COUNT_FIRE_END) / (COUNT_PROOF_END - COUNT_FIRE_END)));
  }
  if (t < COUNT_YOU_END) {
    return lerpPose(wide, you, easeOutCubic((t - COUNT_PROOF_END) / (COUNT_YOU_END - COUNT_PROOF_END)));
  }
  return lerpPose(you, payoff, easeOutCubic((t - COUNT_YOU_END) / (COUNTDOWN_SECONDS - COUNT_YOU_END)));
}
