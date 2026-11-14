/**
 * 14112026 — 10 savaşçı, eşit dağılım roman, tepeden bakış.
 * Sert seri vuruş (sağ / sol / karşı). Modeller hazır olmadan kayıt yok.
 */
export const D14112026_ID = "14112026" as const;
export type D14112026Id = typeof D14112026_ID;
export const D14112026_MODE = { id: D14112026_ID, label: "14112026" } as const;
export const D14112026_SECONDS = 30;
export const D14112026_FRIENDS = 10;
export const D14112026_FOES = 144;
export const D14112026_HERO = "/models/savaci.glb";
export const D14112026_ROMAN = "/models/roman.glb";
export const D14112026_URLS = [D14112026_HERO, D14112026_ROMAN] as const;

/** Yakın temas — gövde sabit, silah uzanır. */
const CONTACT = 1.05;
const APPROACH = 5.2;
/** Aggressive clip vuruş zirveleri. */
const STRIKE_T = [0.5, 1.05, 1.24];
/** Tek düşman için sert kısa vuruş. */
const ATTACK_LEN = 0.52;

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
function wrapPi(a: number) {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
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
  return { friends, foes, pitch: 2.1, width: 42, depth: 42 };
}

export function d1411Haze(_friends: number) {
  return { near: 55, far: 110 };
}
export function d1411Far(_friends: number) {
  return 180;
}

