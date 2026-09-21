import { lerpPose, type ShotCtx, type ShotPose } from "./shotModes";

/**
 * XXX — discovery reels.
 *
 * "xxx" (18s, unchanged): no text at all, the user overlays their own hook PNG.
 * "xxx1".."xxx4" (15s): same quality, different camera choreography, and the
 * hook banner (ADIN BU ORDUDA OLABİLİR, black band, yellow ADIN) is rendered
 * into the video on the top band — no manual PNG needed.
 */
export const XXX_ID = "xxx" as const;
export const XXX1_ID = "xxx1" as const;
export const XXX2_ID = "xxx2" as const;
export const XXX3_ID = "xxx3" as const;
export const XXX4_ID = "xxx4" as const;

export type XxxId = typeof XXX_ID | typeof XXX1_ID | typeof XXX2_ID | typeof XXX3_ID | typeof XXX4_ID;

export const XXX_MODES: { id: XxxId; label: string }[] = [
  { id: XXX_ID, label: "xxx" },
  { id: XXX1_ID, label: "xxx1" },
  { id: XXX2_ID, label: "xxx2" },
  { id: XXX3_ID, label: "xxx3" },
  { id: XXX4_ID, label: "xxx4" },
];

export const XXX_SECONDS = 18;
/** xxx1..xxx4 clip length. */
export const XXXV_SECONDS = 15;

export function isXxx(id: string | null | undefined): id is XxxId {
  return id === XXX_ID || id === XXX1_ID || id === XXX2_ID || id === XXX3_ID || id === XXX4_ID;
}

export function xxxSeconds(id: XxxId) {
  return id === XXX_ID ? XXX_SECONDS : XXXV_SECONDS;
}

/** Variants render the hook banner in-video; plain xxx stays clean. */
export function xxxHasHook(id: XxxId) {
  return id !== XXX_ID;
}

function pose(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): ShotPose {
  return { x, y: Math.max(2.2, y), z, lx, ly: Math.max(1.1, ly), lz, fov };
}

function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

export function sampleXxxCam(recT: number, ctx: ShotCtx, id: XxxId = XXX_ID): ShotPose {
  if (id === XXX1_ID) return xxx1Cam(recT, ctx);
  if (id === XXX2_ID) return xxx2Cam(recT, ctx);
  if (id === XXX3_ID) return xxx3Cam(recT, ctx);
  if (id === XXX4_ID) return xxx4Cam(recT, ctx);
  return xxxBaseCam(recT, ctx);
}

/** Original 18s xxx — unchanged. */
function xxxBaseCam(recT: number, ctx: ShotCtx): ShotPose {
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

/** xxx1 — hipnotik yaklaşma → dikey vinç kuş bakışı → kale fonlu geniş kayma. */
function xxx1Cam(recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle, fit, castleFit } = ctx;
  const t = Math.max(0, recT);
  const front = form.front;
  const back = form.back;
  const mid = form.midZ;
  const halfW = Math.max(6, form.width * 0.5);

  // Beat 1: head-on slow push into the front ranks — names grow toward the lens.
  const b1a = pose(0.6, 3.3, front - 16, 0, 1.5, front + 2, 31);
  const b1b = pose(-0.4, 2.7, front - 7.6, 0, 1.3, front + 1.5, 29);

  // Beat 2: vertical crane straight up to a bird's eye over the whole army.
  const b2a = pose(0, 7, front - 7, 0, 1.6, mid, 36);
  const b2b = pose(0, Math.max(44, fit * 0.7), mid - 2, 0, 1.2, mid + 4, 48);

  // Beat 3: wide lateral glide behind the army, castle looming in the background.
  const glide = halfW * 0.7 + Math.max(8, fit * 0.12);
  const b3a = pose(glide, 16 + fit * 0.08, back + Math.max(14, fit * 0.34), 0, castle.midY * 0.3, castle.front + 4, 44);
  const b3b = pose(-glide, 14 + fit * 0.07, back + Math.max(12, fit * 0.3), 0, castle.midY * 0.32, castle.front + 2, 42);

  if (t < 5) return lerpPose(b1a, b1b, clamp01(t / 5));
  if (t < 10) return lerpPose(b2a, b2b, clamp01((t - 5) / 5));
  return lerpPose(b3a, b3b, clamp01((t - 10) / 5));
}

