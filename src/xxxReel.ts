import { lerpPose, type ShotCtx, type ShotPose } from "./shotModes";

/**
 * XXX / VV — discovery reels.
 *
 * "xxx" (18s, unchanged): no text at all, the user overlays their own hook PNG.
 * "xxx3" (15s): falcon dive opener, hook banner rendered in-video.
 * "vv1" (15s): retention build — 4 hard cuts in the first 3 seconds (flash montage),
 * then the "ADINI BUL" name-scan game, then the hero reveal. Hook banner in-video.
 */
export const XXX_ID = "xxx" as const;
export const XXX3_ID = "xxx3" as const;
export const VV1_ID = "vv1" as const;

export type XxxId = typeof XXX_ID | typeof XXX3_ID | typeof VV1_ID;

export const XXX_MODES: { id: XxxId; label: string }[] = [
  { id: XXX_ID, label: "xxx" },
  { id: XXX3_ID, label: "xxx3" },
  { id: VV1_ID, label: "vv1" },
];

export const XXX_SECONDS = 18;
/** xxx3 / vv1 clip length. */
export const XXXV_SECONDS = 15;

export function isXxx(id: string | null | undefined): id is XxxId {
  return id === XXX_ID || id === XXX3_ID || id === VV1_ID;
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

/** Linear pose mix — caller supplies its own easing. */
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
  if (id === XXX3_ID) return xxx3Cam(recT, ctx);
  if (id === VV1_ID) return vv1Cam(recT, ctx);
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

/** xxx3 — şahin dalışı: gökten isimlere 2.8 sn'de çakılma + fren → isimler → tarama → yükseliş finali. */
function xxx3Cam(recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle, fit, castleFit } = ctx;
  const t = Math.max(0, recT);
  const front = form.front;
  const back = form.back;
  const mid = form.midZ;
  const halfW = Math.max(6, form.width * 0.5);

  // Beat 1 (0–2.8s): plunge from the epic map view straight into the front line.
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

/**
 * vv1 — flaş montaj + isim avı.
 *
 * 0–3s: dört sert kesme, her karede hızlı iç hareket. Beyin sahneyi çözemeden
 * kare değişir; her kesme dikkati sıfırlar (pattern interrupt üstüne pattern
 * interrupt). Banner aynı anda "ADINI BUL" görevini verir.
 * 3–11s: isim avı — ön saflarda net okunur çift tarama; izleyici adını arar.
 * 11–15s: geri çekilip yükselen kahraman final — ordu + kale.
 */
function vv1Cam(recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle, fit, castleFit } = ctx;
  const t = Math.max(0, recT);
  const front = form.front;
  const back = form.back;
  const mid = form.midZ;
  const gate = castle.front;
  const halfW = Math.max(6, form.width * 0.5);

  // ---- 0–3s: flash montage, hard cuts every 0.75s, fast motion inside each shot ----
  if (t < 0.75) {
    // Cut 1: extreme close, low angle at the front line — faces and names fill the frame.
    const a = pose(0.6, 2.6, front - 6.8, 0.1, 1.45, front + 1.2, 30);
    const b = pose(-0.5, 2.75, front - 7.6, -0.1, 1.35, front + 1.5, 29);
    return mixPose(a, b, t / 0.75);
  }
  if (t < 1.5) {
    // Cut 2: straight-down bird's eye, fast lateral slide over the ranks.
    const a = pose(-7, Math.max(46, fit * 0.72), mid - 2, -1, 1.2, mid + 3, 46);
    const b = pose(7, Math.max(42, fit * 0.66), mid + 2, 1, 1.2, mid + 3, 44);
    return mixPose(a, b, (t - 0.75) / 0.75);
  }
  if (t < 2.25) {
    // Cut 3: from the castle walls, swooping toward the army.
    const a = pose(3, castle.midY + 20, gate - 9, 0, 2.2, mid, 46);
    const b = pose(-1, castle.midY + 9, gate + 2, 0, 2, front, 42);
    return mixPose(a, b, (t - 1.5) / 0.75);
  }
  if (t < 3) {
    // Cut 4: massive wide — army and castle in one frame, fast push-in, then brake.
    const heroDist = Math.max(castleFit * 0.55, fit * 0.5);
    const a = pose(4, castle.midY + 52 + castleFit * 0.2, castle.midZ + heroDist + 30, 0, castle.midY * 0.55, (castle.midZ + mid) * 0.5, 44);
    const b = pose(1, castle.midY + 40 + castleFit * 0.16, castle.midZ + heroDist + 8, 0, castle.midY * 0.5, (castle.midZ + mid) * 0.5, 41);
    return withJitter(mixPose(a, b, easeOutQuart((t - 2.25) / 0.75)), settleJitter(t, 2.85, 0.18));
  }

  // ---- 3–11s: the name hunt — steady, crisp double scan across the front ranks ----
  const scanX = Math.min(14, halfW * 0.42);
  if (t < 7.2) {
    // Pass 1: right to left, tight on the first rows.
    const a = pose(scanX, 2.85, front - 8, scanX * 0.55, 1.35, front + 2.2, 32);
    const b = pose(-scanX, 2.85, front - 8, -scanX * 0.55, 1.35, front + 2.2, 32);
    return withJitter(mixPose(a, b, clamp01((t - 3) / 4.2)), settleJitter(t, 2.85, 0.18));
  }
  if (t < 11) {
    // Pass 2: left to right, a touch higher and deeper — the next rows of names.
    const a = pose(-scanX * 0.9, 3.6, front - 6.6, -scanX * 0.45, 1.6, front + 4, 33);
    const b = pose(scanX * 0.9, 3.6, front - 6.6, scanX * 0.45, 1.6, front + 4, 33);
    return mixPose(a, b, clamp01((t - 7.2) / 3.8));
  }

  // ---- 11–15s: hero exit — rise and reveal the whole army with the castle ----
  const b4a = pose(scanX * 0.5, 4.2, front - 8, 0, 1.6, mid, 34);
  const b4b = pose(0, 26 + fit * 0.16, back + Math.max(16, fit * 0.4), 0, castle.midY * 0.3, (mid + gate) * 0.5, 46);
  return lerpPose(b4a, b4b, clamp01((t - 11) / 4));
}
