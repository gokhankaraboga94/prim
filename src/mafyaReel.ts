/**
 * mafya — iki takım karşı karşıya.
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

/** Takım1 mafya / Takım2 karşı. */
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

/** pistol | m4 — 1 ve aynı M4’lü modeller. */
export type MafyaGun = "pistol" | "m4";

/** Eski hatta 1 (index0) M4 alıyordu; aynı silah çift index’lerde. Num bazlı: 1,3,5,7,9 → M4. */
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
}

type Spot = { x: number; z: number; yaw: number };

/**
 * Takım1 −Z tarafı (yüzü +Z), Takım2 +Z tarafı (yüzü −Z).
 * Lider önde, askerler yanında, araçlar geride.
 */
export function mafyaSpot(i: number): Spot {
  const e = MAFYA_ENTRIES[i];
  if (!e) return { x: 0, z: 0, yaw: 0 };

  if (e.team === 1) {
    // yüz +Z → yaw 0
    if (e.role === "leader") return { x: 0, z: -4.2, yaw: 0 };
    if (e.role === "soldier") {
      const order = [2, 8, 9];
      const k = Math.max(0, order.indexOf(e.num));
      const xs = [-2.4, 0, 2.4];
      return { x: xs[k] ?? 0, z: -6.0, yaw: 0 };
    }
    // cars
    return { x: e.num === 10 ? -5.2 : 5.2, z: -9.2, yaw: 0 };
  }

  // team 2 — yüz −Z → yaw PI
  if (e.role === "leader") return { x: 0, z: 4.2, yaw: Math.PI };
  if (e.role === "soldier") {
    const order = [3, 4, 5, 7];
    const k = Math.max(0, order.indexOf(e.num));
    const xs = [-3.2, -1.1, 1.1, 3.2];
    return { x: xs[k] ?? 0, z: 6.0, yaw: Math.PI };
  }
  return { x: 0, z: 9.4, yaw: Math.PI };
}

export function mafyaFar() {
  return 140;
}

export function mafyaHaze() {
  return { near: 22, far: 55 };
}

type Cam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

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

/** Geniş açılış → takım1 → karşılaşma → takım2 → geniş kapanış. */
export function mafyaCam(t: number): Cam {
  const u = clamp01(t / Math.max(0.01, MAFYA_SECONDS - 0.6));
  const a = mafyaSpot(0); // lider1
  const b = mafyaSpot(6); // lider6 (index in ENTRIES)

  if (u < 0.18) {
    const p = easeInOut(u / 0.18);
    return {
      x: lerp(0, 0, p),
      y: lerp(9.5, 7.5, p),
      z: lerp(0.2, 0.2, p),
      lx: 0,
      ly: 1.1,
      lz: 0,
      fov: lerp(48, 42, p),
    };
  }
  if (u < 0.4) {
    const p = easeInOut((u - 0.18) / 0.22);
    return {
      x: lerp(0, a.x - 1.2, p),
      y: lerp(7.5, 2.3, p),
      z: lerp(0.2, a.z + 5.2, p),
      lx: lerp(0, a.x, p),
      ly: 1.15,
      lz: lerp(0, a.z, p),
      fov: lerp(42, 36, p),
    };
  }
  if (u < 0.55) {
    const p = easeInOut((u - 0.4) / 0.15);
    return {
      x: lerp(a.x - 1.2, 8.5, p),
      y: lerp(2.3, 5.2, p),
      z: lerp(a.z + 5.2, 0.5, p),
      lx: 0,
      ly: 1.2,
      lz: 0,
      fov: lerp(36, 40, p),
    };
  }
  if (u < 0.78) {
    const p = easeInOut((u - 0.55) / 0.23);
    return {
      x: lerp(8.5, b.x + 1.2, p),
      y: lerp(5.2, 2.3, p),
      z: lerp(0.5, b.z - 5.2, p),
      lx: lerp(0, b.x, p),
      ly: 1.15,
      lz: lerp(0, b.z, p),
      fov: lerp(40, 36, p),
    };
  }
  const p = easeInOut((u - 0.78) / 0.22);
  return {
    x: lerp(b.x + 1.2, 0, p),
    y: lerp(2.3, 8.8, p),
    z: lerp(b.z - 5.2, 0.2, p),
    lx: 0,
    ly: 1.1,
    lz: 0,
    fov: lerp(36, 46, p),
  };
}