type Bout = {
  foe: number;
  tMove: number;
  tContact: number;
  tHit: number;
  tDone: number;
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

/** Sağ → sol → karşı sırasıyla indir. */
function weaveSides(
  foes: number[],
  fx: number,
  fz: number,
  foeX0: Float32Array,
  foeZ0: Float32Array
) {
  const outward = Math.atan2(fx, fz);
  const items = foes.map((foe) => {
    const ang = Math.atan2(foeX0[foe] - fx, foeZ0[foe] - fz);
    return { foe, rel: wrapPi(ang - outward) };
  });
  const right = items.filter((x) => x.rel > 0.28).sort((a, b) => b.rel - a.rel);
  const left = items.filter((x) => x.rel < -0.28).sort((a, b) => a.rel - b.rel);
  const front = items.filter((x) => Math.abs(x.rel) <= 0.28).sort((a, b) => Math.abs(a.rel) - Math.abs(b.rel));
  const out: number[] = [];
  let ri = 0;
  let li = 0;
  let fi = 0;
  let turn = 0;
  while (out.length < items.length) {
    const slot = turn % 3;
    if (slot === 0 && ri < right.length) out.push(right[ri++].foe);
    else if (slot === 1 && li < left.length) out.push(left[li++].foe);
    else if (slot === 2 && fi < front.length) out.push(front[fi++].foe);
    else if (ri < right.length) out.push(right[ri++].foe);
    else if (li < left.length) out.push(left[li++].foe);
    else if (fi < front.length) out.push(front[fi++].foe);
    turn++;
  }
  return out;
}

function ensureSim(friends: number): Sim {
  const n = Math.max(1, Math.min(D14112026_FRIENDS, friends));
  if (SIM && SIM.friendX0.length === n) return SIM;

  const friendX0 = new Float32Array(n);
  const friendZ0 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    friendX0[i] = Math.sin(a) * 2.4;
    friendZ0[i] = Math.cos(a) * 2.4;
  }

  const foeX0 = new Float32Array(D14112026_FOES);
  const foeZ0 = new Float32Array(D14112026_FOES);
  const foeOwner = new Int16Array(D14112026_FOES);
  const counts = new Int16Array(n);

  // Eşit dağılım: her düşman sırayla bir askere
  for (let i = 0; i < D14112026_FOES; i++) {
    const owner = i % n;
    foeOwner[i] = owner;
    const k = counts[owner]++;
    const fx = friendX0[owner];
    const fz = friendZ0[owner];
    const outward = Math.atan2(fx, fz);
    const per = Math.ceil(D14112026_FOES / n);
    const spread = (k - (per - 1) / 2) * (2.4 / Math.max(1, per));
    const ring = 6.4 + (k % 4) * 2.35 + (owner % 3) * 0.35;
    const a = outward + spread;
    foeX0[i] = fx + Math.sin(a) * ring;
    foeZ0[i] = fz + Math.cos(a) * ring;
  }

  const queues: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < D14112026_FOES; i++) queues[foeOwner[i]].push(i);

  const dieAt = new Float32Array(D14112026_FOES);
  dieAt.fill(1e9);
  const bouts: Bout[][] = Array.from({ length: n }, () => []);

  for (let f = 0; f < n; f++) {
    const ordered = weaveSides(queues[f], friendX0[f], friendZ0[f], foeX0, foeZ0);
    let t = 0.28 + f * 0.09;
    const cx = friendX0[f];
    const cz = friendZ0[f];
    for (const foe of ordered) {
      const fx = foeX0[foe];
      const fz = foeZ0[foe];
      const dist = Math.hypot(fx - cx, fz - cz);
      const moveDur = Math.max(0.18, Math.min(0.55, (dist - CONTACT) / APPROACH));
      const tMove = t;
      const tContact = t + moveDur;
      const tHit = tContact + 0.06;
      const tDone = tContact + ATTACK_LEN;
      bouts[f].push({ foe, tMove, tContact, tHit, tDone });
      dieAt[foe] = tHit;
      t = tDone + 0.02;
      if (t > D14112026_SECONDS - 0.8) break;
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
  const x = sim.friendX0[i];
  const z = sim.friendZ0[i];
  if (!b) {
    return { x, z, yaw: Math.atan2(x, z), pitch: -0.04, roll: 0, show: true, clipTime: 0.2, attacking: false, dead: false };
  }

  const foe = d1411RomanPos(sim, b.foe, t);
  const yaw = Math.atan2(foe.x - x, foe.z - z);
  let attacking = false;
  let clipTime = 0.18;

  if (t >= b.tContact && t < b.tDone) {
    attacking = true;
    const local = Math.max(0, t - b.tContact);
    const u = clamp01(local / ATTACK_LEN);
    // Sert vuruş: strike zirvesine hızlı bas
    const hit = STRIKE_T[Math.min(STRIKE_T.length - 1, Math.floor(u * STRIKE_T.length))];
    clipTime = hit + u * 0.08;
  } else if (t >= b.tMove) {
    clipTime = STRIKE_T[0] * 0.55;
  }

  return { x, z, yaw, pitch: -0.05, roll: 0, show: true, clipTime, attacking, dead: false };
}

function d1411RomanPos(sim: Sim, i: number, t: number) {
  const die = sim.dieAt[i];
  const owner = Math.max(0, sim.foeOwner[i]);
  const fx0 = sim.friendX0[owner];
  const fz0 = sim.friendZ0[owner];
  const x0 = sim.foeX0[i];
  const z0 = sim.foeZ0[i];
  const dx = fx0 - x0;
  const dz = fz0 - z0;
  const dist = Math.hypot(dx, dz) || 1;
  const stop = CONTACT;
  const travel = Math.max(0, dist - stop);
  const arrive = clamp01(t / Math.max(0.15, die - 0.35));
  return {
    x: x0 + (dx / dist) * travel * easeInOut(arrive),
    z: z0 + (dz / dist) * travel * easeInOut(arrive),
  };
}

export function d1411Roman(layout: D1411Layout, i: number, t: number): D1411Pose {
  const sim = ensureSim(layout.friends);
  const die = sim.dieAt[i];
  const { x, z } = d1411RomanPos(sim, i, t);

  let tx = layout.liveX[0] ?? sim.friendX0[0];
  let tz = layout.liveZ[0] ?? sim.friendZ0[0];
  let nearest = 1e9;
  for (let f = 0; f < layout.friends; f++) {
    const lx = layout.liveX[f] ?? sim.friendX0[f];
    const lz = layout.liveZ[f] ?? sim.friendZ0[f];
    const d = Math.hypot(lx - x, lz - z);
    if (d < nearest) {
      nearest = d;
      tx = lx;
      tz = lz;
    }
  }

  // roman.glb +X; en yakın askerimize yüz
  const yaw = Math.atan2(tx - x, tz - z) - Math.PI / 2;

  const dead = t >= die;
  const fall = dead ? Math.min(1, (t - die) / 0.4) : 0;

  return {
    x,
    z,
    yaw,
    pitch: fall * 1.3,
    roll: fall * 0.4 * ((i % 2) * 2 - 1),
    show: !dead || fall < 0.98,
    clipTime: 0,
    attacking: false,
    dead,
  };
}

type Cam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

/** Sabit tepeden — tüm alan görünsün. */
export function d1411Cam(_t: number, friends = 1): Cam {
  const form = d1411Form(friends);
  const span = Math.max(form.width, form.depth);
  return {
    x: 0.05,
    y: Math.max(26, span * 0.72),
    z: 0.05,
    lx: 0,
    ly: 0.6,
    lz: 0,
    fov: 40,
  };
}

export type D1411Caption = { title: string; sub: string; accent: "white" | "red" | "gold" };

export function d1411Caption(t: number, day: number): D1411Caption | null {
  const d = Math.max(1, Math.floor(day) || 1);
  if (t < 1.1) return null;
  if (t < 5) return { title: `GÜN ${d}`, sub: "10 savaşçı — eşit yük, her yönden", accent: "white" };
  if (t < 12) return { title: "SAĞ · SOL · KARŞI", sub: "Sert vuruş, tek tek indir", accent: "red" };
  if (t < 20) return { title: "TAKİP ET · ORDUYA YAZIL", sub: "1 takip = 1 asker", accent: "gold" };
  if (t < 26) return { title: "KALABALIK ERİYOR", sub: "İsmini görüyorsan buradasın", accent: "gold" };
  return { title: "YARIN SEN DE", sub: "Takip et — orduya yazıl", accent: "white" };
}
