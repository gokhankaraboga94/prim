import { normalizeHandle } from "./game";
import { lerpPose, type ShotCtx, type ShotPose } from "./shotModes";

export const COUNTDOWN_ID = "gerisayim" as const;
export type CountdownId = typeof COUNTDOWN_ID;

export const COUNTDOWN_MODE = { id: COUNTDOWN_ID, label: "Geri Sayım" } as const;
export const COUNTDOWN_SECONDS = 14;

export const COUNT_HOOK_END = 1.2;
/** İsim şeridi: oklar başladığında (3) açılır, ATEŞ bitince kapanır. */
export const COUNT_NAMES_START = COUNT_HOOK_END;
export const COUNT_NAMES_END = COUNT_FIRE_END;
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

function castleFitFov(
  camX: number,
  camY: number,
  camZ: number,
  lookX: number,
  lookY: number,
  lookZ: number,
  castle: ShotCtx["castle"],
  margin = 0.52
) {
  const dist = Math.hypot(camX - lookX, camY - lookY, camZ - lookZ);
  const need = (castle.width * margin + 8) / Math.max(16, dist * 0.7);
  return Math.max(40, Math.min(52, (Math.atan(need) * 360) / Math.PI));
}

/** İlk sahne: kale + ordu — surun büyük kısmı kadraja girer. */
function hookWidePose(ctx: ShotCtx): ShotPose {
  const { form, castle, castleFit } = ctx;
  const lookY = castle.midY * 0.62;
  const lookZ = castle.midZ - 1.2;
  const camX = 16;
  const camY = castle.midY + 24 + castleFit * 0.1;
  const camZ = form.midZ + 36;
  const fov = castleFitFov(camX, camY, camZ, 0.05, lookY, lookZ, castle, 0.58);
  return pose(camX, camY, camZ, 0.05, lookY, lookZ, fov);
}

function hookPushPose(ctx: ShotCtx): ShotPose {
  const { form, castle, castleFit } = ctx;
  const lookY = castle.midY * 0.56;
  const lookZ = castle.midZ + 0.8;
  const camX = 9;
  const camY = castle.midY + 16 + castleFit * 0.08;
  const camZ = form.front + 22;
  const fov = castleFitFov(camX, camY, camZ, 0, lookY, lookZ, castle, 0.5);
  return pose(camX, camY, camZ, 0, lookY, lookZ, fov);
}

function armyWidePose(form: ShotCtx["form"]): ShotPose {
  const camX = 5.4;
  const camY = 22.8;
  const camZ = form.back + 48;
  const lookX = 0;
  const lookY = 2.35;
  const lookZ = form.midZ;
  const dist = Math.hypot(camX - lookX, camY - lookY, camZ - lookZ);
  const half = form.width * 0.5 + 3.4;
  const hHalf = half / Math.max(20, dist * 0.9);
  const vHalf = hHalf / (9 / 16);
  const fov = Math.max(50, Math.min(62, (Math.atan(vHalf) * 360) / Math.PI));
  return pose(camX, camY, camZ, lookX, lookY, lookZ, fov);
}

function armyHoldPose(form: ShotCtx["form"], castle: ShotCtx["castle"]): ShotPose {
  const mid = (form.front + castle.front) * 0.5;
  return pose(9.8, 5.2, form.midZ + 8.5, -0.8, 2.05, mid, 38);
}

function castleWidePose(ctx: ShotCtx): ShotPose {
  const { castle, castleFit } = ctx;
  return pose(
    Math.max(14, castle.width * 0.22),
    Math.max(32, castle.midY + 38 + castleFit * 0.12),
    castle.midZ + Math.max(32, castleFit * 0.4),
    0.1,
    Math.max(1.65, castle.midY * 0.52),
    castle.midZ,
    40
  );
}

/** İsim şeridi sadece ok atışı sırasında (3·2·1·ATEŞ). */
export function countdownNamesOn(recT: number) {
  const t = Math.max(0, recT);
  return t >= COUNT_NAMES_START && t < COUNT_NAMES_END;
}

export function countdownNameList(names: string[], soldiers: number, limit = 10) {
  const out: string[] = [];
  const cap = Math.min(Math.max(0, Math.floor(soldiers)), names.length);
  for (let i = 0; i < cap && out.length < limit; i++) {
    const h = normalizeHandle(names[i] || "");
    if (h) out.push(h);
  }
  return out;
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
  const hookWide = hookWidePose(ctx);
  const hookPush = hookPushPose(ctx);
  const wide = armyWidePose(form);
  const hold = armyHoldPose(form, castle);
  const whole = castleWidePose(ctx);

  if (t < COUNT_HOOK_END) {
    return lerpPose(hookWide, hookPush, easeOutCubic(t / COUNT_HOOK_END));
  }
  if (t < COUNT_1_END) {
    const drift = Math.sin((t - COUNT_HOOK_END) * 0.85) * 0.6;
    const p = hookPushPose(ctx);
    return pose(p.x + drift, p.y, p.z - drift * 0.35, p.lx, p.ly, p.lz, p.fov);
  }
  if (t < COUNT_FIRE_END) {
    const u = easeOutCubic((t - COUNT_1_END) / (COUNT_FIRE_END - COUNT_1_END));
    return lerpPose(hookPushPose(ctx), hold, u);
  }
  if (t < COUNT_PROOF_END) {
    const u = easeOutCubic((t - COUNT_FIRE_END) / (COUNT_PROOF_END - COUNT_FIRE_END));
    return lerpPose(hold, wide, u);
  }
  if (t < COUNT_YOU_END) {
    const u = (t - COUNT_PROOF_END) / (COUNT_YOU_END - COUNT_PROOF_END);
    return lerpPose(wide, hold, easeOutCubic(u) * 0.55);
  }
  const u = easeOutCubic((t - COUNT_YOU_END) / (COUNTDOWN_SECONDS - COUNT_YOU_END));
  return lerpPose(hold, whole, u);
}
