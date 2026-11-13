/** 14112026 — ilham videosunun alternatifi: çember kuşatma değil, mızrak/wedge vs düşman duvarı. */
export const D14112026_ID = "14112026" as const;
export type D14112026Id = typeof D14112026_ID;
export const D14112026_MODE = { id: D14112026_ID, label: "14112026" } as const;
export const D14112026_SECONDS = 16;

const PITCH = 2.35;

export function isD14112026(id: string | null | undefined): id is D14112026Id {
  return id === D14112026_ID;
}

function clamp01(u: number) {
  return Math.max(0, Math.min(1, u));
}

function easeOut(u: number) {
  const x = clamp01(u);
  return 1 - (1 - x) * (1 - x);
}

function easeInOut(u: number) {
  const x = clamp01(u);
  return x * x * (3 - 2 * x);
}

export type D1411Form = {
  friends: number;
  foes: number;
  cols: number;
  rows: number;
  foeCols: number;
  foeRows: number;
  pitch: number;
  gap: number;
  width: number;
  depth: number;
  friendDepth: number;
  foeDepth: number;
};

export function d1411Form(friendsIn: number): D1411Form {
  const friends = Math.max(1, Math.floor(friendsIn));
  const foes = Math.max(friends * 3, friends + 24);
  // Wedge: narrower tip, deeper ranks
  const cols = Math.max(3, Math.ceil(Math.sqrt(friends * 0.85)));
  const rows = Math.max(2, Math.ceil(friends / cols));
  const foeCols = Math.max(cols + 4, Math.ceil(Math.sqrt(foes * 1.35)));
  const foeRows = Math.max(4, Math.ceil(foes / foeCols));
  const friendDepth = Math.max(0, rows - 1) * PITCH;
  const foeDepth = Math.max(0, foeRows - 1) * PITCH;
  const gap = 14 + Math.min(18, Math.sqrt(friends) * 0.55);
  const width = Math.max((cols - 1) * PITCH, (foeCols - 1) * PITCH);
  return {
    friends,
    foes,
    cols,
    rows,
    foeCols,
    foeRows,
    pitch: PITCH,
    gap,
    width,
    depth: friendDepth + foeDepth,
    friendDepth,
    foeDepth,
  };
}

export type D1411Layout = D1411Form & {
  friendX: Float32Array;
  friendZ: Float32Array;
  friendRow: Uint16Array;
  friendPhase: Float32Array;
  romanX: Float32Array;
  romanZ: Float32Array;
  romanRow: Uint16Array;
  romanPhase: Float32Array;
  liveX: Float32Array;
  liveZ: Float32Array;
};

/** Arrowhead / spear: front tip narrow, rear wider — not a circle. */
function wedgeSeat(cols: number, rows: number, count: number, i: number, pitch: number, zTip: number) {
  const row = Math.floor(i / cols);
  const col = i % cols;
  const inRow = row === rows - 1 ? count - row * cols : cols;
  // Tip at high z (toward enemy); rear rows get more lateral spread
  const tipFrac = 1 - row / Math.max(1, rows - 1);
  const rowWidth = Math.max(1, Math.round(inRow * (0.35 + tipFrac * 0.65)));
  const local = Math.min(col, rowWidth - 1);
  const x = (local - (rowWidth - 1) / 2) * pitch * (0.78 + (1 - tipFrac) * 0.45);
  const z = zTip - row * pitch;
  return { x, z, row };
}

function wallSeat(cols: number, rows: number, count: number, i: number, pitch: number, zFront: number) {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const inRow = row === rows - 1 ? count - row * cols : cols;
  const x = (col - (inRow - 1) / 2) * pitch * 0.92;
  const z = zFront + row * pitch * 0.88;
  return { x, z, row };
}

export function makeD1411Layout(friendsIn: number): D1411Layout {
  const form = d1411Form(friendsIn);
  const layout: D1411Layout = {
    ...form,
    friendX: new Float32Array(form.friends),
    friendZ: new Float32Array(form.friends),
    friendRow: new Uint16Array(form.friends),
    friendPhase: new Float32Array(form.friends),
    romanX: new Float32Array(form.foes),
    romanZ: new Float32Array(form.foes),
    romanRow: new Uint16Array(form.foes),
    romanPhase: new Float32Array(form.foes),
    liveX: new Float32Array(form.friends),
    liveZ: new Float32Array(form.friends),
  };
  const tipZ = -form.gap * 0.42;
  for (let i = 0; i < form.friends; i++) {
    const s = wedgeSeat(form.cols, form.rows, form.friends, i, form.pitch, tipZ);
    layout.friendX[i] = s.x;
    layout.friendZ[i] = s.z;
    layout.friendRow[i] = s.row;
    layout.friendPhase[i] = (i % 17) * 0.37;
  }
  const wallZ = form.gap * 0.42;
  for (let i = 0; i < form.foes; i++) {
    const s = wallSeat(form.foeCols, form.foeRows, form.foes, i, form.pitch, wallZ);
    layout.romanX[i] = s.x;
    layout.romanZ[i] = s.z;
    layout.romanRow[i] = s.row;
    layout.romanPhase[i] = (i % 19) * 0.31;
  }
  return layout;
}

