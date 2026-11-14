/**
 * 14112026 — ilham videosunun ALTERNATİFİ (çember kuşatma kopyası değil).
 *
 * Viral DNA: gün sayacı + isimli takipçi ordusu + sayı baskısı + takip CTA.
 * Farklı format: kırmızı SEL yukarıdan akar → iki YANA KISKAÇ kapanır →
 * isimli ada büyür → ortadan KIRILIP çıkar. Geometri ≠ eşmerkezli çember.
 */
export const D14112026_ID = "14112026" as const;
export type D14112026Id = typeof D14112026_ID;
export const D14112026_MODE = { id: D14112026_ID, label: "14112026" } as const;
export const D14112026_SECONDS = 15;
/** Sahada yalnızca son katılan bu kadar takipçi. */
export const D14112026_FRIENDS = 100;

const PITCH = 2.28;

/** Son katılan takipçiler (isim listesinin sonu). */
export function d1411Roster(names: string[], soldiers: number) {
  const cap = D14112026_FRIENDS;
  const n = Math.max(1, Math.min(cap, Math.floor(soldiers) || names.length || 1));
  const cleaned = names.map((s) => String(s ?? "").trim()).filter(Boolean);
  const slice = cleaned.length > n ? cleaned.slice(-n) : cleaned;
  // Asker sayısı isimden azsa yine n kadar slot (isimler döner)
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

export type D1411Form = {
  friends: number;
  foes: number;
  pitch: number;
  width: number;
  depth: number;
  islandR: number;
  wallW: number;
  wallD: number;
};

export function d1411Form(friendsIn: number): D1411Form {
  const friends = Math.max(1, Math.min(D14112026_FRIENDS, Math.floor(friendsIn)));
  // Eski ~4×’in yarısı → ~2×; yine bizden kalabalık
  const foes = Math.max(friends * 2, friends + 20);
  const islandR = Math.max(4.5, Math.sqrt(friends) * 1.15);
  const wallW = Math.max(22, islandR * 3.4 + 10);
  const wallD = Math.max(10, Math.ceil(foes / 28) * PITCH * 0.9);
  return {
    friends,
    foes,
    pitch: PITCH,
    width: wallW,
    depth: wallD + islandR * 2 + 28,
    islandR,
    wallW,
    wallD,
  };
}

export type D1411Layout = D1411Form & {
  friendX: Float32Array;
  friendZ: Float32Array;
  friendPhase: Float32Array;
  /** 0 = left jaw, 1 = right jaw */
  foeSide: Uint8Array;
  romanX: Float32Array;
  romanZ: Float32Array;
  romanPhase: Float32Array;
  liveX: Float32Array;
  liveZ: Float32Array;
};

/** Dense disk island — readable “we are the named few”. */
function islandSeat(count: number, i: number, rMax: number, pitch: number) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const t = (i + 0.5) / Math.max(1, count);
  const r = Math.sqrt(t) * rMax;
  const a = i * golden;
  // slight lattice so they don’t look like a perfect circle copy of ilham
  const x = Math.cos(a) * r + ((i % 5) - 2) * pitch * 0.04;
  const z = Math.sin(a) * r * 0.78 + ((i % 3) - 1) * pitch * 0.05;
  return { x, z };
}

/** Foe seats: start as TOP flood band, animated into left/right jaws. */
function foeSeat(count: number, i: number, wallW: number, wallD: number, pitch: number) {
  const cols = Math.max(10, Math.ceil(wallW / pitch));
  const rows = Math.max(3, Math.ceil(count / cols));
  const col = i % cols;
  const row = Math.floor(i / cols);
  const inRow = row === rows - 1 ? count - row * cols : cols;
  const x = (col - (inRow - 1) / 2) * pitch * 0.95;
  const z = row * pitch * 0.85;
  const side = col < inRow / 2 ? 0 : 1;
  return { x, z, side };
}

export function makeD1411Layout(friendsIn: number): D1411Layout {
  const form = d1411Form(friendsIn);
  const layout: D1411Layout = {
    ...form,
    friendX: new Float32Array(form.friends),
    friendZ: new Float32Array(form.friends),
    friendPhase: new Float32Array(form.friends),
    foeSide: new Uint8Array(form.foes),
    romanX: new Float32Array(form.foes),
    romanZ: new Float32Array(form.foes),
    romanPhase: new Float32Array(form.foes),
    liveX: new Float32Array(form.friends),
    liveZ: new Float32Array(form.friends),
  };
  for (let i = 0; i < form.friends; i++) {
    const s = islandSeat(form.friends, i, form.islandR, form.pitch);
    layout.friendX[i] = s.x;
    layout.friendZ[i] = s.z - 1.2;
    layout.friendPhase[i] = (i % 17) * 0.37;
  }
  for (let i = 0; i < form.foes; i++) {
    const s = foeSeat(form.foes, i, form.wallW, form.wallD, form.pitch);
    layout.romanX[i] = s.x;
    layout.romanZ[i] = s.z;
    layout.foeSide[i] = s.side;
    layout.romanPhase[i] = (i % 19) * 0.31;
  }
  return layout;
}

export type D1411Pose = { x: number; z: number; yaw: number; pitch: number; roll: number; show: boolean };

/**
 * Timeline (15s):
 * 0–1.2  flood tip already in frame (stop scroll)
 * 1.2–3.5 jaws form + names spawn (new beat)
 * 3.5–7.5 jaws slam shut
 * 7.5–11 breakthrough corridor
 * 11–15 name cam + CTA hold
 */