/** xxx2 — ağır yörünge (yarım tur) → ön safta yakın isim geçişi finali. */
function xxx2Cam(recT: number, ctx: ShotCtx): ShotPose {
  const { form, fit } = ctx;
  const t = Math.max(0, recT);
  const front = form.front;
  const mid = form.midZ;
  const halfW = Math.max(6, form.width * 0.5);

  if (t < 11) {
    // Half-orbit around the army center, front-right to front-left.
    const u = clamp01(t / 11);
    const e = u * u * (3 - 2 * u);
    const radius = Math.max(halfW + 16, fit * 0.5);
    const ang = (Math.PI / 180) * (58 - 116 * e); // +58° → -58° (0° = ön cephe)
    const x = Math.sin(ang) * radius;
    const z = front - Math.cos(ang) * radius;
    const y = 8 + 12 * Math.sin(e * Math.PI); // alçal-yüksel-alçal
    return pose(x, y, z, 0, 1.8, mid, 40 + 4 * e);
  }

  // Final: close dolly across the front line — the name payoff.
  const dollyX = Math.min(12, halfW * 0.38);
  const fa = pose(-dollyX, 2.9, front - 8.2, -dollyX * 0.5, 1.35, front + 2, 32);
  const fb = pose(dollyX * 0.6, 2.8, front - 7.8, dollyX * 0.3, 1.3, front + 2, 31);
  return lerpPose(fa, fb, clamp01((t - 11) / 4));
}

/** xxx3 — gökten dalış: harita bakışından isimlere çakılma → soldan sağa yakın tarama. */
function xxx3Cam(recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle, fit, castleFit } = ctx;
  const t = Math.max(0, recT);
  const front = form.front;
  const mid = form.midZ;
  const halfW = Math.max(6, form.width * 0.5);

  // Beat 1: epic map view — castle and army from very high, slow descent begins.
  const b1a = pose(6, Math.max(85, castleFit * 0.65), mid + 26, 0, castle.midY * 0.4, (castle.midZ + mid) * 0.5, 50);
  const b1b = pose(2, Math.max(30, fit * 0.45), front + 10, 0, 2, mid, 42);

  // Beat 2: keep diving to the front line — names snap into focus.
  const b2a = pose(2, Math.max(30, fit * 0.45), front + 10, 0, 2, mid, 42);
  const b2b = pose(3.5, 3, front - 9, 1.5, 1.35, front + 2, 31);

  // Beat 3: close sweep across the front ranks, left to right (xxx'in tersi).
  const dollyX = Math.min(13, halfW * 0.4);
  const b3a = pose(-dollyX, 2.85, front - 8.4, -dollyX * 0.55, 1.35, front + 2.5, 33);
  const b3b = pose(dollyX, 2.85, front - 8.4, dollyX * 0.55, 1.35, front + 2.5, 33);

  if (t < 6) return lerpPose(b1a, b1b, clamp01(t / 6));
  if (t < 10) return lerpPose(b2a, b2b, clamp01((t - 6) / 4));
  return lerpPose(b3a, b3b, clamp01((t - 10) / 5));
}

/** xxx4 — kalenin gözünden: surlardan orduya bakış → cepheye süzülüş → kahraman final. */
function xxx4Cam(recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle, fit, castleFit } = ctx;
  const t = Math.max(0, recT);
  const front = form.front;
  const mid = form.midZ;
  const gate = castle.front;

  // Beat 1: from the walls, sliding along the battlements, army spread below.
  const b1a = pose(4, castle.midY + 14, gate - 12, 0, 2.4, mid, 44);
  const b1b = pose(-4, castle.midY + 18, gate - 7, 0, 2.6, mid, 46);

  // Beat 2: swoop down from the castle toward the front line — into the names.
  const b2a = pose(-2, castle.midY + 10, gate - 4, 0, 2, front, 42);
  const b2b = pose(0.8, 3.1, front - 9.5, 0, 1.35, front + 2, 31);

  // Beat 3: hero wide from the flank — army and castle in one frame, slow drift.
  const heroDist = Math.max(castleFit * 0.5, fit * 0.48);
  const b3a = pose(heroDist * 0.4, castle.midY + 40 + castleFit * 0.16, castle.midZ + heroDist + 18, 0, castle.midY * 0.55, (castle.midZ + mid) * 0.5, 42);
  const b3b = pose(-heroDist * 0.2, castle.midY + 34 + castleFit * 0.14, castle.midZ + heroDist + 2, 0, castle.midY * 0.5, (castle.midZ + mid) * 0.5, 40);

  if (t < 5) return lerpPose(b1a, b1b, clamp01(t / 5));
  if (t < 10) return lerpPose(b2a, b2b, clamp01((t - 5) / 5));
  return lerpPose(b3a, b3b, clamp01((t - 10) / 5));
}
