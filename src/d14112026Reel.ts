/**
 * 14112026 — 10 savaşçı, tepeden-açılı kamera, kalabalık roman.
 * Ön sıra ölünce arkadakiler öne; sert seri vuruş. Modeller hazır olmadan kayıt yok.
 */
export const D14112026_ID = "14112026" as const;
export type D14112026Id = typeof D14112026_ID;
export const D14112026_MODE = { id: D14112026_ID, label: "14112026" } as const;
export const D14112026_SECONDS = 30;
export const D14112026_FRIENDS = 10;
export const D14112026_FOES = 240;
export const D14112026_HERO = "/models/savaci.glb";
export const D14112026_ROMAN = "/models/roman.glb";
export const D14112026_URLS = [D14112026_HERO, D14112026_ROMAN] as const;

/** Yakın temas — gövde sabit, silah uzanır. */
const CONTACT = 1.05;
const STACK = 0.58;
/** Aggressive clip vuruş zirveleri (tekReel). */
const STRIKES = [0.5, 1.05, 1.24];
const COMBO = 1.48;
const OPEN = STRIKES[0];
/** Vuruş teması sonrası kısa toparlanma. */
const HIT_TAIL = 0.12;

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
  return { friends, foes, pitch: 2.1, width: 48, depth: 48 };
}

export function d1411Haze(_friends: number) {
  return { near: 48, far: 100 };
}
export function d1411Far(_friends: number) {
  return 160;
}

type Bout = {
  foe: number;
  tMove: number;
  tContact: number;
  tHit: number;
  tDone: number;
  strikeI: number;
};

type Sim = {
  friendX0: Float32Array;
  friendZ0: Float32Array;
  foeX0: Float32Array;
  foeZ0: Float32Array;
  foeOwner: Int16Array;
  foeDist: Float32Array;
  bouts: Bout[][];
  dieAt: Float32Array;
  fightAt: Float32Array;
};

/** Ön sıra önce; aynı mesafede sağ → sol → karşı. */
function orderFrontToBack(
  foes: number[],
  fx: number,
  fz: number,
  foeX0: Float32Array,
  foeZ0: Float32Array
) {
  const outward = Math.atan2(fx, fz);
  const items = foes.map((foe) => {
    const dx = foeX0[foe] - fx;
    const dz = foeZ0[foe] - fz;
    const ang = Math.atan2(dx, dz);
    return { foe, dist: Math.hypot(dx, dz), rel: wrapPi(ang - outward) };
  });
  items.sort((a, b) => a.dist - b.dist || a.rel - b.rel);

  const rows: typeof items[] = [];
  const ROW = 1.1;
  for (const it of items) {
    const last = rows[rows.length - 1];
    if (!last || Math.abs(it.dist - last[0].dist) > ROW) rows.push([it]);
    else last.push(it);
  }

  const out: number[] = [];
  for (const row of rows) {
    const right = row.filter((x) => x.rel > 0.28).sort((a, b) => b.rel - a.rel);
    const left = row.filter((x) => x.rel < -0.28).sort((a, b) => a.rel - b.rel);
    const front = row.filter((x) => Math.abs(x.rel) <= 0.28).sort((a, b) => Math.abs(a.rel) - Math.abs(b.rel));
    let ri = 0;
    let li = 0;
    let fi = 0;
    let turn = 0;
    while (ri + li + fi < row.length) {
      const slot = turn % 3;
      if (slot === 0 && ri < right.length) out.push(right[ri++].foe);
      else if (slot === 1 && li < left.length) out.push(left[li++].foe);
      else if (slot === 2 && fi < front.length) out.push(front[fi++].foe);
      else if (ri < right.length) out.push(right[ri++].foe);
      else if (li < left.length) out.push(left[li++].foe);
      else if (fi < front.length) out.push(front[fi++].foe);
      turn++;
    }
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
    friendX0[i] = Math.sin(a) * 2.5;
    friendZ0[i] = Math.cos(a) * 2.5;
  }

  const foeX0 = new Float32Array(D14112026_FOES);
  const foeZ0 = new Float32Array(D14112026_FOES);
  const foeOwner = new Int16Array(D14112026_FOES);
  const foeDist = new Float32Array(D14112026_FOES);
  const counts = new Int16Array(n);

  for (let i = 0; i < D14112026_FOES; i++) {
    const owner = i % n;
    foeOwner[i] = owner;
    const k = counts[owner]++;
    const fx = friendX0[owner];
    const fz = friendZ0[owner];
    const outward = Math.atan2(fx, fz);
    const per = Math.ceil(D14112026_FOES / n);
    const col = k % 5;
    const row = Math.floor(k / 5);
    const spread = (col - 2) * 0.42 + (owner % 2) * 0.08;
    const ring = 5.6 + row * 1.15 + (owner % 3) * 0.2;
    const a = outward + spread;
    foeX0[i] = fx + Math.sin(a) * ring;
    foeZ0[i] = fz + Math.cos(a) * ring;
    foeDist[i] = ring;
  }

  const queues: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < D14112026_FOES; i++) queues[foeOwner[i]].push(i);

  const dieAt = new Float32Array(D14112026_FOES);
  dieAt.fill(1e9);
  const bouts: Bout[][] = Array.from({ length: n }, () => []);
  const fightAt = new Float32Array(n);

  for (let f = 0; f < n; f++) {
    const ordered = orderFrontToBack(queues[f], friendX0[f], friendZ0[f], foeX0, foeZ0);
    const t0 = 0.22 + f * 0.07;
    fightAt[f] = t0;
    let strikeI = 0;
    for (const foe of ordered) {
      const strike = STRIKES[strikeI % STRIKES.length];
      const film = t0 + Math.floor(strikeI / STRIKES.length) * COMBO + (strike - OPEN);
      if (film > D14112026_SECONDS - 0.6) break;
      const tHit = film;
      const tContact = Math.max(t0, tHit - 0.05);
      const tMove = Math.max(t0 * 0.5, tContact - 0.35);
      const tDone = tHit + HIT_TAIL;
      bouts[f].push({ foe, tMove, tContact, tHit, tDone, strikeI });
      dieAt[foe] = tHit;
      strikeI++;
    }
  }

  SIM = { friendX0, friendZ0, foeX0, foeZ0, foeOwner, foeDist, bouts, dieAt, fightAt };
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

