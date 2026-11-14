/**
 * 14112026 — 10 savaşçı, her yönden roman, yakın temaslı seri vuruş.
 * TPS / FPS kesmeler, 30 sn. Modeller hazır olmadan kayıt yok.
 */
export const D14112026_ID = "14112026" as const;
export type D14112026Id = typeof D14112026_ID;
export const D14112026_MODE = { id: D14112026_ID, label: "14112026" } as const;
export const D14112026_SECONDS = 30;
export const D14112026_FRIENDS = 10;
export const D14112026_FOES = 48;
export const D14112026_HERO = "/models/savaci.glb";
export const D14112026_ROMAN = "/models/roman.glb";
export const D14112026_URLS = [D14112026_HERO, D14112026_ROMAN] as const;

/** Yakın temas — silah uzanır, gövde zıplamaz. */
const CONTACT = 0.95;
const APPROACH = 4.6;
/** Aggressive clip içindeki vuruş zirveleri (tekReel STRIKES). */
const STRIKE_T = [0.5, 1.05, 1.24];
const ATTACK_LEN = 0.92;

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];
let SIM: Sim | null = null;

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
  SIM = null;
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
function easeInOut(u: number) {
  const x = clamp01(u);
  return x * x * (3 - 2 * x);
}
function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u;
}

export type D1411Form = {
  friends: number;
  foes: number;
  pitch: number;
  width: number;
  depth: number;
};

export function d1411Form(friendsIn: number): D1411Form {
  const friends = Math.max(1, Math.min(D14112026_FRIENDS, Math.floor(friendsIn)));
  const foes = D14112026_FOES;
  return { friends, foes, pitch: 2.1, width: 36, depth: 36 };
}

export function d1411Haze(_friends: number) {
  return { near: 40, far: 90 };
}
export function d1411Far(_friends: number) {
  return 140;
}

type Bout = {
  foe: number;
  tMove: number;
  tContact: number;
  tHit: number;
  tDone: number;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
};

type Sim = {
  friendX0: Float32Array;
  friendZ0: Float32Array;
  foeX0: Float32Array;
  foeZ0: Float32Array;
  foeOwner: Int16Array;
  bouts: Bout[][];
  dieAt: Float32Array;
};

function ensureSim(friends: number): Sim {
  const n = Math.max(1, Math.min(D14112026_FRIENDS, friends));
  if (SIM && SIM.friendX0.length === n) return SIM;

  const friendX0 = new Float32Array(n);
  const friendZ0 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    friendX0[i] = Math.sin(a) * 2.1;
    friendZ0[i] = Math.cos(a) * 2.1;
  }

  const foeX0 = new Float32Array(D14112026_FOES);
  const foeZ0 = new Float32Array(D14112026_FOES);
  const foeOwner = new Int16Array(D14112026_FOES);
  for (let i = 0; i < D14112026_FOES; i++) {
    const ring = 7.5 + (i % 3) * 3.2;
    const a = (i / D14112026_FOES) * Math.PI * 2 + (i % 5) * 0.07;
    foeX0[i] = Math.sin(a) * ring;
    foeZ0[i] = Math.cos(a) * ring;
    let best = 0;
    let bestD = 1e9;
    for (let f = 0; f < n; f++) {
      const d = Math.hypot(foeX0[i] - friendX0[f], foeZ0[i] - friendZ0[f]);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    foeOwner[i] = best;
  }

  const queues: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < D14112026_FOES; i++) queues[foeOwner[i]].push(i);
  for (let f = 0; f < n; f++) {
    queues[f].sort(
      (a, b) =>
        Math.hypot(foeX0[a] - friendX0[f], foeZ0[a] - friendZ0[f]) -
        Math.hypot(foeX0[b] - friendX0[f], foeZ0[b] - friendZ0[f])
    );
  }

  const dieAt = new Float32Array(D14112026_FOES);
  dieAt.fill(1e9);
  const bouts: Bout[][] = Array.from({ length: n }, () => []);

  for (let f = 0; f < n; f++) {
    let t = 0.35 + f * 0.18;
    let cx = friendX0[f];
    let cz = friendZ0[f];
    for (const foe of queues[f]) {
      const fx = foeX0[foe];
      const fz = foeZ0[foe];
      const dx = fx - cx;
      const dz = fz - cz;
      const dist = Math.hypot(dx, dz) || 1;
      const ux = dx / dist;
      const uz = dz / dist;
      const toX = fx - ux * CONTACT;
      const toZ = fz - uz * CONTACT;
      const moveDist = Math.hypot(toX - cx, toZ - cz);
      const moveDur = Math.max(0.14, Math.min(0.7, moveDist / APPROACH));
      const tMove = t;
      const tContact = t + moveDur;
      const tHit = tContact + 0.08;
      const tDone = tContact + ATTACK_LEN;
      bouts[f].push({ foe, tMove, tContact, tHit, tDone, fromX: cx, fromZ: cz, toX, toZ });
      dieAt[foe] = tHit;
      cx = toX;
      cz = toZ;
      t = tDone + 0.03;
      if (t > D14112026_SECONDS - 1.2) break;
    }
  }

  SIM = { friendX0, friendZ0, foeX0, foeZ0, foeOwner, bouts, dieAt };
  return SIM;
}

