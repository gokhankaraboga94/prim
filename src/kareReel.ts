export const KARE_ID = "kare" as const;
export type KareId = typeof KARE_ID;
export const KARE_MODE = { id: KARE_ID, label: "kare" } as const;
export const KARE_SECONDS = 60;
export const KARE_OURS = 100;
export const KARE_ROMANS = 2000;
export const KARE_KNIGHT = "/models/knight.glb";
export const KARE_ROMAN = "/models/roman.glb";
export const KARE_URLS = [KARE_KNIGHT, KARE_ROMAN] as const;

const PER_RANK = 100;
const GAP = 0.38;
const OPEN_END = 3.7;
const CLOSE_END = 56;
const ROW_AT = 4.6;
const ROW_GAP = 9.2;
const FLIGHT = 0.7;
const FACE = [Math.PI, Math.PI / 2, 0, -Math.PI / 2] as const;
const OUT = [
  { x: 0, z: -1 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: -1, z: 0 },
] as const;

export type KareCam = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

export function kareHalf(t: number) {
  if (t < OPEN_END) return 10.4 - (t / OPEN_END) * 1.8;
  const u = Math.min(1, (t - OPEN_END) / (CLOSE_END - OPEN_END));
  const s = 1 - Math.pow(1 - u, 1.2);
  return 8.6 - s * 1.45;
}

export function kareRoman(i: number, t: number) {
  const rank = Math.floor(i / PER_RANK);
  const s = i % PER_RANK;
  const h = kareHalf(t) + rank * GAP;
  const side = Math.floor(s / 25);
  const k = (s % 25 + 0.5) / 25;
  const along = -h + k * 2 * h;
  let x = 0;
  let z = 0;
  if (side === 0) {
    x = along;
    z = -h;
  } else if (side === 1) {
    x = h;
    z = along;
  } else if (side === 2) {
    x = -along;
    z = h;
  } else {
    x = -h;
    z = -along;
  }
  return { x, z, yaw: Math.atan2(-x, -z) };
}

function edgeChoices(i: number) {
  const col = i % 10;
  const row = Math.floor(i / 10);
  return [
    { side: 0, d: row, along: col },
    { side: 1, d: 9 - col, along: row },
    { side: 2, d: 9 - row, along: 9 - col },
    { side: 3, d: col, along: 9 - row },
  ].sort((a, b) => a.d - b.d || a.side - b.side);
}

function buildEdges() {
  const out: { side: number; d: number; along: number }[] = Array(100);
  const buckets: Record<string, number[]> = { "0,1": [], "0,3": [], "1,2": [], "2,3": [] };
  for (let i = 0; i < 100; i++) {
    const tied = edgeChoices(i).filter((x) => x.d === edgeChoices(i)[0].d);
    if (tied.length === 1) out[i] = tied[0];
    else buckets[tied.map((x) => x.side).sort().join(",")].push(i);
  }
  const prefer: Record<string, number[]> = {
    "0,3": [3, 0, 3, 0, 3],
    "0,1": [0, 1, 0, 1, 0],
    "1,2": [1, 2, 1, 2, 1],
    "2,3": [2, 3, 2, 3, 2],
  };
  for (const key of Object.keys(buckets)) {
    buckets[key].forEach((i, n) => {
      out[i] = edgeChoices(i).find((x) => x.side === prefer[key][n]) ?? edgeChoices(i)[0];
    });
  }
  return out;
}

const EDGES = buildEdges();

export function kareEdge(i: number) {
  return EDGES[i];
}

export function kareHit(i: number) {
  const edge = kareEdge(i);
  return ROW_AT + edge.d * ROW_GAP + (edge.along / 9) * 0.85;
}

export function kareFace(i: number) {
  return FACE[kareEdge(i).side];
}

export function kareFall(i: number, t: number) {
  const when = kareHit(i);
  if (t < when) return 0;
  const k = Math.min(1, (t - when) / 0.75);
  return k * k * (3 - 2 * k);
}

export function kareFriend(i: number) {
  const col = i % 10;
  const row = Math.floor(i / 10);
  const x = (col - 4.5) * 1.32;
  const z = (row - 4.5) * 1.32;
  return { x, z, yaw: Math.atan2(x, z) };
}

export function kareRoster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-KARE_OURS);
  const out = Array.from({ length: KARE_OURS }, () => "");
  const start = KARE_OURS - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function kareMarkReady() {
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function kareIsReady() {
  return ready;
}

export function kareWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function kareHold() {
  playAt = 0;
}

export function kareStart() {
  playAt = performance.now() / 1000;
}

export function kareT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function kareReset() {
  ready = false;
  playAt = 0;
}

export function isKare(id: string | null | undefined): id is KareId {
  return id === KARE_ID;
}

export function kareCam(t: number): KareCam {
  const ang = 0.35 + t * 0.028;
  const u = Math.min(1, Math.max(0, t) / KARE_SECONDS);
  const pull = 1.05 - u * 0.36;
  return {
    x: Math.cos(ang) * 8 * pull,
    y: 62 * pull,
    z: Math.sin(ang) * 8 * pull,
    lx: 0,
    ly: 0,
    lz: 0,
    fov: 38,
  };
}

export type KareSpear = { x: number; y: number; z: number; dx: number; dy: number; dz: number };

export function kareSpear(i: number, t: number, out: KareSpear) {
  const hit = kareHit(i);
  const born = hit - FLIGHT;
  if (t < born || t > hit + 0.08) return false;
  const seat = kareFriend(i);
  const outDir = OUT[kareEdge(i).side];
  const u = Math.min(1, (t - born) / FLIGHT);
  const at = (k: number) => ({
    x: seat.x + outDir.x * 7.6 * (1 - k),
    z: seat.z + outDir.z * 7.6 * (1 - k),
    y: 1.7 + Math.sin(k * Math.PI) * 2.8,
  });
  const here = at(u);
  const next = at(Math.min(1, u + 0.045));
  out.x = here.x;
  out.y = here.y;
  out.z = here.z;
  out.dx = next.x - here.x;
  out.dy = next.y - here.y;
  out.dz = next.z - here.z;
  return true;
}

export function kareShowNames(t: number) {
  return t >= OPEN_END;
}
