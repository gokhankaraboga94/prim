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
export const VV2_ID = "vv2" as const;

export const HARIKA_ID = "harika" as const;
export const HARIKA2_ID = "harika2" as const;

export type XxxId = typeof XXX_ID | typeof XXX3_ID | typeof VV1_ID | typeof VV2_ID | typeof HARIKA_ID | typeof HARIKA2_ID;

export const XXX_MODES: { id: XxxId; label: string }[] = [
  { id: XXX_ID, label: "xxx" },
  { id: XXX3_ID, label: "xxx3" },
  { id: VV1_ID, label: "vv1" },
  { id: VV2_ID, label: "vv2" },
  { id: HARIKA_ID, label: "harika" },
  { id: HARIKA2_ID, label: "harika2" },
];

export const XXX_SECONDS = 18;
/** xxx3 / vv1 clip length. */
export const XXXV_SECONDS = 15;

function isHarikaFamily(id: string | null | undefined) {
  return id === HARIKA_ID || id === HARIKA2_ID;
}

export function isXxx(id: string | null | undefined): id is XxxId {
  return id === XXX_ID || id === XXX3_ID || id === VV1_ID || id === VV2_ID || isHarikaFamily(id);
}

export const HARIKA2_SECONDS = 18;

export function xxxSeconds(id: XxxId) {
  if (id === XXX_ID) return XXX_SECONDS;
  if (id === HARIKA2_ID) return HARIKA2_SECONDS;
  return XXXV_SECONDS;
}

/** Variants render the hook banner in-video; plain xxx stays clean. */
export function xxxHasHook(id: XxxId) {
  return id !== XXX_ID;
}

/** Transparent 2-word caption — no white plate. */
export function xxxClearHook(id: XxxId) {
  return id === VV2_ID || isHarikaFamily(id);
}

export function xxxAdHook(id: XxxId) {
  return isHarikaFamily(id);
}

export function xxxHiRes(id: XxxId) {
  return id === VV2_ID || isHarikaFamily(id);
}

export function xxxHideCmd(id: XxxId) {
  return isHarikaFamily(id);
}

export function xxxQuiet(id: XxxId) {
  return isHarikaFamily(id);
}

export function xxxSquare(id: XxxId) {
  return isHarikaFamily(id);
}

/** No fade-in: skip-rate window is 1–2s, the super must be on frame 0. */
export function xxxInstantHook(id: XxxId) {
  return id === HARIKA2_ID;
}

/**
 * 0–1.5s: one 3-word hook — scannable in a single glance.
 * After that the 4-word CTA joins (7 words total, still under the 8-word cap).
 * Later phases only restack weight.
 */
export function harika2TextPhase(recT: number): "scan" | "hook" | "cta" | "proof" {
  const t = Math.max(0, recT);
  if (t < 1.5) return "scan";
  if (t < 4) return "hook";
  if (t < 9) return "cta";
  if (t < 14) return "proof";
  return "cta";
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
  if (id === VV2_ID) return vv2Cam(recT, ctx);
  if (id === HARIKA_ID) return harikaCam(recT, ctx);
  if (id === HARIKA2_ID) return harika2Cam(recT, ctx);
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
  const { form, castle, fit } = ctx;
  const t = Math.max(0, recT);
  const front = form.front;
  const back = form.back;
  const mid = form.midZ;
  const gate = castle.front;
  const halfW = Math.max(6, form.width * 0.5);
  const scanX = Math.min(13, halfW * 0.4);
  // Keep every look target well off world-up so lookAt never degenerates
  // (straight-down bird's eye crashed WebGL on iPhone → empty recording).
  const lookY = 1.45;

  // ---- 0–3s: flash montage. Hard cuts, but only proven-safe side/front poses. ----
  if (t < 0.75) {
    // Cut 1: extreme close names, slight lateral push.
    const a = pose(scanX * 0.35, 2.9, front - 8.2, scanX * 0.18, lookY, front + 2, 32);
    const b = pose(-scanX * 0.2, 2.85, front - 7.6, -0.15, lookY, front + 2.2, 31);
    return mixPose(a, b, t / 0.75);
  }
  if (t < 1.5) {
    // Cut 2: opposite flank, still at name height — not a top-down.
    const a = pose(-scanX - 4, 4.2, front - 5, -scanX * 0.3, 1.7, mid, 36);
    const b = pose(scanX + 4, 5.4, front - 3, scanX * 0.2, 1.8, mid, 38);
    return mixPose(a, b, (t - 0.75) / 0.75);
  }
  if (t < 2.25) {
    // Cut 3: behind the army, castle in frame, fast lateral (xxx beat 3 family).
    const sweep = halfW + Math.max(8, fit * 0.14);
    const a = pose(sweep, 12, back + 14, -sweep * 0.12, 2.4, gate + 6, 40);
    const b = pose(-sweep * 0.4, 13, back + 16, sweep * 0.06, 2.5, gate + 4, 41);
    return mixPose(a, b, (t - 1.5) / 0.75);
  }
  if (t < 3) {
    // Cut 4: slam back to the front line and brake — name hunt starts here.
    const a = pose(scanX, 3.1, front - 9, scanX * 0.45, lookY, front + 2.2, 33);
    const b = pose(scanX * 0.15, 2.85, front - 8, 0.2, lookY, front + 2.2, 32);
    return withJitter(mixPose(a, b, easeOutQuart((t - 2.25) / 0.75)), settleJitter(t, 2.85, 0.14));
  }

  // ---- 3–11s: the name hunt — steady, crisp double scan across the front ranks ----
  if (t < 7.2) {
    const a = pose(scanX, 2.85, front - 8, scanX * 0.5, lookY, front + 2.2, 32);
    const b = pose(-scanX, 2.85, front - 8, -scanX * 0.5, lookY, front + 2.2, 32);
    return withJitter(mixPose(a, b, clamp01((t - 3) / 4.2)), settleJitter(t, 2.85, 0.14));
  }
  if (t < 11) {
    const a = pose(-scanX * 0.9, 3.5, front - 7, -scanX * 0.4, 1.6, front + 4, 33);
    const b = pose(scanX * 0.9, 3.5, front - 7, scanX * 0.4, 1.6, front + 4, 33);
    return mixPose(a, b, clamp01((t - 7.2) / 3.8));
  }

  // ---- 11–15s: rise and reveal the whole army with the castle ----
  const b4a = pose(scanX * 0.45, 4.4, front - 8.5, 0, 1.6, mid, 34);
  const b4b = pose(0, 22 + fit * 0.12, back + Math.max(16, fit * 0.36), 0, 2.4, (mid + gate) * 0.5, 44);
  return lerpPose(b4a, b4b, clamp01((t - 11) / 4));
}

