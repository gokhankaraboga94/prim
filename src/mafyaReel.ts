/**
 * mafya — iki takım çatışma (film/oyun sahnesi).
 * Lider 1+6 tek; T1 araç=10+12, T2 araç=11.
 * Bakış: atan2(-dz, dx)+π — dokunma (mafya-facing kuralı).
 */
export const MAFYA_ID = "mafya" as const;
export type MafyaId = typeof MAFYA_ID;
export const MAFYA_MODE = { id: MAFYA_ID, label: "mafya" } as const;
export const MAFYA_SECONDS = 60;

export type MafyaKind = "man" | "car";
export type MafyaTeam = 1 | 2;
export type MafyaEntry = {
  url: string;
  kind: MafyaKind;
  num: number;
  team: MafyaTeam;
  role: "leader" | "soldier" | "car";
  slot: number;
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

const SOLDIER_SCALE = 2;
const T1_SOLDIER_MODELS = [2, 8, 9];
const T2_SOLDIER_MODELS = [3, 4, 5, 7];
/** Lider 1 → 10+12; lider 6 → yalnız 11. Sayı yarıya. */
const T1_CAR_MODELS = [10, 12, 10];
const T2_CAR_MODELS = [11, 11];

function buildEntries(): MafyaEntry[] {
  const out: MafyaEntry[] = [];
  out.push({ ...BY_NUM[1], num: 1, team: 1, role: "leader", slot: -1 });
  for (let k = 0; k < T1_SOLDIER_MODELS.length * SOLDIER_SCALE; k++) {
    const num = T1_SOLDIER_MODELS[k % T1_SOLDIER_MODELS.length];
    out.push({ ...BY_NUM[num], num, team: 1, role: "soldier", slot: k });
  }
  for (let k = 0; k < T1_CAR_MODELS.length; k++) {
    const num = T1_CAR_MODELS[k];
    out.push({ ...BY_NUM[num], num, team: 1, role: "car", slot: k });
  }

  out.push({ ...BY_NUM[6], num: 6, team: 2, role: "leader", slot: -1 });
  for (let k = 0; k < T2_SOLDIER_MODELS.length * SOLDIER_SCALE; k++) {
    const num = T2_SOLDIER_MODELS[k % T2_SOLDIER_MODELS.length];
    out.push({ ...BY_NUM[num], num, team: 2, role: "soldier", slot: k });
  }
  for (let k = 0; k < T2_CAR_MODELS.length; k++) {
    const num = T2_CAR_MODELS[k];
    out.push({ ...BY_NUM[num], num, team: 2, role: "car", slot: k });
  }
  return out;
}

export const MAFYA_ENTRIES: readonly MafyaEntry[] = buildEntries();
export const MAFYA_N = MAFYA_ENTRIES.length;
export const MAFYA_URLS = [...new Set(MAFYA_ENTRIES.map((e) => e.url))];

export type { MafyaGun } from "./mafyaGuns";
export { mafyaGunKind as mafyaGunFor } from "./mafyaGuns";

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

function hash01(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Hafif dağınık hat — grid + küçük jitter. */
function soldierGrid(slot: number, count: number, z: number, halfW: number) {
  const cols = Math.ceil(Math.sqrt(count * 1.15));
  const rows = Math.ceil(count / cols);
  const col = slot % cols;
  const row = Math.floor(slot / cols);
  const x = cols <= 1 ? 0 : -halfW + (col / (cols - 1)) * halfW * 2;
  const depth = rows <= 1 ? 0 : (row - (rows - 1) / 2) * 1.45;
  const jx = (hash01(slot * 19.3 + 2.1) - 0.5) * 1.15;
  const jz = (hash01(slot * 11.7 + 5.4) - 0.5) * 0.95;
  return { x: x + jx, z: z + depth + jz };
}

function carLine(slot: number, count: number, z: number, halfW: number) {
  const x = count <= 1 ? 0 : -halfW + (slot / (count - 1)) * halfW * 2;
  return { x, z };
}

export function mafyaPos(i: number): { x: number; z: number } {
  const e = MAFYA_ENTRIES[i];
  if (!e) return { x: 0, z: 0 };
  if (e.team === 1) {
    if (e.role === "leader") return { x: 0, z: -3.2 };
    if (e.role === "soldier") {
      const n = T1_SOLDIER_MODELS.length * SOLDIER_SCALE;
      return soldierGrid(e.slot, n, -5.0, 6.2);
    }
    return carLine(e.slot, T1_CAR_MODELS.length, -7.8, 7.5);
  }
  if (e.role === "leader") return { x: 0, z: 3.2 };
  if (e.role === "soldier") {
    const n = T2_SOLDIER_MODELS.length * SOLDIER_SCALE;
    return soldierGrid(e.slot, n, 5.0, 6.6);
  }
  return carLine(e.slot, T2_CAR_MODELS.length, 7.8, 7.5);
}

function hpFor(i: number) {
  const e = MAFYA_ENTRIES[i];
  if (!e || e.kind !== "man") return 99;
  return e.role === "leader" ? 20 : 14;
}

export type MafyaShot = {
  fromI: number;
  toI: number;
  t0: number;
  dur: number;
  hit: boolean;
  missX: number;
  missY: number;
  missZ: number;
};

type Combat = {
  dieAt: Float32Array;
  shots: MafyaShot[];
  aimAt: Int16Array[];
  aimTimes: Float32Array;
};

let COMBAT: Combat | null = null;

export function mafyaAlive(i: number, t: number) {
  const c = ensureCombat();
  return t < c.dieAt[i];
}

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

export function mafyaAimTarget(fromI: number, t = 0): number {
  const c = ensureCombat();
  for (let s = c.shots.length - 1; s >= 0; s--) {
    const shot = c.shots[s];
    if (shot.fromI !== fromI) continue;
    if (t >= shot.t0 - 0.35 && t <= shot.t0 + shot.dur + 0.55) return shot.toI;
  }
  return mafyaNearestFoe(fromI, t);
}

function mafyaEnemyCenter(fromI: number, t: number): { x: number; z: number } {
  const from = MAFYA_ENTRIES[fromI];
  const c = ensureCombat();
  let sx = 0;
  let sz = 0;
  let n = 0;
  for (let j = 0; j < MAFYA_N; j++) {
    const to = MAFYA_ENTRIES[j];
    if (!from || !to || to.team === from.team || to.kind !== "man") continue;
    if (t >= c.dieAt[j]) continue;
    const b = mafyaPos(j);
    sx += b.x;
    sz += b.z;
    n += 1;
  }
  if (n > 0) return { x: sx / n, z: sz / n };
  return { x: 0, z: from?.team === 1 ? 8 : -8 };
}

/** Doğrulandı: yüzler rakibe. Değiştirme. */
function yawToward(ax: number, az: number, tx: number, tz: number) {
  return Math.atan2(-(tz - az), tx - ax) + Math.PI;
}

export function mafyaYawTo(fromI: number, toI: number, t = 0): number {
  const a = mafyaPos(fromI);
  if (toI >= 0) {
    const b = mafyaPos(toI);
    return yawToward(a.x, a.z, b.x, b.z);
  }
  const mid = mafyaEnemyCenter(fromI, t);
  return yawToward(a.x, a.z, mid.x, mid.z);
}

export function mafyaSpot(i: number, t = 0): Spot {
  const a = mafyaPos(i);
  const foe = mafyaAimTarget(i, t);
  return { x: a.x, z: a.z, yaw: mafyaYawTo(i, foe, t) };
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

  let t = 1.4;
  let salt = 1;
  while (t < MAFYA_SECONDS - 2.0) {
    for (const shooter of men) {
      if (t >= dieAt[shooter.i]) continue;

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

      const stagger = hash01(salt + shooter.i * 17) * 0.4;
      const h = hash01(salt++);
      const hit = h < 0.52;
      const missAng = hash01(salt++) * Math.PI * 2;
      const missR = 0.85 + hash01(salt++) * 1.4;
      const flight = 0.18 + Math.min(0.2, bestD * 0.012);
      const shot: MafyaShot = {
        fromI: shooter.i,
        toI: best,
        t0: t + stagger,
        dur: flight,
        hit,
        missX: hit ? 0 : Math.cos(missAng) * missR,
        missY: hit ? 0 : 0.2 + hash01(salt++) * 0.55,
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
    t += 1.15;
  }

  COMBAT = { dieAt, shots, aimAt: [], aimTimes: new Float32Array(0) };
  return COMBAT;
}

export function mafyaShots(): MafyaShot[] {
  return ensureCombat().shots;
}

export function mafyaFar() {
  return 140;
}

export function mafyaHaze() {
  return { near: 40, far: 90 };
}

type Cam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

/**
 * %25 daha yakın; yavaş pan.
 */
export function mafyaCam(t: number): Cam {
  const ang = 0.55 + (t / MAFYA_SECONDS) * Math.PI;
  const rad = 28.5;
  return {
    x: Math.sin(ang) * rad,
    y: 19.5,
    z: Math.cos(ang) * rad,
    lx: 0,
    ly: 0.4,
    lz: 0,
    fov: 48,
  };
}