/** Tüm aggressive clip vuruşlarını seri ve güçlü oynat. */
export function d1411ClipTime(t: number, friendI: number) {
  const sim = ensureSim(D14112026_FRIENDS);
  const start = sim.fightAt[Math.max(0, Math.min(sim.fightAt.length - 1, friendI))] ?? 0.22;
  return OPEN + Math.max(0, t - start);
}

export function d1411Knight(layout: D1411Layout, i: number, t: number): D1411Pose {
  const sim = ensureSim(layout.friends);
  const bouts = sim.bouts[i] || [];
  const b = boutAt(bouts, t);
  const x = sim.friendX0[i];
  const z = sim.friendZ0[i];
  const clipTime = d1411ClipTime(t, i);

  if (!b) {
    return { x, z, yaw: Math.atan2(x, z), pitch: -0.04, roll: 0, show: true, clipTime, attacking: false, dead: false };
  }

  const foe = d1411RomanPos(sim, b.foe, t);
  const yaw = Math.atan2(foe.x - x, foe.z - z);
  const attacking = t >= b.tContact && t <= b.tDone;

  return { x, z, yaw, pitch: -0.05, roll: 0, show: true, clipTime, attacking, dead: false };
}

function livingAhead(sim: Sim, owner: number, foeI: number, t: number) {
  const myDist = sim.foeDist[foeI];
  let n = 0;
  for (let j = 0; j < D14112026_FOES; j++) {
    if (sim.foeOwner[j] !== owner || j === foeI) continue;
    if (t >= sim.dieAt[j]) continue;
    if (sim.foeDist[j] < myDist - 0.08) n++;
  }
  return n;
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
  const ahead = livingAhead(sim, owner, i, t);
  const stop = CONTACT + ahead * STACK;
  const travel = Math.max(0, dist - stop);
  const wantX = x0 + (dx / dist) * travel;
  const wantZ = z0 + (dz / dist) * travel;

  // Zamanla yaklaş; ön sıra düşünce stop küçülür → öne kayar
  const byTime = easeInOut(clamp01(t / Math.max(0.18, die - 0.28)));
  const bySlot = easeInOut(clamp01(1 - stop / Math.max(dist, 0.01)));
  const u = Math.max(byTime, bySlot * 0.92);
  return { x: lerp(x0, wantX, u), z: lerp(z0, wantZ, u) };
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

  const yaw = Math.atan2(tx - x, tz - z) - Math.PI / 2;
  const dead = t >= die;
  const fall = dead ? Math.min(1, (t - die) / 0.38) : 0;

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

/** Yakın açılı tepeden — dik bakış değil, alanı görür. */
export function d1411Cam(t: number, _friends = 1): Cam {
  const swing = Math.sin(t * 0.11) * 1.2;
  return {
    x: 9.5 + swing,
    y: 13.2,
    z: 15.8,
    lx: 0,
    ly: 1.05,
    lz: -0.6,
    fov: 38,
  };
}

export type D1411Caption = { title: string; sub: string; accent: "white" | "red" | "gold" };

export function d1411Caption(_t: number, _day: number): D1411Caption | null {
  return null;
}