/**
 * vv2 — cocktail-party opener.
 *
 * Data: slow spectacle 56% skip, flash-cuts 65% skip. Both failed because the
 * first 2s of the file were a warmup scrub of the whole clip, and the overlay
 * was a white ad-card plus a 5-word command.
 *
 * This shot starts already inside the names (the only asset that is personally
 * relevant on mute) and stays there for 3.4s with a crawl slow enough to read.
 * Two words, no plate. Then the hunt continues, then a gentle scale reveal.
 */
function vv2Cam(recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle, fit } = ctx;
  const t = Math.max(0, recT);
  const front = form.front;
  const back = form.back;
  const mid = form.midZ;
  const halfW = Math.max(6, form.width * 0.5);
  const crawl = Math.min(7.2, halfW * 0.24);
  const lookY = 1.4;

  // 0–3.4s: already in the names. Tight FOV, eye-level, no cut.
  // Lateral speed ~2 m/s so a handle stays on screen ~1s — long enough to read.
  const a0 = pose(crawl, 2.7, front - 6.9, crawl * 0.38, lookY, front + 1.7, 26);
  const a1 = pose(crawl * 0.12, 2.66, front - 6.7, 0.15, lookY, front + 1.85, 25);
  if (t < 3.4) return lerpPose(a0, a1, clamp01(t / 3.4));

  // 3.4–10.6s: keep hunting along the front rank — Zeigarnik, the search is on.
  const b0 = pose(crawl * 0.12, 2.66, front - 6.7, 0.15, lookY, front + 1.85, 25);
  const b1 = pose(-crawl, 2.74, front - 7.0, -crawl * 0.36, lookY, front + 2.0, 27);
  if (t < 10.6) return lerpPose(b0, b1, clamp01((t - 3.4) / 7.2));

  // 10.6–15s: rise just enough to prove it's an army, names still readable.
  const c0 = pose(-crawl * 0.55, 3.2, front - 7.6, 0, 1.55, mid, 30);
  const c1 = pose(0, 14 + fit * 0.06, back + Math.max(12, fit * 0.28), 0, 2.15, (mid + castle.front) * 0.55, 40);
  return lerpPose(c0, c1, clamp01((t - 10.6) / 4.4));
}

/**
 * harika — square army, mangonels on the flanks.
 *
 * First 4s: elevated 3/4 so the square block reads, then a slow push into the
 * names (TV product lock). Hook sits in the upper third — first fixation,
 * just under Instagram chrome.
 */
