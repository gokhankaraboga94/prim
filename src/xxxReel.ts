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

/** Fast start, hard deceleration — the "whip then settle" retention opener. */
function easeOutQuart(u: number) {
  const x = clamp01(u);
  return 1 - Math.pow(1 - x, 4);
}

/** Decaying handheld tremor right after a whip-stop; sells the impact. */
function settleJitter(t: number, at: number, amp = 0.16) {
  const dt = t - at;
  if (dt < 0 || dt > 0.55) return 0;
  return Math.sin(dt * 36) * amp * (1 - dt / 0.55);
}

function withJitter(p: ShotPose, j: number): ShotPose {
  if (j === 0) return p;
  return { ...p, x: p.x + j, y: p.y + j * 0.55 };
}

function lerpN(a: number, b: number, e: number) {
  return a + (b - a) * e;
}

/** Linear pose mix — caller supplies its own easing (lerpPose smoothstep'i hızlı açılışı yumuşatırdı). */
function mixPose(a: ShotPose, b: ShotPose, e: number): ShotPose {
  return {
    x: lerpN(a.x, b.x, e),
    y: lerpN(a.y, b.y, e),
    z: lerpN(a.z, b.z, e),
    lx: lerpN(a.lx, b.lx, e),
    ly: lerpN(a.ly, b.ly, e),
    lz: lerpN(a.lz, b.lz, e),
    fov: lerpN(a.fov, b.fov, e),
  };
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

/** xxx1 — kamçı geçiş: cephe boyunca hızlı süpürme + sert fren → yakın isimler → vinç → kale fonlu kayma. */
function xxx1Cam(recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle, fit } = ctx;
  const t = Math.max(0, recT);
  const front = form.front;
  const back = form.back;
  const mid = form.midZ;
  const halfW = Math.max(6, form.width * 0.5);

  // Beat 1 (0–2.4s): warp strafe along the front ranks — faces and names whip past
  // the lens at full speed, then the camera slams to a stop dead center.
  const whipA = pose(halfW + 10, 3.4, front - 10.5, halfW * 0.4, 1.4, front + 2, 34);
  const whipB = pose(-0.4, 2.8, front - 7.8, 0, 1.3, front + 1.5, 30);
  if (t < 2.4) return withJitter(mixPose(whipA, whipB, easeOutQuart(t / 2.4)), settleJitter(t, 2.15));

  // Beat 2 (2.4–5s): intimate slow push at the center — the name payoff, dead readable.
  const b2a = pose(-0.4, 2.8, front - 7.8, 0, 1.3, front + 1.5, 30);
  const b2b = pose(0.5, 2.7, front - 7.2, 0.2, 1.28, front + 1.5, 29);
  if (t < 5) return withJitter(lerpPose(b2a, b2b, clamp01((t - 2.4) / 2.6)), settleJitter(t, 2.15));

  // Beat 3 (5–10s): vertical crane straight up to a bird's eye over the whole army.
  const b3a = pose(0, 7, front - 7, 0, 1.6, mid, 36);
  const b3b = pose(0, Math.max(44, fit * 0.7), mid - 2, 0, 1.2, mid + 4, 48);
  if (t < 10) return lerpPose(b3a, b3b, clamp01((t - 5) / 5));

  // Beat 4 (10–15s): wide lateral glide behind the army, castle looming in the background.
  const glide = halfW * 0.7 + Math.max(8, fit * 0.12);
  const b4a = pose(glide, 16 + fit * 0.08, back + Math.max(14, fit * 0.34), 0, castle.midY * 0.3, castle.front + 4, 44);
  const b4b = pose(-glide, 14 + fit * 0.07, back + Math.max(12, fit * 0.3), 0, castle.midY * 0.32, castle.front + 2, 42);
  return lerpPose(b4a, b4b, clamp01((t - 10) / 5));
}

/** xxx2 — fırıldak yörünge: ilk 3 sn hızlı dönüş + fren → ağır destansı yörünge → yakın isim finali. */
function xxx2Cam(recT: number, ctx: ShotCtx): ShotPose {
  const { form, fit } = ctx;
  const t = Math.max(0, recT);
  const front = form.front;
  const mid = form.midZ;
  const halfW = Math.max(6, form.width * 0.5);

  if (t < 11) {
    // Angle timeline: +150° → +38° in the first 3s (whip spin, close and low),
    // then +38° → -58° over the remaining 8s (slow, majestic).
    let deg: number;
    let y: number;
    let radius = Math.max(halfW + 16, fit * 0.5);
    if (t < 3) {
      const e = easeOutQuart(t / 3);
      deg = 150 - 112 * e;
      y = 5.5 + 3.5 * e;
      radius *= 0.82 + 0.18 * e; // starts tighter — pixels move faster
    } else {
      const u = clamp01((t - 3) / 8);
      const e = u * u * (3 - 2 * u);
      deg = 38 - 96 * e;
      y = 9 + 11 * Math.sin(e * Math.PI);
    }
    const ang = (Math.PI / 180) * deg;
    const x = Math.sin(ang) * radius;
    const z = front - Math.cos(ang) * radius;
    const j = settleJitter(t, 2.75, 0.2);
    return withJitter(pose(x, y, z, 0, 1.8, mid, t < 3 ? 38 : 40 + 4 * clamp01((t - 3) / 8)), j);
  }

  // Final: close dolly across the front line — the name payoff.
  const dollyX = Math.min(12, halfW * 0.38);
  const fa = pose(-dollyX, 2.9, front - 8.2, -dollyX * 0.5, 1.35, front + 2, 32);
  const fb = pose(dollyX * 0.6, 2.8, front - 7.8, dollyX * 0.3, 1.3, front + 2, 31);
  return lerpPose(fa, fb, clamp01((t - 11) / 4));
}