export type D1411Layout = D1411Form & {
  liveX: Float32Array;
  liveZ: Float32Array;
  hookSlot: number;
};

export function makeD1411Layout(friendsIn: number): D1411Layout {
  const form = d1411Form(friendsIn);
  const sim = ensureSim(form.friends);
  return {
    ...form,
    liveX: new Float32Array(sim.friendX0),
    liveZ: new Float32Array(sim.friendZ0),
    hookSlot: 0,
  };
}

export type D1411Pose = {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  show: boolean;
  clipTime: number;
  attacking: boolean;
  dead: boolean;
};

function boutAt(bouts: Bout[], t: number): Bout | null {
  for (const b of bouts) {
    if (t < b.tDone + 0.02) return b;
  }
  return bouts.length ? bouts[bouts.length - 1] : null;
}

export function d1411Knight(layout: D1411Layout, i: number, t: number): D1411Pose {
  const sim = ensureSim(layout.friends);
  const bouts = sim.bouts[i] || [];
  const b = boutAt(bouts, t);
  const x0 = sim.friendX0[i];
  const z0 = sim.friendZ0[i];
  if (!b) {
    return { x: x0, z: z0, yaw: 0, pitch: -0.04, roll: 0, show: true, clipTime: 0.2, attacking: false, dead: false };
  }

  let x = x0;
  let z = z0;
  let attacking = false;
  let clipTime = 0.15;

  if (t < b.tMove) {
    x = b.fromX;
    z = b.fromZ;
  } else if (t < b.tContact) {
    const u = easeInOut((t - b.tMove) / Math.max(0.01, b.tContact - b.tMove));
    x = lerp(b.fromX, b.toX, u);
    z = lerp(b.fromZ, b.toZ, u);
  } else {
    x = b.toX;
    z = b.toZ;
    attacking = t < b.tDone;
    const local = Math.max(0, t - b.tContact);
    // Seri vuruş: strike zirvelerini hızlı tara
    const cycle = (local / ATTACK_LEN) % 1;
    const hit = STRIKE_T[Math.min(STRIKE_T.length - 1, Math.floor(cycle * STRIKE_T.length))];
    clipTime = hit + (cycle * STRIKE_T.length) % 1 * 0.12;
  }

  const foe = d1411RomanPos(sim, b.foe, t);
  const yaw = Math.atan2(foe.x - x, foe.z - z);

  return { x, z, yaw, pitch: -0.05, roll: 0, show: true, clipTime, attacking, dead: false };
}

function d1411RomanPos(sim: Sim, i: number, t: number) {
  const die = sim.dieAt[i];
  const owner = sim.foeOwner[i];
  const fx0 = sim.friendX0[Math.max(0, owner)];
  const fz0 = sim.friendZ0[Math.max(0, owner)];
  const arrive = clamp01(t / Math.max(0.2, die - 0.4));
  const x0 = sim.foeX0[i];
  const z0 = sim.foeZ0[i];
  const dx = fx0 - x0;
  const dz = fz0 - z0;
  const dist = Math.hypot(dx, dz) || 1;
  const stop = CONTACT + 0.05;
  const travel = Math.max(0, dist - stop);
  return {
    x: x0 + (dx / dist) * travel * easeInOut(arrive),
    z: z0 + (dz / dist) * travel * easeInOut(arrive),
  };
}