function harikaCam(recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle, fit } = ctx;
  const t = Math.max(0, recT);
  const front = form.front;
  const back = form.back;
  const mid = form.midZ;
  const halfW = Math.max(6, form.width * 0.5);
  const side = Math.min(14, halfW * 0.42);

  // 0–4s: see the ordered square + a mangonel, then lock onto names.
  const a0 = pose(side + 6, 8.2, front - 16, 0, 1.7, mid, 34);
  const a1 = pose(side * 0.22, 3.05, front - 7.5, 0.4, 1.42, front + 2.1, 27);
  if (t < 4) return lerpPose(a0, a1, clamp01(t / 4));

  // 4–10s: crawl along the front of the block, names readable.
  const b0 = pose(side * 0.22, 3.05, front - 7.5, 0.4, 1.42, front + 2.1, 27);
  const b1 = pose(-side * 0.55, 3.2, front - 8.0, -side * 0.18, 1.48, front + 2.6, 29);
  if (t < 10) return lerpPose(b0, b1, clamp01((t - 4) / 6));

  // 10–15s: rise along the 3/4 to show the whole square, mangonels, castle.
  const c0 = pose(-side * 0.4, 5.5, front - 10, 0, 1.8, mid, 32);
  const c1 = pose(-8, 16 + fit * 0.04, back + Math.max(14, fit * 0.22), 2, 2.2, (mid + castle.front) * 0.55, 40);
  return lerpPose(c0, c1, clamp01((t - 10) / 5));
}

/**
 * harika2 — skip-rate + pattern-interrupt architecture.
 *
 * 0–1.5s: in media res, almost still, super on (hook window — no cuts).
 * Then a hard visual change every ~2.5s so the mind cannot go passive.
 * 18s sits in the 15–30s bucket (45% avg view).
 */
function harika2Cam(recT: number, ctx: ShotCtx): ShotPose {
  const { form, castle, fit } = ctx;
  const t = Math.max(0, recT);
  const front = form.front;
  const back = form.back;
  const mid = form.midZ;
  const halfW = Math.max(6, form.width * 0.5);
  const side = Math.min(10, halfW * 0.34);

  const lockA = pose(0.55, 2.72, front - 6.45, 0.18, 1.36, front + 1.7, 24);
  const lockB = pose(0.25, 2.7, front - 6.35, 0.08, 1.35, front + 1.75, 24);
  if (t < 1.5) return lerpPose(lockA, lockB, clamp01(t / 1.5));

  // Interrupt 1 (1.5–4): punch-in zoom on the same rank.
  const z0 = pose(0.25, 2.7, front - 6.35, 0.08, 1.35, front + 1.75, 24);
  const z1 = pose(-0.2, 2.62, front - 5.85, -0.05, 1.32, front + 1.55, 22);
  if (t < 4) return lerpPose(z0, z1, clamp01((t - 1.5) / 2.5));

  // Interrupt 2 (4–6.5): cut — left 3/4 name crawl.
  const l0 = pose(-side * 0.55, 3.0, front - 7.2, -side * 0.18, 1.42, front + 2.1, 28);
  const l1 = pose(-side * 0.15, 2.95, front - 6.9, -0.1, 1.4, front + 2.0, 27);
  if (t < 6.5) return lerpPose(l0, l1, clamp01((t - 4) / 2.5));

  // Interrupt 3 (6.5–9): cut — right 3/4, one mangonel in frame.
  const r0 = pose(side + 3.2, 3.6, front - 8.4, side * 0.15, 1.55, front + 3.2, 30);
  const r1 = pose(side * 0.4, 3.2, front - 7.4, 0.3, 1.45, front + 2.4, 28);
  if (t < 9) return lerpPose(r0, r1, clamp01((t - 6.5) / 2.5));

  // Interrupt 4 (9–11.5): cut — opposite front scan.
  const s0 = pose(side * 0.65, 2.85, front - 7.0, side * 0.22, 1.38, front + 1.9, 26);
  const s1 = pose(-side * 0.45, 2.9, front - 7.1, -side * 0.16, 1.4, front + 2.0, 27);
  if (t < 11.5) return lerpPose(s0, s1, clamp01((t - 9) / 2.5));

  // Interrupt 5 (11.5–14): cut — elevated square (B-roll of the block).
  const q0 = pose(side * 0.8, 7.2, front - 12, 0, 1.7, mid, 34);
  const q1 = pose(-side * 0.3, 8.4, front - 11, 0, 1.85, mid, 36);
  if (t < 14) return lerpPose(q0, q1, clamp01((t - 11.5) / 2.5));

  // Interrupt 6 (14–18): rise — army, mangonels, castle (watch-time close).
  const e0 = pose(-side * 0.4, 6.5, front - 10, 0, 1.75, mid, 33);
  const e1 = pose(-7, 15 + fit * 0.04, back + Math.max(13, fit * 0.2), 2, 2.15, (mid + castle.front) * 0.55, 40);
  return lerpPose(e0, e1, clamp01((t - 14) / 4));
}
