/**
 * mafya — iki takım çatışma: en yakın hedefe ateş, isabet/sekme, ölüm.
 * Takım1: lider 1, asker 2-8-9, araç 10-12
 * Takım2: lider 6, asker 3-4-5-7, araç 11
 */
export const MAFYA_ID = "mafya" as const;
export type MafyaId = typeof MAFYA_ID;
export const MAFYA_MODE = { id: MAFYA_ID, label: "mafya" } as const;
export const MAFYA_SECONDS = 55;

export type MafyaKind = "man" | "car";
export type MafyaTeam = 1 | 2;
export type MafyaEntry = {
  url: string;
  kind: MafyaKind;
  num: number;
  team: MafyaTeam;
  role: "leader" | "soldier" | "car";
};

const BY_NUM: Record<number, { url: string; kind: MafyaKind }> = {
  1: { url: "/models/mafya/m01.glb", kind: "man" },
  2: { url: "/models/mafya/m02.glb", kind: "man" },
  3: { url: "/models/mafya/m03.glb", kind: "man" },
  4: { url: "/models/mafya/m04.glb", kind: "man" },
  5: { url: "/models/mafya/m05.glb", kind: "man" },
  6: { url: "/models/mafya/m06.glb", kind: "man" },
  7: { url: "/models/mafya/m07.glb", kind: "man" },
  8: { url: "/models/mafya/m08.glb", kind: "man" },
  9: { url: "/models/mafya/m09.glb", kind: "man" },
  10: { url: "/models/mafya/c01.glb", kind: "car" },
  11: { url: "/models/mafya/c02.glb", kind: "car" },
  12: { url: "/models/mafya/c03.glb", kind: "car" },
};

export const MAFYA_ENTRIES: readonly MafyaEntry[] = [
  { ...BY_NUM[1], num: 1, team: 1, role: "leader" },
  { ...BY_NUM[2], num: 2, team: 1, role: "soldier" },
  { ...BY_NUM[8], num: 8, team: 1, role: "soldier" },
  { ...BY_NUM[9], num: 9, team: 1, role: "soldier" },
  { ...BY_NUM[10], num: 10, team: 1, role: "car" },
  { ...BY_NUM[12], num: 12, team: 1, role: "car" },
  { ...BY_NUM[6], num: 6, team: 2, role: "leader" },
  { ...BY_NUM[3], num: 3, team: 2, role: "soldier" },
  { ...BY_NUM[4], num: 4, team: 2, role: "soldier" },
  { ...BY_NUM[5], num: 5, team: 2, role: "soldier" },
  { ...BY_NUM[7], num: 7, team: 2, role: "soldier" },
  { ...BY_NUM[11], num: 11, team: 2, role: "car" },
];

export const MAFYA_N = MAFYA_ENTRIES.length;
export const MAFYA_URLS = MAFYA_ENTRIES.map((e) => e.url);

export type MafyaGun = "pistol" | "m4";

export function mafyaGunFor(num: number): MafyaGun {
  return num % 2 === 1 ? "m4" : "pistol";
}

export function isMafya(id: string | null | undefined): id is MafyaId {
  return id === MAFYA_ID;
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function mafyaMarkReady() {
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}
export function mafyaIsReady() {
  return ready;
}
export function mafyaWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}
export function mafyaHold() {
  playAt = 0;
}
export function mafyaStart() {
  playAt = performance.now() / 1000;
}
export function mafyaT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}
export function mafyaReset() {
  ready = false;
  playAt = 0;
  COMBAT = null;
}

type Spot = { x: number; z: number; yaw: number };

export function mafyaPos(i: number): { x: number; z: number } {
  const e = MAFYA_ENTRIES[i];
  if (!e) return { x: 0, z: 0 };
  if (e.team === 1) {
    if (e.role === "leader") return { x: 0, z: -2.6 };
    if (e.role === "soldier") {
      const order = [2, 8, 9];
      const k = Math.max(0, order.indexOf(e.num));
      const xs = [-1.7, 0, 1.7];
      return { x: xs[k] ?? 0, z: -3.8 };
    }
    return { x: e.num === 10 ? -3.5 : 3.5, z: -5.6 };
  }
  if (e.role === "leader") return { x: 0, z: 2.6 };
  if (e.role === "soldier") {
    const order = [3, 4, 5, 7];
    const k = Math.max(0, order.indexOf(e.num));
    const xs = [-2.2, -0.75, 0.75, 2.2];
    return { x: xs[k] ?? 0, z: 3.8 };
  }
  return { x: 0, z: 5.6 };
}

function hpFor(i: number) {
  const e = MAFYA_ENTRIES[i];
  if (!e || e.kind !== "man") return 99;
  return e.role === "leader" ? 5 : 3;
}

