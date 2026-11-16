/**
 * mafya — iki takım çatışma: hedefe dön, isabet/sekme, yavaş ölüm.
 * Liderler tek; askerler aynı modellerden 5× çoğaltılır.
 * Takım1: lider 1, asker 2/8/9 ×5, araç 10-12
 * Takım2: lider 6, asker 3/4/5/7 ×5, araç 11
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
  /** Görünen numara (kaynak model). */
  num: number;
  team: MafyaTeam;
  role: "leader" | "soldier" | "car";
  /** Asker sırası (0..n-1), lider/araç için -1. */
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

const SOLDIER_SCALE = 5;
const T1_SOLDIER_MODELS = [2, 8, 9];
const T2_SOLDIER_MODELS = [3, 4, 5, 7];

function buildEntries(): MafyaEntry[] {
  const out: MafyaEntry[] = [];
  out.push({ ...BY_NUM[1], num: 1, team: 1, role: "leader", slot: -1 });
  for (let k = 0; k < T1_SOLDIER_MODELS.length * SOLDIER_SCALE; k++) {
    const num = T1_SOLDIER_MODELS[k % T1_SOLDIER_MODELS.length];
    out.push({ ...BY_NUM[num], num, team: 1, role: "soldier", slot: k });
  }
  out.push({ ...BY_NUM[10], num: 10, team: 1, role: "car", slot: -1 });
  out.push({ ...BY_NUM[12], num: 12, team: 1, role: "car", slot: -1 });

  out.push({ ...BY_NUM[6], num: 6, team: 2, role: "leader", slot: -1 });
  for (let k = 0; k < T2_SOLDIER_MODELS.length * SOLDIER_SCALE; k++) {
    const num = T2_SOLDIER_MODELS[k % T2_SOLDIER_MODELS.length];
    out.push({ ...BY_NUM[num], num, team: 2, role: "soldier", slot: k });
  }
  out.push({ ...BY_NUM[11], num: 11, team: 2, role: "car", slot: -1 });
  return out;
}

export const MAFYA_ENTRIES: readonly MafyaEntry[] = buildEntries();
export const MAFYA_N = MAFYA_ENTRIES.length;
export const MAFYA_URLS = [...new Set(MAFYA_ENTRIES.map((e) => e.url))];

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

function soldierGrid(slot: number, count: number, z: number, halfW: number) {
  const cols = Math.ceil(Math.sqrt(count * 1.35));
  const rows = Math.ceil(count / cols);
  const col = slot % cols;
  const row = Math.floor(slot / cols);
  const x = cols <= 1 ? 0 : -halfW + (col / (cols - 1)) * halfW * 2;
  const depth = rows <= 1 ? 0 : (row - (rows - 1) / 2) * 1.05;
  return { x, z: z + depth };
}

export function mafyaPos(i: number): { x: number; z: number } {
  const e = MAFYA_ENTRIES[i];
  if (!e) return { x: 0, z: 0 };
  if (e.team === 1) {
    if (e.role === "leader") return { x: 0, z: -2.2 };
    if (e.role === "soldier") {
      const n = T1_SOLDIER_MODELS.length * SOLDIER_SCALE;
      return soldierGrid(e.slot, n, -4.2, 5.2);
    }
    return { x: e.num === 10 ? -6.2 : 6.2, z: -7.4 };
  }
  if (e.role === "leader") return { x: 0, z: 2.2 };
  if (e.role === "soldier") {
    const n = T2_SOLDIER_MODELS.length * SOLDIER_SCALE;
    return soldierGrid(e.slot, n, 4.2, 5.8);
  }
  return { x: 0, z: 7.4 };
}

function hpFor(i: number) {
  const e = MAFYA_ENTRIES[i];
  if (!e || e.kind !== "man") return 99;
  return e.role === "leader" ? 18 : 12;
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
  /** Zaman diliminde her nişancının o anki hedefi. */
  aimAt: Int16Array[];
  aimTimes: Float32Array;
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

/** Ateş ettiği hedef varsa ona, yoksa en yakın rakibe bak. */
export function mafyaAimTarget(fromI: number, t = 0): number {
  const c = ensureCombat();
  for (let s = c.shots.length - 1; s >= 0; s--) {
    const shot = c.shots[s];
    if (shot.fromI !== fromI) continue;
    // Ateş öncesi/sonrası da o rakibe dönük kalsın
    if (t >= shot.t0 - 0.35 && t <= shot.t0 + shot.dur + 0.55) return shot.toI;
  }
  return mafyaNearestFoe(fromI, t);
}

/** Karşı takımın canlı ortasına bak (yan bakmayı azaltır). */
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
  return { x: 0, z: from?.team === 1 ? 4 : -4 };
}

/**
 * Tripo/Mixamo kalça bind'i -90° Y → model burnu local +X.
 * Hedefe dönmek: yaw = atan2(-dz, dx)  (atan2(dx,dz) sağa/sola bakıyordu).
 */
function yawToward(ax: number, az: number, tx: number, tz: number) {
  return Math.atan2(-(tz - az), tx - ax);
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

  // Daha seyrek volley → yavaş ölüm
  let t = 1.2;
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

      // Nişancı başına hafif jitter — aynı anda herkes ateş etmesin
      const stagger = hash01(salt + shooter.i * 17) * 0.35;
      const h = hash01(salt++);
      const hit = h < 0.55;
      const missAng = hash01(salt++) * Math.PI * 2;
      const missR = 0.7 + hash01(salt++) * 1.3;
      const shot: MafyaShot = {
        fromI: shooter.i,
        toI: best,
        t0: t + stagger,
        dur: 0.22,
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
    t += 0.85;
  }

  COMBAT = { dieAt, shots, aimAt: [], aimTimes: new Float32Array(0) };
  return COMBAT;
}

export function mafyaShots(): MafyaShot[] {
  return ensureCombat().shots;
}

export function mafyaFar() {
  return 260;
}

export function mafyaHaze() {
  return { near: 55, far: 120 };
}

type Cam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

export function mafyaCam(t: number): Cam {
  const ang = Math.sin(t * 0.07) * 0.18;
  return {
    x: Math.sin(ang) * 8,
    y: 24,
    z: Math.cos(ang) * 16,
    lx: 0,
    ly: 0.5,
    lz: 0,
    fov: 48,
  };
}