/** xxx3 — şahin dalışı: gökten isimlere 2.8 sn'de çakılma + fren → isimler → tarama → yükseliş finali. */
function xxx3Cam(recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle, fit, castleFit } = ctx;
  const t = Math.max(0, recT);
  const front = form.front;
  const back = form.back;
  const mid = form.midZ;
  const halfW = Math.max(6, form.width * 0.5);

  // Beat 1 (0–2.8s): plunge from the epic map view straight into the front line.
  // The ground rushes up, names snap into focus, camera brakes hard.
  const diveA = pose(6, Math.max(85, castleFit * 0.65), mid + 26, 0, castle.midY * 0.4, (castle.midZ + mid) * 0.5, 50);
  const diveB = pose(3.2, 3, front - 9, 1.4, 1.35, front + 2, 31);
  if (t < 2.8) return withJitter(mixPose(diveA, diveB, easeOutQuart(t / 2.8)), settleJitter(t, 2.55, 0.2));

  // Beat 2 (2.8–6.5s): hold close on the front ranks with a slow drift — read the names.
  const b2a = pose(3.2, 3, front - 9, 1.4, 1.35, front + 2, 31);
  const b2b = pose(1.2, 2.85, front - 8.2, 0.4, 1.3, front + 2, 30);
  if (t < 6.5) return withJitter(lerpPose(b2a, b2b, clamp01((t - 2.8) / 3.7)), settleJitter(t, 2.55, 0.2));

  // Beat 3 (6.5–11s): close sweep across the front ranks, left to right.
  const dollyX = Math.min(13, halfW * 0.4);
  const b3a = pose(-dollyX, 2.85, front - 8.4, -dollyX * 0.55, 1.35, front + 2.5, 33);
  const b3b = pose(dollyX, 2.85, front - 8.4, dollyX * 0.55, 1.35, front + 2.5, 33);
  if (t < 11) return lerpPose(b3a, b3b, clamp01((t - 6.5) / 4.5));

  // Beat 4 (11–15s): rise back out — the full army revealed as the exit wow.
  const b4a = pose(dollyX * 0.7, 4, front - 9, 0, 1.5, mid, 34);
  const b4b = pose(0, 24 + fit * 0.15, back + Math.max(14, fit * 0.36), 0, 2.1, mid, 46);
  return lerpPose(b4a, b4b, clamp01((t - 11) / 4));
}

/** xxx4 — surlardan atlayış: kale tepesinden orduya 2.6 sn'de pike + fren → isimler → alçak tarama → kahraman final. */
function xxx4Cam(recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle, fit, castleFit } = ctx;
  const t = Math.max(0, recT);
  const front = form.front;
  const mid = form.midZ;
  const gate = castle.front;
  const halfW = Math.max(6, form.width * 0.5);

  // Beat 1 (0–2.6s): leap off the battlements — full-speed swoop from the wall top
  // down to the front line, ground and army rushing at the lens, hard brake.
  const swoopA = pose(3, castle.midY + 22, gate - 10, 0, 2.2, mid, 46);
  const swoopB = pose(0.8, 3.1, front - 9.5, 0, 1.35, front + 2, 31);
  if (t < 2.6) return withJitter(mixPose(swoopA, swoopB, easeOutQuart(t / 2.6)), settleJitter(t, 2.35, 0.2));

  // Beat 2 (2.6–6s): settle close on the front ranks — names readable, slow drift in.
  const b2a = pose(0.8, 3.1, front - 9.5, 0, 1.35, front + 2, 31);
  const b2b = pose(-0.6, 2.9, front - 8.2, -0.2, 1.3, front + 1.8, 30);
  if (t < 6) return withJitter(lerpPose(b2a, b2b, clamp01((t - 2.6) / 3.4)), settleJitter(t, 2.35, 0.2));

  // Beat 3 (6–10s): low lateral track along the front ranks, right to left — more names.
  const dollyX = Math.min(12, halfW * 0.38);
  const b3a = pose(dollyX, 2.9, front - 8.4, dollyX * 0.5, 1.35, front + 2.2, 32);
  const b3b = pose(-dollyX, 2.9, front - 8.4, -dollyX * 0.5, 1.35, front + 2.2, 32);
  if (t < 10) return lerpPose(b3a, b3b, clamp01((t - 6) / 4));

  // Beat 4 (10–15s): hero wide from the flank — army and castle in one frame, slow drift.
  const heroDist = Math.max(castleFit * 0.5, fit * 0.48);
  const b4a = pose(heroDist * 0.4, castle.midY + 40 + castleFit * 0.16, castle.midZ + heroDist + 18, 0, castle.midY * 0.55, (castle.midZ + mid) * 0.5, 42);
  const b4b = pose(-heroDist * 0.2, castle.midY + 34 + castleFit * 0.14, castle.midZ + heroDist + 2, 0, castle.midY * 0.5, (castle.midZ + mid) * 0.5, 40);
  return lerpPose(b4a, b4b, clamp01((t - 10) / 5));
}