export type MafyaShot = {
  fromI: number;
  toI: number;
  t0: number;
  dur: number;
  hit: boolean;
  /** Sekme / kaçırma ofseti (hedefe göre). */
  missX: number;
  missY: number;
  missZ: number;
};

type Combat = {
  dieAt: Float32Array;
  shots: MafyaShot[];
};

let COMBAT: Combat | null = null;

function hash01(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function mafyaAlive(i: number, t: number) {
  const c = ensureCombat();
  return t < c.dieAt[i];
}

/** En yakın canlı rakip adam. */
export function mafyaNearestFoe(fromI: number, t = 0): number {
  const from = MAFYA_ENTRIES[fromI];
  const a = mafyaPos(fromI);
  const c = ensureCombat();
  let best = -1;
  let bestD = 1e9;
  for (let j = 0; j < MAFYA_N; j++) {
    const to = MAFYA_ENTRIES[j];
    if (!from || !to || to.team === from.team) continue;
    if (to.kind !== "man") continue;
    if (t >= c.dieAt[j]) continue;
    const b = mafyaPos(j);
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (d < bestD) {
      bestD = d;
      best = j;
    }
  }
  return best;
}

/** Mixamo: gövde +Z bakıyor. Hedefe yaw. */
export function mafyaSpot(i: number, t = 0): Spot {
  const a = mafyaPos(i);
  const foe = mafyaNearestFoe(i, t);
  if (foe < 0) {
    // rakip kalmadı — takım yönüne bak
    const e = MAFYA_ENTRIES[i];
    return { x: a.x, z: a.z, yaw: e?.team === 1 ? 0 : Math.PI };
  }
  const b = mafyaPos(foe);
  const yaw = Math.atan2(b.x - a.x, b.z - a.z);
  return { x: a.x, z: a.z, yaw };
}

export function mafyaDieAt(i: number) {
  return ensureCombat().dieAt[i];
}

export function mafyaDead(i: number, t: number) {
  return !mafyaAlive(i, t);
}

function ensureCombat(): Combat {
  if (COMBAT) return COMBAT;

  const dieAt = new Float32Array(MAFYA_N);
  dieAt.fill(1e9);
  const hits = new Int16Array(MAFYA_N);
  const shots: MafyaShot[] = [];
  const men = MAFYA_ENTRIES.map((e, i) => ({ e, i })).filter((x) => x.e.kind === "man");

  let t = 0.5;
  let salt = 1;
  while (t < MAFYA_SECONDS - 1.0) {
    for (const shooter of men) {
      if (t >= dieAt[shooter.i]) continue;
      // bu anda en yakın canlı hedef
      let best = -1;
      let bestD = 1e9;
      const a = mafyaPos(shooter.i);
      for (const foe of men) {
        if (foe.e.team === shooter.e.team) continue;
        if (t >= dieAt[foe.i]) continue;
        const b = mafyaPos(foe.i);
        const d = Math.hypot(b.x - a.x, b.z - a.z);
        if (d < bestD) {
          bestD = d;
          best = foe.i;
        }
      }
      if (best < 0) continue;

      const h = hash01(salt++);
      const hit = h < 0.68; // çoğu isabet, bir kısmı sekme/kaçırma
      const missAng = hash01(salt++) * Math.PI * 2;
      const missR = 0.55 + hash01(salt++) * 1.1;
      const shot: MafyaShot = {
        fromI: shooter.i,
        toI: best,
        t0: t + (shooter.i % 5) * 0.035,
        dur: 0.2,
        hit,
        missX: hit ? 0 : Math.cos(missAng) * missR,
        missY: hit ? 0 : 0.15 + hash01(salt++) * 0.45,
        missZ: hit ? 0 : Math.sin(missAng) * missR,
      };
      shots.push(shot);

      if (hit) {
        const impact = shot.t0 + shot.dur;
        hits[best] += 1;
        if (hits[best] >= hpFor(best) && dieAt[best] > 1e8) {
          dieAt[best] = impact;
        }
      }
    }
    t += 0.42;
  }

  COMBAT = { dieAt, shots };
  return COMBAT;
}

export function mafyaShots(): MafyaShot[] {
  return ensureCombat().shots;
}

export function mafyaFar() {
  return 200;
}

export function mafyaHaze() {
  return { near: 45, far: 90 };
}

type Cam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

export function mafyaCam(t: number): Cam {
  const ang = Math.sin(t * 0.08) * 0.22;
  return {
    x: Math.sin(ang) * 6.5,
    y: 18.5,
    z: Math.cos(ang) * 11.5,
    lx: 0,
    ly: 0.6,
    lz: 0,
    fov: 50,
  };
}
