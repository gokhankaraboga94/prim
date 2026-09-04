export type ShotId = "b" | "d" | "g" | "l" | "n" | "p" | "q" | "r" | "w" | "y" | "z";

export const CINEMA_ID = "birlesim" as const;
export type ReelShot = ShotId | typeof CINEMA_ID;

export const SHOT_MODES: { id: ShotId; label: string }[] = [
  { id: "b", label: "Uzaktan yakına" },
  { id: "d", label: "Sağ çapraz geriden" },
  { id: "g", label: "Tepe bakış" },
  { id: "l", label: "Sağ sweep" },
  { id: "n", label: "Yukarı vinç" },
  { id: "p", label: "Geniş ustalayan" },
  { id: "q", label: "Çapraz dalış" },
  { id: "r", label: "Kaleden orduya" },
  { id: "w", label: "Geri ve yukarı" },
  { id: "y", label: "Kuş bakışı" },
  { id: "z", label: "Ters zoom" },
];

export const CINEMA_MODE = { id: CINEMA_ID, label: "Birleşim" } as const;

export type ShotPose = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

export type ShotCtx = {
  cmdZ: number;
  form: { front: number; back: number; midZ: number; width: number };
  castle: { width: number; height: number; front: number; back: number; midZ: number; midY: number };
  fit: number;
  castleFit: number;
};