export type D1411Pose = { x: number; z: number; yaw: number; pitch: number; roll: number; show: boolean };

/** March timeline: reveal → close gap → clash shake. */
export function d1411Knight(layout: D1411Layout, i: number, t: number): D1411Pose {
  const phase = layout.friendPhase[i];
  const row = layout.friendRow[i];
  const reveal = easeOut(clamp01((t - row * 0.07) / 1.15));
  const march = easeInOut(clamp01((t - 2.4) / 5.2));
  const clash = easeOut(clamp01((t - 8.1) / 1.4));
  const sway = Math.sin(t * 1.1 + phase) * 0.04;
  const charge = layout.gap * 0.38 * march;
  const punch = clash * (0.55 + (i % 5) * 0.08);
  const x0 = layout.friendX[i];
  const z0 = layout.friendZ[i];
  return {
    x: x0 + sway + Math.sin(t * 2.2 + phase) * clash * 0.12,
    z: z0 + charge + punch,
    yaw: sway * 0.8,
    pitch: -0.06 - march * 0.04,
    roll: sway * 0.02,
    show: reveal > 0.08,
  };
}

export function d1411Roman(layout: D1411Layout, i: number, t: number): D1411Pose {
  const phase = layout.romanPhase[i];
  const march = easeInOut(clamp01((t - 2.1) / 5.4));
  const clash = easeOut(clamp01((t - 8.1) / 1.4));
  const sway = Math.sin(t * 0.95 + phase) * 0.035;
  const advance = -layout.gap * 0.34 * march;
  const give = -clash * 0.35;
  return {
    x: layout.romanX[i] + sway,
    z: layout.romanZ[i] + advance + give,
    yaw: Math.PI + sway * 0.5,
    pitch: -0.05,
    roll: sway * 0.015,
    show: true,
  };
}

type Cam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

function mixCam(a: Cam, b: Cam, u: number): Cam {
  const k = clamp01(u);
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    z: a.z + (b.z - a.z) * k,
    lx: a.lx + (b.lx - a.lx) * k,
    ly: a.ly + (b.ly - a.ly) * k,
    lz: a.lz + (b.lz - a.lz) * k,
    fov: a.fov + (b.fov - a.fov) * k,
  };
}

export function d1411Cam(t: number, friends = 1): Cam {
  const form = d1411Form(Math.max(1, friends));
  const span = Math.max(form.width, form.depth + form.gap);
  // 3/4 rear view of wedge — NOT top-down circle
  const open: Cam = {
    x: span * 0.08,
    y: 9.5 + span * 0.045,
    z: -form.gap * 0.95 - form.friendDepth * 0.55 - 10,
    lx: 0,
    ly: 1.3,
    lz: form.gap * 0.15,
    fov: 46,
  };
  const mid: Cam = {
    x: -span * 0.06,
    y: 14 + span * 0.06,
    z: -form.gap * 0.35 - 6,
    lx: 0,
    ly: 1.2,
    lz: form.gap * 0.25,
    fov: 44,
  };
  const clash: Cam = {
    x: span * 0.04,
    y: 7.2 + span * 0.02,
    z: -2.5,
    lx: 0,
    ly: 1.5,
    lz: 3.2,
    fov: 48,
  };
  const names: Cam = {
    x: 1.2,
    y: 4.8,
    z: -form.gap * 0.2 - 3.5,
    lx: 0.4,
    ly: 1.8,
    lz: -form.gap * 0.15,
    fov: 42,
  };

  if (t < 1.0) return open;
  if (t < 3.2) return mixCam(open, mid, easeOut((t - 1.0) / 2.2));
  if (t < 8.0) return mixCam(mid, clash, easeInOut((t - 3.2) / 4.8));
  if (t < 11.5) return mixCam(clash, names, easeInOut((t - 8.0) / 3.5));
  return names;
}

export function d1411Far(friends: number) {
  const form = d1411Form(friends);
  return Math.max(480, form.depth * 9 + form.width * 4 + form.gap * 6 + 160);
}

export function d1411Haze(friends: number) {
  const form = d1411Form(friends);
  const far = Math.max(380, form.width * 2.2 + form.depth * 3.5 + 140);
  return { near: 70, far };
}

export type D1411Caption = { title: string; sub: string; accent: "white" | "red" | "gold" };

export function d1411Caption(t: number, day: number): D1411Caption | null {
  const d = Math.max(1, Math.floor(day) || 1);
  if (t < 3.1) {
    return {
      title: `GÜN ${d}`,
      sub: "Takipçilerle düşman duvarına gidiyoruz",
      accent: "white",
    };
  }
  if (t < 6.6) {
    return {
      title: "DUVAR DAHA KALIN",
      sub: "Ordumuz büyüyor — onlar daha kalabalık",
      accent: "red",
    };
  }
  if (t < 10.2) {
    return {
      title: "MIZRAK İLERİ",
      sub: "İsmini görüyorsan buradasın",
      accent: "gold",
    };
  }
  if (t < 14.8) {
    return {
      title: "TAKİP ET · ORDUYA YAZIL",
      sub: "1 takip = 1 asker",
      accent: "gold",
    };
  }
  return {
    title: "TAKİP ET",
    sub: "Sonraki günde sen de sahadasın",
    accent: "white",
  };
}
