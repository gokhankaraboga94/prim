export type ShotId =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

export const SHOT_MODES: { id: ShotId; label: string }[] = [
  { id: "a", label: "A · Yakından uzağa" },
  { id: "b", label: "B · Uzaktan yakına" },
  { id: "c", label: "C · Film sahnesi" },
  { id: "d", label: "D · Sağ çapraz geriden" },
  { id: "e", label: "E · Sol çapraz ileriden" },
  { id: "f", label: "F · Yan takip" },
  { id: "g", label: "G · Tepe bakış" },
  { id: "h", label: "H · Alçak kahraman" },
  { id: "i", label: "I · Kale üzerinden orduya" },
  { id: "j", label: "J · Ordu üzerinden kaleye" },
  { id: "k", label: "K · Dairesel orbit" },
  { id: "l", label: "L · Sağ sweep" },
  { id: "m", label: "M · Sol sweep" },
  { id: "n", label: "N · Yukarı vinç" },
  { id: "o", label: "O · Omuz üzeri" },
  { id: "p", label: "P · Geniş ustalayan" },
  { id: "q", label: "Q · Çapraz dalış" },
  { id: "r", label: "R · Kaleden orduya" },
  { id: "s", label: "S · Yükselerek orbit" },
  { id: "t", label: "T · Alçaktan geçiş" },
  { id: "u", label: "U · Sağ omuz" },
  { id: "v", label: "V · Sol kanat" },
  { id: "w", label: "W · Geri ve yukarı" },
  { id: "x", label: "X · Yakın kaydırma" },
  { id: "y", label: "Y · Kuş bakışı" },
  { id: "z", label: "Z · Ters zoom" },
];

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
  const { cmdZ, form, castle, fit, castleFit } = ctx;
  const mid = form.midZ;
  const back = form.back;
  const gate = castle.front;
  const cm = castle.midZ;
  const cy = castle.midY;

  switch (id) {
    case "a":
      return [
        pose(1.2, 2.2, cmdZ - 9, 0, 1.2, cmdZ, 32),
        pose(4, 12, back + 16, 0, 2, mid, 44),
        pose(8, cy + 62, cm + castleFit * 0.45, 0, cy * 0.7, cm, 38),
      ];
    case "b":
      return [
        pose(10, cy + 70, cm + castleFit * 0.7, 0, cy * 0.5, cm, 42),
        pose(5, 14, back + 18, 0, 2.2, mid, 46),
        pose(1.1, 2.3, cmdZ - 8.5, 0.02, 1.2, cmdZ, 30),
      ];
    case "c":
      return [
        pose(18, 6.5, cmdZ + 2, 0, 1.6, mid, 36),
        pose(8, 9, back + 8, -2, 1.8, mid - 4, 40),
        pose(-16, 22, cm + 20, 0, cy * 0.45, cm, 38),
      ];
    case "d":
      return [
        pose(16, 5.5, back + 10, -2, 1.5, mid, 38),
        pose(14, 8, mid + 6, -4, 1.8, gate + 4, 40),
        pose(22, 28, cm + 14, 0, cy * 0.5, cm, 42),
      ];
    case "e":
      return [
        pose(-14, 4.2, gate + 8, 4, 2.2, mid, 36),
        pose(-10, 7, mid, 2, 1.8, cmdZ, 40),
        pose(-20, 24, back + 12, 0, 3, mid, 44),
      ];
    case "f":
      return [
        pose(-form.width * 0.7, 3.4, mid + 2, 4, 1.4, mid, 38),
        pose(0, 4.2, mid + 6, 0, 1.5, gate, 40),
        pose(form.width * 0.75, 8, mid + 4, -4, 1.8, mid, 42),
      ];
    case "g":
      return [
        pose(2, 48, mid + 8, 0, 0.4, mid, 50),
        pose(4, 32, back + 10, 0, 1.2, mid, 46),
        pose(6, 18, back + 20, 0, 2, gate, 42),
      ];
    case "h":
      return [
        pose(0.8, 0.85, cmdZ - 6.2, 0.1, 1.55, cmdZ, 28),
        pose(2.2, 1.4, mid + 4, 0, 2.4, gate, 34),
        pose(6, 10, back + 18, 0, 3, mid, 42),
      ];
    case "i":
      return [
        pose(4, cy + 28, cm - 8, 0, 4, mid, 40),
        pose(6, 16, mid, 0, 2, cmdZ, 42),
        pose(3, 5, back + 8, 0, 1.6, mid, 38),
      ];
    case "j":
      return [
        pose(3, 16, back + 12, 0, 2, mid, 44),
        pose(5, cy + 10, mid - 4, 0, cy * 0.4, cm, 40),
        pose(2, cy + 36, cm + castleFit * 0.35, 0, cy * 0.55, cm, 38),
      ];
    case "k":
      return [
        pose(22, 9, mid + 6, 0, 1.8, mid, 40),
        pose(0, 12, back + 22, 0, 2, mid, 44),
        pose(-24, 16, mid - 4, 0, 2.4, gate, 42),
      ];
    case "l":
      return [
        pose(28, 7, back + 4, -8, 1.6, mid, 38),
        pose(12, 10, mid + 8, -4, 2, gate, 40),
        pose(4, 20, gate + 10, 0, cy * 0.4, cm, 42),
      ];
    case "m":
      return [
        pose(-26, 6.5, back + 6, 8, 1.5, mid, 38),
        pose(-12, 9, mid + 4, 4, 2, gate, 40),
        pose(-6, 22, gate + 8, 0, cy * 0.4, cm, 42),
      ];
    case "n":
      return [
        pose(2, 3.2, cmdZ - 7, 0, 1.3, cmdZ, 34),
        pose(3, 22, mid + 4, 0, 2.5, mid, 42),
        pose(5, 72, mid + 10, 0, 4, mid, 48),
      ];
    case "o":
      return [
        pose(1.6, 2.6, back + 3, 0, 1.5, cmdZ, 36),
        pose(2.4, 3.4, mid + 2, 0, 1.7, gate, 38),
        pose(8, 14, mid + 16, 0, 3, gate, 44),
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
    case "s":
      return [
        pose(14, 5, cmdZ + 4, -2, 1.6, mid, 36),
        pose(0, 16, back + 14, 0, 2.4, mid, 42),
        pose(-18, 34, cm + 8, 4, cy * 0.5, cm, 40),
      ];
    case "t":
      return [
        pose(-6, 1.6, back + 2, 2, 1.4, gate, 34),
        pose(0, 2.2, mid, 0, 1.8, gate, 36),
        pose(8, 6, gate + 6, -2, 2.4, cm, 40),
      ];
    case "u":
      return [
        pose(3.4, 2.1, cmdZ - 5.5, -0.4, 1.25, cmdZ, 30),
        pose(6, 4.5, mid, -2, 1.8, gate, 36),
        pose(12, 16, mid + 12, -2, 3, gate, 42),
      ];
    case "v":
      return [
        pose(-form.width * 0.45, 3, back + 2, 3, 1.5, mid, 38),
        pose(-form.width * 0.25, 5, mid, 2, 1.8, gate, 40),
        pose(-8, 18, gate + 10, 2, 3, cm, 44),
      ];
    case "w":
      return [
        pose(1.4, 2.4, cmdZ - 8, 0, 1.2, cmdZ, 32),
        pose(4, 14, back + 12, 0, 2.4, mid, 42),
        pose(7, cy + 68, cm + castleFit * 0.4, 0, cy * 0.75, cm, 38),
      ];
    case "x":
      return [
        pose(-5, 2.6, cmdZ - 4, 2, 1.4, cmdZ, 32),
        pose(0, 2.8, cmdZ - 5, 0, 1.5, cmdZ, 34),
        pose(6, 3.2, cmdZ - 4, -2, 1.5, cmdZ + 2, 36),
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
    default:
      return [pose(4, 12, back + 16, 0, 2, mid, 44), pose(8, cy + 50, cm + castleFit * 0.5, 0, cy * 0.6, cm, 40)];
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

/** One 30s trailer: 8 hard cuts, like 300 / Troy / LOTR. */
export const CINEMA_DURATION = 30;
/** Video time when the gate shot starts — sally clock is aligned so doors begin here. */
export const CINEMA_GATE_AT = 4;
export const CINEMA_SWORD_P = 9.5;

type CinemaCut = { at: number; dur: number; a: ShotPose; b: ShotPose };

function cinemaCuts(ctx: ShotCtx): CinemaCut[] {
  const { cmdZ, form, castle, castleFit } = ctx;
  const mid = form.midZ;
  const back = form.back;
  const gate = castle.front;
  const cm = castle.midZ;
  const cy = castle.midY;
  return [
    {
      at: 0,
      dur: 4,
      a: pose(20, 4.4, back + 3, -8, 1.45, mid, 36),
      b: pose(17, 4.9, cmdZ + 1, -6, 1.55, cmdZ - 4, 34),
    },
    {
      at: 4,
      dur: 3.4,
      a: pose(7, 4.6, gate + 16, 0, 3.4, gate, 32),
      b: pose(4.2, 4.1, gate + 9, 0, 2.8, gate - 1, 30),
    },
    {
      at: 7.4,
      dur: 3.6,
      a: pose(11, 4.8, cmdZ - 3, -3, 1.7, gate + 10, 38),
      b: pose(8, 3.6, mid - 4, -1, 1.35, 34, 36),
    },
    {
      at: 11,
      dur: 3.8,
      a: pose(6.2, 1.9, cmdZ - 2, -1, 1.25, 47, 30),
      b: pose(4.4, 2.3, cmdZ - 3.5, 0, 1.35, 46, 28),
    },
    {
      at: 14.8,
      dur: 3.6,
      a: pose(15, 6.2, back + 2, -4, 1.7, 42, 40),
      b: pose(19, 10.5, back + 8, -2, 2.2, 36, 42),
    },
    {
      at: 18.4,
      dur: 3.8,
      a: pose(23, 12, back + 6, -6, 2.6, 30, 44),
      b: pose(25, 15, back + 12, -3, 3.2, 26, 44),
    },
    {
      at: 22.2,
      dur: 4.2,
      a: pose(16, 17, mid + 4, -2, 8, gate, 40),
      b: pose(10, cy + 18, gate + 18, 0, cy * 0.55, cm, 38),
    },
    {
      at: 26.4,
      dur: 3.6,
      a: pose(9, cy + 22, cm + castleFit * 0.28, 0, cy * 0.62, cm, 38),
      b: pose(14, cy + 58, cm + castleFit * 0.42, 0, cy * 0.8, cm + 4, 36),
    },
  ];
}

export function sampleCinema(recT: number, ctx: ShotCtx): ShotPose {
  const cuts = cinemaCuts(ctx);
  const t = Math.max(0, recT);
  let cut = cuts[0];
  for (let i = 0; i < cuts.length; i++) {
    if (t >= cuts[i].at) cut = cuts[i];
  }
  const u = Math.max(0, Math.min(1, (t - cut.at) / Math.max(0.08, cut.dur)));
  return lerpPose(cut.a, cut.b, u);
}