export function d1411Roman(layout: D1411Layout, i: number, t: number): D1411Pose {
  const sim = ensureSim(layout.friends);
  const die = sim.dieAt[i];
  const owner = Math.max(0, sim.foeOwner[i]);
  const { x, z } = d1411RomanPos(sim, i, t);

  let tx = layout.liveX[owner] ?? sim.friendX0[owner];
  let tz = layout.liveZ[owner] ?? sim.friendZ0[owner];
  let nearest = 1e9;
  for (let f = 0; f < layout.friends; f++) {
    const lx = layout.liveX[f];
    const lz = layout.liveZ[f];
    if (!Number.isFinite(lx)) continue;
    const d = Math.hypot(lx - x, lz - z);
    if (d < nearest) {
      nearest = d;
      tx = lx;
      tz = lz;
    }
  }

  // roman.glb +X bakıyor (catalog / ordu); en yakın savaşçıya dön
  const yaw = Math.atan2(tx - x, tz - z) - Math.PI / 2;

  const dead = t >= die;
  const fall = dead ? Math.min(1, (t - die) / 0.45) : 0;

  return {
    x,
    z,
    yaw,
    pitch: fall * 1.25,
    roll: fall * 0.35 * ((i % 2) * 2 - 1),
    show: !dead || fall < 0.98,
    clipTime: 0,
    attacking: false,
    dead,
  };
}

type Cam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

export function d1411Cam(t: number, friends = 1): Cam {
  const form = d1411Form(friends);
  const sim = ensureSim(form.friends);
  const layout = makeD1411Layout(form.friends);
  // Update live from poses for cam target
  for (let i = 0; i < form.friends; i++) {
    const p = d1411Knight(layout, i, t);
    layout.liveX[i] = p.x;
    layout.liveZ[i] = p.z;
  }

  const slot = Math.min(form.friends - 1, Math.floor(t / 2.7) % form.friends);
  const hero = d1411Knight(layout, slot, t);
  const bout = boutAt(sim.bouts[slot] || [], t);
  const foeI = bout?.foe ?? 0;
  const foe = d1411Roman(layout, foeI, t);
  const hx = hero.x;
  const hz = hero.z;
  const fx = foe.x;
  const fz = foe.z;
  const dx = fx - hx;
  const dz = fz - hz;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;

  // TPS / FPS dönüşümlü
  const beat = Math.floor(t / 2.6) % 4;
  if (beat === 0 || beat === 2) {
    // FPS omuz/göz
    return {
      x: hx + ux * 0.15,
      y: 1.62,
      z: hz + uz * 0.15,
      lx: fx,
      ly: 1.35,
      lz: fz,
      fov: 58,
    };
  }
  if (beat === 1) {
    // TPS arkadan
    return {
      x: hx - ux * 3.4,
      y: 2.6,
      z: hz - uz * 3.4,
      lx: fx,
      ly: 1.2,
      lz: fz,
      fov: 42,
    };
  }
  // Geniş TPS — alan baskısı
  return {
    x: hx - uz * 2.2 - ux * 1.2,
    y: 7.5,
    z: hz + ux * 2.2 - uz * 1.2,
    lx: (hx + fx) * 0.5,
    ly: 1.1,
    lz: (hz + fz) * 0.5,
    fov: 40,
  };
}

export type D1411Caption = { title: string; sub: string; accent: "white" | "red" | "gold" };

export function d1411Caption(t: number, day: number): D1411Caption | null {
  const d = Math.max(1, Math.floor(day) || 1);
  if (t < 1.1) return null;
  if (t < 5) return { title: `GÜN ${d}`, sub: "10 savaşçı — her yönden geliyorlar", accent: "white" };
  if (t < 12) return { title: "YAKIN TEMAS", sub: "Geleni indir, sonrakine geç", accent: "red" };
  if (t < 20) return { title: "TAKİP ET · ORDUYA YAZIL", sub: "1 takip = 1 asker", accent: "gold" };
  if (t < 26) return { title: "KALABALIK ERİYOR", sub: "İsmini görüyorsan buradasın", accent: "gold" };
  return { title: "YARIN SEN DE", sub: "Takip et — orduya yazıl", accent: "white" };
}
