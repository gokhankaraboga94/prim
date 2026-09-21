import { lerpPose, type ShotCtx, type ShotPose } from "./shotModes";

/**
 * XXX — 18s discovery reel. No text; the user overlays their own hook PNG
 * on the top band, so every shot keeps the army in the mid/lower frame.
 *
 * Beat 1 (0–4.5s)  close lateral dolly across the front ranks — names readable from frame one.
 * Beat 2 (4.5–10s) crane up and fly over the army — the scale reveal.
 * Beat 3 (10–14s)  hard cut: fast diagonal sweep behind the army with the castle behind it.
 * Beat 4 (14–18s)  hard cut: slow hero push-in on army + castle, loop-friendly.
 */
export const XXX_ID = "xxx" as const;
export type XxxId = typeof XXX_ID;
export const XXX_SECONDS = 18;

export function isXxx(id: string | null | undefined): id is XxxId {
  return id === XXX_ID;
}

function pose(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): ShotPose {
  return { x, y: Math.max(2.2, y), z, lx, ly: Math.max(1.1, ly), lz, fov };
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

export function sampleXxxCam(recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle, fit, castleFit } = ctx;
  const t = Math.max(0, recT);
  const front = form.front;
  const back = form.back;
  const mid = form.midZ;
  const halfW = Math.max(6, form.width * 0.5);

  // Beat 1: close dolly along the front line, right to left.
  const dollyX = Math.min(14, halfW * 0.42);
  const b1a = pose(dollyX, 2.9, front - 8.6, dollyX * 0.55, 1.35, front + 2.5, 33);
  const b1b = pose(-dollyX, 2.9, front - 8.6, -dollyX * 0.55, 1.35, front + 2.5, 33);

  // Beat 2: crane up from the front and fly over the ranks to a wide aerial behind the army.
  // Starts above the name tags so the flyover never clips a label.
  const b2a = pose(-dollyX * 0.7, 6.2, front - 7.8, 0, 1.5, mid, 36);
  const b2b = pose(0, 24 + fit * 0.16, back + Math.max(16, fit * 0.42), 0, 2.1, mid, 46);

  // Beat 3: diagonal sweep behind the army, castle in the background.
  const sweep = halfW + Math.max(10, fit * 0.18);
  const b3a = pose(sweep, 11 + fit * 0.05, back + 12, -sweep * 0.18, 2.4, castle.front + 6, 40);
  const b3b = pose(-sweep, 15 + fit * 0.06, back + 17, sweep * 0.1, 2.6, castle.front + 2, 42);

  // Beat 4: hero wide — army and castle together, slow push-in.
  const heroDist = Math.max(castleFit * 0.55, fit * 0.5);
  const b4a = pose(castle.width * 0.08, castle.midY + 46 + castleFit * 0.22, castle.midZ + heroDist + 26, 0, castle.midY * 0.6, (castle.midZ + mid) * 0.5, 42);
  const b4b = pose(-castle.width * 0.05, castle.midY + 38 + castleFit * 0.18, castle.midZ + heroDist + 6, 0, castle.midY * 0.55, (castle.midZ + mid) * 0.5, 40);

  if (t < 4.5) return lerpPose(b1a, b1b, clamp01(t / 4.5));
  if (t < 10) return lerpPose(b2a, b2b, clamp01((t - 4.5) / 5.5));
  if (t < 14) return lerpPose(b3a, b3b, clamp01((t - 10) / 4));
  return lerpPose(b4a, b4b, clamp01((t - 14) / Math.max(0.5, XXX_SECONDS - 14)));
}