function pose(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): ShotPose {
  return { x, y, z, lx, ly, lz, fov };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerpPose(a: ShotPose, b: ShotPose, t: number): ShotPose {
  const e = t * t * (3 - 2 * t);
  return pose(lerp(a.x, b.x, e), lerp(a.y, b.y, e), lerp(a.z, b.z, e), lerp(a.lx, b.lx, e), lerp(a.ly, b.ly, e), lerp(a.lz, b.lz, e), lerp(a.fov, b.fov, e));
}

function keysFor(id: ShotId, ctx: ShotCtx): ShotPose[] {
  const { cmdZ, form, castle, castleFit } = ctx;
  const mid = form.midZ;
  const back = form.back;
  const gate = castle.front;
  const cm = castle.midZ;
  const cy = castle.midY;

  switch (id) {
    case "b":
      return [
        pose(10, cy + 70, cm + castleFit * 0.7, 0, cy * 0.5, cm, 42),
        pose(5, 14, back + 18, 0, 2.2, mid, 46),
        pose(1.1, 2.3, cmdZ - 8.5, 0.02, 1.2, cmdZ, 30),
      ];
    case "d":
      return [
        pose(16, 5.5, back + 10, -2, 1.5, mid, 38),
        pose(14, 8, mid + 6, -4, 1.8, gate + 4, 40),
        pose(22, 28, cm + 14, 0, cy * 0.5, cm, 42),
      ];
    case "g":
      return [
        pose(2, 48, mid + 8, 0, 0.4, mid, 50),
        pose(4, 32, back + 10, 0, 1.2, mid, 46),
        pose(6, 18, back + 20, 0, 2, gate, 42),
      ];
    case "l":
      return [
        pose(28, 7, back + 4, -8, 1.6, mid, 38),
        pose(12, 10, mid + 8, -4, 2, gate, 40),
        pose(4, 20, gate + 10, 0, cy * 0.4, cm, 42),
      ];
    case "n":
      return [
        pose(2, 3.2, cmdZ - 7, 0, 1.3, cmdZ, 34),
        pose(3, 22, mid + 4, 0, 2.5, mid, 42),
        pose(5, 72, mid + 10, 0, 4, mid, 48),
      ];
    case "p":
      return [
        pose(16, 55, back + 40, 0, 4, mid, 48),
        pose(10, 32, back + 24, 0, 3, mid, 44),
        pose(6, 14, back + 14, 0, 2.2, gate, 40),
      ];
    case "q":
      return [
        pose(20, 40, back + 18, -4, 2, mid, 42),
        pose(8, 12, mid + 6, -1, 1.8, gate, 36),
        pose(2, 3.2, cmdZ - 8, 0, 1.3, cmdZ, 30),
      ];
    case "r":
      return [
        pose(3, 8, gate - 10, 0, 3, mid, 40),
        pose(6, 12, mid - 6, 0, 2.2, back, 42),
        pose(10, 18, back + 16, 0, 2.6, mid, 44),
      ];
    case "w":
      return [
        pose(1.4, 2.4, cmdZ - 8, 0, 1.2, cmdZ, 32),
        pose(4, 14, back + 12, 0, 2.4, mid, 42),
        pose(7, cy + 68, cm + castleFit * 0.4, 0, cy * 0.75, cm, 38),
      ];
    case "y":
      return [
        pose(2, 80, mid + 6, 0, 1, mid, 52),
        pose(10, 36, mid + 14, 0, 2, mid, 46),
        pose(16, 14, back + 10, -4, 2.2, gate, 40),
      ];
    case "z":
      return [
        pose(2, 4, cmdZ - 7, 0, 1.4, cmdZ, 22),
        pose(5, 12, back + 10, 0, 2, mid, 48),
        pose(8, 28, back + 28, 0, 3, mid, 58),
      ];
  }
}

export function sampleShotMode(id: ShotId, recT: number, duration: number, skipCommander: boolean, ctx: ShotCtx): ShotPose {
  const raw = keysFor(id, ctx);
  const seq = skipCommander && raw.length > 2 ? raw.slice(1) : raw;
  const u = Math.max(0, Math.min(1, recT / Math.max(0.2, duration - 0.2)));
  if (seq.length === 1) return seq[0];
  if (seq.length === 2) return lerpPose(seq[0], seq[1], u);
  if (u < 0.42) return lerpPose(seq[0], seq[1], u / 0.42);
  return lerpPose(seq[1], seq[2], (u - 0.42) / 0.58);
}

/** Base timeline for the combined trailer. 60s and 90s stretch this. */
export const CINEMA_BASE = 30;
export const CINEMA_DURATIONS = [30, 60, 90] as const;
export type CinemaDuration = (typeof CINEMA_DURATIONS)[number];
/** On the 30s timeline, when Kaleden orduya starts — sally doors begin here. */
export const CINEMA_GATE_AT = 7.4;
export const CINEMA_SWORD_P = 9.5;

export function cinemaGateAt(duration: number) {
  return CINEMA_GATE_AT * (Math.max(CINEMA_BASE, duration) / CINEMA_BASE);
}

export function cinemaScale(duration: number) {
  return Math.max(CINEMA_BASE, duration) / CINEMA_BASE;
}

type CinemaCut = { at: number; dur: number; a: ShotPose; b: ShotPose };

/** Best beat of each kept shot, hard-cut like 300 / Troy / LOTR. Times are for 30s. */
function cinemaCuts(ctx: ShotCtx): CinemaCut[] {
  const d = keysFor("d", ctx);
  const p = keysFor("p", ctx);
  const y = keysFor("y", ctx);
  const r = keysFor("r", ctx);
  const l = keysFor("l", ctx);
  const g = keysFor("g", ctx);
  const q = keysFor("q", ctx);
  const b = keysFor("b", ctx);
  const z = keysFor("z", ctx);
  const n = keysFor("n", ctx);
  const w = keysFor("w", ctx);
  return [
    { at: 0, dur: 2.4, a: d[0], b: d[1] },
    { at: 2.4, dur: 2.6, a: p[0], b: p[1] },
    { at: 5, dur: 2.4, a: y[0], b: y[1] },
    { at: 7.4, dur: 2.8, a: r[0], b: r[2] },
    { at: 10.2, dur: 2.6, a: l[0], b: l[1] },
    { at: 12.8, dur: 2.2, a: g[0], b: g[1] },
    { at: 15, dur: 2.6, a: q[0], b: q[2] },
    { at: 17.6, dur: 2.4, a: b[0], b: b[2] },
    { at: 20, dur: 2.4, a: z[0], b: z[2] },
    { at: 22.4, dur: 2.6, a: n[0], b: n[2] },
    { at: 25, dur: 5, a: w[0], b: w[2] },
  ];
}

export function sampleCinema(recT: number, duration: number, ctx: ShotCtx): ShotPose {
  const cuts = cinemaCuts(ctx);
  const t = Math.max(0, recT) / cinemaScale(duration);
  let cut = cuts[0];
  for (let i = 0; i < cuts.length; i++) {
    if (t >= cuts[i].at) cut = cuts[i];
  }
  const u = Math.max(0, Math.min(1, (t - cut.at) / Math.max(0.08, cut.dur)));
  return lerpPose(cut.a, cut.b, u);
}