export function d1411Knight(layout: D1411Layout, i: number, t: number): D1411Pose {
  const phase = layout.friendPhase[i];
  // Spawn reveal: island fills so early frames already have some names, then densifies
  const reveal = easeOut(clamp01((t - i * 0.035) / 1.05));
  const brace = easeInOut(clamp01((t - 3.2) / 3.8));
  const breakU = easeOut(clamp01((t - 7.6) / 2.4));
  const sway = Math.sin(t * 1.15 + phase) * 0.035;
  const x0 = layout.friendX[i];
  const z0 = layout.friendZ[i];
  // Pack tighter under pressure, then surge +Z through the jaw gap
  const pack = 1 - brace * 0.18;
  const surgeZ = breakU * (layout.islandR * 1.8 + 10);
  const surgeX = -x0 * breakU * 0.35; // funnel toward center lane
  return {
    x: x0 * pack + sway + surgeX,
    z: z0 * pack + surgeZ,
    yaw: Math.atan2(0.01, 1) + sway * 0.6,
    pitch: -0.05 - brace * 0.03,
    roll: sway * 0.02,
    show: reveal > 0.12,
  };
}

export function d1411Roman(layout: D1411Layout, i: number, t: number): D1411Pose {
  const phase = layout.romanPhase[i];
  const side = layout.foeSide[i] === 0 ? -1 : 1;
  const flood = easeOut(clamp01(t / 1.15)); // already pouring at t=0→1
  const jaw = easeInOut(clamp01((t - 1.1) / 2.4));
  const slam = easeInOut(clamp01((t - 3.4) / 3.6));
  const hold = easeOut(clamp01((t - 7.4) / 1.2));
  const sway = Math.sin(t * 0.9 + phase) * 0.03;

  // Rest pose: top band above island
  const restX = layout.romanX[i];
  const restZ = 8 + layout.islandR + layout.romanZ[i];

  // Flood comes down toward island
  const floodZ = restZ - flood * (5.5 + layout.islandR * 0.35);

  // Split into jaws: left/right and close in
  const jawX = restX + side * (6.5 + layout.islandR * 0.55) * jaw;
  const jawZ = floodZ - slam * (3.8 + layout.islandR * 0.25);

  // After breakthrough, jaws stall slightly open at center lane
  const openLane = hold * 2.4;
  const x = jawX - side * openLane * 0.35 + sway;
  const z = jawZ;

  // Yüz her zaman bizim adaya (isimli askerlere) dönük
  const faceX = 0;
  const faceZ = -1.2;
  const yaw = Math.atan2(faceX - x, faceZ - z);

  return {
    x,
    z,
    yaw,
    pitch: -0.04,
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
  const r = form.islandR;

  // High 3/4 — flood + island readable in first frame (not flat top-down circle shot)
  const open: Cam = {
    x: 2.2,
    y: 16 + r * 0.55,
    z: -r * 1.1 - 8,
    lx: 0,
    ly: 1.1,
    lz: r * 0.2,
    fov: 44,
  };
  // Drop as jaws close — pressure readable
  const squeeze: Cam = {
    x: -1.4,
    y: 11 + r * 0.25,
    z: -r * 0.4 - 4,
    lx: 0,
    ly: 1.3,
    lz: 1.5,
    fov: 46,
  };
  // Breakthrough follow
  const breakCam: Cam = {
    x: 0.8,
    y: 6.5,
    z: -2.2,
    lx: 0,
    ly: 1.6,
    lz: 6,
    fov: 48,
  };
  // Name payoff
  const names: Cam = {
    x: 1.6,
    y: 4.2,
    z: -r * 0.15 - 2.2,
    lx: 0.3,
    ly: 1.85,
    lz: 1.2,
    fov: 40,
  };

  if (t < 1.15) return mixCam(open, open, 0);
  if (t < 3.5) return mixCam(open, squeeze, easeOut((t - 1.15) / 2.35));
  if (t < 7.6) return mixCam(squeeze, squeeze, 0);
  if (t < 11.0) return mixCam(squeeze, breakCam, easeInOut((t - 7.6) / 3.4));
  return mixCam(breakCam, names, easeInOut((t - 11.0) / 3.2));
}

export function d1411Far(friends: number) {
  const form = d1411Form(friends);
  return Math.max(420, form.depth * 8 + form.width * 3 + 140);
}

export function d1411Haze(friends: number) {
  const form = d1411Form(friends);
  const far = Math.max(340, form.width * 2 + form.depth * 2.8 + 120);
  return { near: 55, far };
}

export type D1411Caption = { title: string; sub: string; accent: "white" | "red" | "gold" };

export function d1411Caption(t: number, day: number): D1411Caption | null {
  const d = Math.max(1, Math.floor(day) || 1);
  if (t < 2.8) {
    return {
      title: `GÜN ${d}`,
      sub: "Takipçilerimle ayaktayız — düşman sel gibi",
      accent: "white",
    };
  }
  if (t < 6.2) {
    return {
      title: "İKİ YANDAN",
      sub: "Kıskaç kapanıyor",
      accent: "red",
    };
  }
  if (t < 9.8) {
    return {
      title: "TAKİP ET · ORDUYA YAZIL",
      sub: "1 takip = 1 asker — ismini gör",
      accent: "gold",
    };
  }
  return {
    title: "YARIN SEN DE BURADASIN",
    sub: "Takip et, orduya yazıl",
    accent: "gold",
  };
}
