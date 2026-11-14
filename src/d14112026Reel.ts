/**
 * 14112026 — 99 puan hedefi (çember / kıskaç kopyası değil).
 *
 * Format: İSİM CLOSE-UP → patlayan zoom-out (ada + kırmızı PERDE) →
 * perde tek yönden yaklaşır → CTA isimde.
 *
 * Viral DNA korunur: gün, isimli takipçi, sayı baskısı, takip et.
 * Geometri farklı: eşmerkezli çember yok; tek cephe perde.
 */
export const D14112026_ID = "14112026" as const;
export type D14112026Id = typeof D14112026_ID;
export const D14112026_MODE = { id: D14112026_ID, label: "14112026" } as const;
export const D14112026_SECONDS = 14;
export const D14112026_FRIENDS = 100;
export const D14112026_KNIGHT = "/models/knight.glb";
export const D14112026_ROMAN = "/models/roman.glb";
export const D14112026_URLS = [D14112026_KNIGHT, D14112026_ROMAN] as const;

const PITCH = 2.15;

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function d1411MarkReady() {
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function d1411IsReady() {
  return ready;
}

export function d1411WhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function d1411Hold() {
  playAt = 0;
}

export function d1411Start() {
  playAt = performance.now() / 1000;
}

export function d1411T() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function d1411Reset() {
  ready = false;
  playAt = 0;
}

export function d1411Roster(names: string[], soldiers: number) {
  const cap = D14112026_FRIENDS;
  const n = Math.max(1, Math.min(cap, Math.floor(soldiers) || names.length || 1));
  const cleaned = names.map((s) => String(s ?? "").trim()).filter(Boolean);
  const slice = cleaned.length > n ? cleaned.slice(-n) : cleaned;
  return { soldiers: n, names: slice.length ? slice : cleaned.slice(-n) };
}

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

/** Hard ease for the 0→3s hook pull. */
function easeOutExpo(u: number) {
  const x = clamp01(u);
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

export type D1411Form = {
  friends: number;
  foes: number;
  pitch: number;
  width: number;
  depth: number;
  cols: number;
  rows: number;
  foeCols: number;
  foeRows: number;
  gap: number;
};

export function d1411Form(friendsIn: number): D1411Form {
  const friends = Math.max(1, Math.min(D14112026_FRIENDS, Math.floor(friendsIn)));
  const foes = Math.max(friends * 2, friends + 20);
  const cols = Math.max(8, Math.ceil(Math.sqrt(friends * 1.15)));
  const rows = Math.max(4, Math.ceil(friends / cols));
  const foeCols = Math.max(cols + 6, Math.ceil(Math.sqrt(foes * 1.2)));
  const foeRows = Math.max(5, Math.ceil(foes / foeCols));
  const gap = 16;
  return {
    friends,
    foes,
    pitch: PITCH,
    width: Math.max((cols - 1) * PITCH, (foeCols - 1) * PITCH * 0.95),
    depth: (rows - 1) * PITCH + (foeRows - 1) * PITCH + gap,
    cols,
    rows,
    foeCols,
    foeRows,
    gap,
  };
}

export type D1411Layout = D1411Form & {
  friendX: Float32Array;
  friendZ: Float32Array;
  friendPhase: Float32Array;
  romanX: Float32Array;
  romanZ: Float32Array;
  romanPhase: Float32Array;
  liveX: Float32Array;
  liveZ: Float32Array;
  /** Front-most friend index for close-up hook */
  hookSlot: number;
};

function packSeat(cols: number, rows: number, count: number, i: number, pitch: number, z0: number, zSign: number) {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const inRow = row === rows - 1 ? count - row * cols : cols;
  const x = (col - (inRow - 1) / 2) * pitch;
  const z = z0 + zSign * row * pitch;
  return { x, z, row, col };
}

export function makeD1411Layout(friendsIn: number): D1411Layout {
  const form = d1411Form(friendsIn);
  const layout: D1411Layout = {
    ...form,
    friendX: new Float32Array(form.friends),
    friendZ: new Float32Array(form.friends),
    friendPhase: new Float32Array(form.friends),
    romanX: new Float32Array(form.foes),
    romanZ: new Float32Array(form.foes),
    romanPhase: new Float32Array(form.foes),
    liveX: new Float32Array(form.friends),
    liveZ: new Float32Array(form.friends),
    hookSlot: 0,
  };

  // Friends: dense block, tip toward +Z (enemy). Front row = highest z among friends.
  const tipZ = -form.gap * 0.38;
  let bestZ = -1e9;
  let hook = 0;
  for (let i = 0; i < form.friends; i++) {
    const s = packSeat(form.cols, form.rows, form.friends, i, form.pitch, tipZ, -1);
    layout.friendX[i] = s.x;
    layout.friendZ[i] = s.z;
    layout.friendPhase[i] = (i % 17) * 0.37;
    if (s.z > bestZ) {
      bestZ = s.z;
      hook = i;
    }
  }
  layout.hookSlot = hook;

  // Foes: wide curtain wall at +Z
  const wallZ = form.gap * 0.42;
  for (let i = 0; i < form.foes; i++) {
    const s = packSeat(form.foeCols, form.foeRows, form.foes, i, form.pitch * 0.92, wallZ, 1);
    layout.romanX[i] = s.x;
    layout.romanZ[i] = s.z;
    layout.romanPhase[i] = (i % 19) * 0.31;
  }
  return layout;
}

export type D1411Pose = { x: number; z: number; yaw: number; pitch: number; roll: number; show: boolean };

export function d1411Knight(layout: D1411Layout, i: number, t: number): D1411Pose {
  const phase = layout.friendPhase[i];
  // All visible from frame 0 — close-up needs bodies; reveal is camera, not spawn
  const brace = easeInOut(clamp01((t - 3.0) / 4.5));
  const sway = Math.sin(t * 1.2 + phase) * 0.03;
  const x0 = layout.friendX[i];
  const z0 = layout.friendZ[i];
  // Slight pack under pressure; no long march (tempo stays on camera + wall)
  const pack = 1 - brace * 0.12;
  return {
    x: x0 * pack + sway,
    z: z0 * pack + brace * 0.8,
    yaw: sway * 0.5,
    pitch: -0.05,
    roll: sway * 0.015,
    show: true,
  };
}

export function d1411Roman(layout: D1411Layout, i: number, t: number): D1411Pose {
  const phase = layout.romanPhase[i];
  // Curtain already in frame at t=0; advances hard after reveal
  const creep = easeOut(clamp01(t / 0.9)) * 1.8;
  const slam = easeInOut(clamp01((t - 2.6) / 6.2));
  const sway = Math.sin(t * 0.95 + phase) * 0.025;
  const x = layout.romanX[i] + sway;
  const z = layout.romanZ[i] - creep - slam * (layout.gap * 0.55);

  // Face the named island
  const faceX = 0;
  const faceZ = -layout.gap * 0.25;
  const yaw = Math.atan2(faceX - x, faceZ - z);

  return {
    x,
    z,
    yaw,
    pitch: -0.04,
    roll: sway * 0.012,
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
  // Front-center friend (hook) without rebuilding layout each frame
  const tipZ = -form.gap * 0.38;
  const hx = 0;
  const hz = tipZ;

  // 0–0.85s: name fills the phone — stop the scroll
  const close: Cam = {
    x: hx + 0.35,
    y: 2.55,
    z: hz - 3.1,
    lx: hx,
    ly: 1.85,
    lz: hz + 0.4,
    fov: 38,
  };

  // 0.85–2.7s: explode out — island + red curtain readable together
  const wide: Cam = {
    x: 1.8,
    y: 14.5 + form.width * 0.04,
    z: -form.gap * 0.85 - 9,
    lx: 0,
    ly: 1.2,
    lz: form.gap * 0.12,
    fov: 44,
  };

  // Pressure: sit above the gap while curtain closes
  const press: Cam = {
    x: -1.1,
    y: 11.2,
    z: -form.gap * 0.25 - 5,
    lx: 0,
    ly: 1.35,
    lz: 2.2,
    fov: 46,
  };

  // CTA: back into names
  const names: Cam = {
    x: hx * 0.4 + 1.1,
    y: 4.4,
    z: hz - 4.2,
    lx: hx * 0.3,
    ly: 1.9,
    lz: hz + 1.2,
    fov: 40,
  };

  if (t < 0.85) return close;
  if (t < 2.7) return mixCam(close, wide, easeOutExpo((t - 0.85) / 1.85));
  if (t < 7.4) return mixCam(wide, press, easeInOut((t - 2.7) / 4.7));
  if (t < 10.5) return mixCam(press, names, easeInOut((t - 7.4) / 3.1));
  return names;
}

export function d1411Far(friends: number) {
  const form = d1411Form(friends);
  return Math.max(400, form.depth * 8 + form.width * 3 + 120);
}

export function d1411Haze(friends: number) {
  const form = d1411Form(friends);
  const far = Math.max(320, form.width * 2 + form.depth * 2.6 + 110);
  return { near: 48, far };
}

export type D1411Caption = { title: string; sub: string; accent: "white" | "red" | "gold" };

export function d1411Caption(t: number, day: number): D1411Caption | null {
  const d = Math.max(1, Math.floor(day) || 1);
  // First ~0.9s: no plate — isim close-up alone stops the thumb
  if (t < 0.95) return null;
  if (t < 3.1) {
    return {
      title: `GÜN ${d}`,
      sub: "Son 100 takipçi — ismini ara",
      accent: "white",
    };
  }
  if (t < 7.0) {
    return {
      title: "KIRMIZI PERDE",
      sub: "Ordumuz büyüyor, onlar daha kalabalık",
      accent: "red",
    };
  }
  if (t < 11.2) {
    return {
      title: "TAKİP ET · ORDUYA YAZIL",
      sub: "1 takip = 1 asker",
      accent: "gold",
    };
  }
  return {
    title: "YARIN İSMİN BURADA",
    sub: "Takip et — sonraki günde sen de sahadasın",
    accent: "gold",
  };
}
