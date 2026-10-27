export const MAGDUR_ID = "magdur" as const;
export type MagdurId = typeof MAGDUR_ID;
export const MAGDUR_MODE = { id: MAGDUR_ID, label: "magdur" } as const;
export const MAGDUR_SECONDS = 66;
export const MAGDUR_N = 36;
export const MAGDUR_ROMANS = 8;
export const MAGDUR_KNIGHT = "/models/knight.glb";
export const MAGDUR_ROMAN = "/models/roman.glb";
export const MAGDUR_URLS = [MAGDUR_KNIGHT, MAGDUR_ROMAN] as const;
export const MAGDUR_HOOK = ["GÖRMEDİLER", "HEPİSİ ÖLECEK"] as const;

const FLIGHT = 0.62;

const SPECS = [
  { x: -8.2, z: 3.4, n: 3 },
  { x: 0.2, z: -0.4, n: 5 },
  { x: 9.4, z: 2.8, n: 6 },
  { x: -9.6, z: -6.6, n: 4 },
  { x: 0.8, z: -9.4, n: 7 },
  { x: 10.4, z: -7.4, n: 5 },
  { x: -1.4, z: 9.0, n: 6 },
] as const;

export type MagdurSeat = {
  i: number;
  x: number;
  z: number;
  yaw: number;
  group: number;
  seat: number;
};

export type MagdurCam = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

function buildSeats(): MagdurSeat[] {
  const out: MagdurSeat[] = [];
  let i = 0;
  for (let g = 0; g < SPECS.length; g++) {
    const spec = SPECS[g];
    const radius = 1.45 + spec.n * 0.13;
    for (let s = 0; s < spec.n; s++) {
      const ang = -Math.PI / 2 + (s / spec.n) * Math.PI * 2;
      const x = spec.x + Math.cos(ang) * radius;
      const z = spec.z + Math.sin(ang) * radius;
      out.push({ i, x, z, yaw: Math.atan2(spec.x - x, spec.z - z), group: g, seat: s });
      i += 1;
    }
  }
  return out;
}

export const MAGDUR_SEATS = buildSeats();

export function magdurGroup(index: number) {
  return SPECS[index];
}

export function magdurRomans() {
  const out: { x: number; z: number; yaw: number }[] = [];
  for (let i = 0; i < MAGDUR_ROMANS; i++) {
    const ang = (i / MAGDUR_ROMANS) * Math.PI * 2 + 0.35;
    const x = Math.cos(ang) * 15.5;
    const z = Math.sin(ang) * 15.5;
    out.push({ x, z, yaw: Math.atan2(-x, -z) });
  }
  return out;
}

export const MAGDUR_ROMAN_POSTS = magdurRomans();

type Death = { i: number; t: number; roman: number };

function buildDeaths(): Death[] {
  const first = MAGDUR_SEATS.find((seat) => seat.group === 0 && seat.seat === 1) ?? MAGDUR_SEATS[0];
  const ring = MAGDUR_SEATS.filter((seat) => seat.group === 1);
  const used = new Set<number>([first.i, ...ring.map((seat) => seat.i)]);
  const rest = MAGDUR_SEATS.filter((seat) => !used.has(seat.i));
  const out: Death[] = [{ i: first.i, t: 0.42, roman: 0 }];
  ring.forEach((seat, n) => out.push({ i: seat.i, t: 1.4 + n * 0.42, roman: (n % MAGDUR_ROMANS) + 1 }));
  let t = 4.3;
  rest.forEach((seat, n) => {
    out.push({ i: seat.i, t, roman: n % MAGDUR_ROMANS });
    t += n % 5 === 4 ? 0.48 : 1.72;
  });
  return out.sort((a, b) => a.t - b.t);
}

export const MAGDUR_DEATHS = buildDeaths();

const deathAt = new Float32Array(MAGDUR_N);
deathAt.fill(1e6);
for (const death of MAGDUR_DEATHS) deathAt[death.i] = death.t;

export function magdurFall(i: number, t: number) {
  const when = deathAt[i];
  if (t < when) return 0;
  const k = Math.min(1, (t - when) / 0.85);
  return k * k * (3 - 2 * k);
}

export function magdurRoster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-MAGDUR_N);
  const out = Array.from({ length: MAGDUR_N }, () => "");
  const start = MAGDUR_N - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function magdurMarkReady() {
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function magdurIsReady() {
  return ready;
}

export function magdurWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function magdurHold() {
  playAt = 0;
}

export function magdurStart() {
  playAt = performance.now() / 1000;
}

export function magdurT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function magdurReset() {
  ready = false;
  playAt = 0;
}

export function isMagdur(id: string | null | undefined): id is MagdurId {
  return id === MAGDUR_ID;
}

export type MagdurSpear = { x: number; y: number; z: number; dx: number; dy: number; dz: number };

export function magdurSpear(
  t: number,
  hit: number,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  out: MagdurSpear,
) {
  const born = hit - FLIGHT;
  if (t < born || t > hit + 0.28) return false;
  const u = Math.min(1, (t - born) / FLIGHT);
  const at = (k: number) => ({
    x: from.x + (to.x - from.x) * k,
    z: from.z + (to.z - from.z) * k,
    y: from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * 1.35,
  });
  const here = at(u);
  const next = at(Math.min(1, u + 0.04));
  out.x = here.x;
  out.y = here.y;
  out.z = here.z;
  out.dx = next.x - here.x;
  out.dy = next.y - here.y;
  out.dz = next.z - here.z;
  return true;
}

function rideSpear(t: number, death: Death): MagdurCam {
  const seat = MAGDUR_SEATS[death.i];
  const post = MAGDUR_ROMAN_POSTS[death.roman];
  const from = { x: post.x, y: 1.55, z: post.z };
  const to = { x: seat.x, y: 1.2, z: seat.z };
  const born = death.t - FLIGHT;
  const u = Math.min(1, Math.max(0, (t - born) / FLIGHT));
  const x = from.x + (to.x - from.x) * u;
  const z = from.z + (to.z - from.z) * u;
  const y = from.y + (to.y - from.y) * u + Math.sin(u * Math.PI) * 1.35;
  const dx = to.x - x;
  const dy = to.y - y;
  const dz = to.z - z;
  const len = Math.hypot(dx, dy, dz) || 1;
  return {
    x: x - (dx / len) * 2.4,
    y: y - (dy / len) * 2.4 + 0.85,
    z: z - (dz / len) * 2.4,
    lx: seat.x,
    ly: 1.15,
    lz: seat.z,
    fov: 38,
  };
}

function topGroup(t: number, group: number): MagdurCam {
  const spec = SPECS[group] ?? SPECS[0];
  const ang = t * 0.55;
  return {
    x: spec.x + Math.cos(ang) * 4.2,
    y: 6.6 + Math.sin(t * 1.4) * 0.28,
    z: spec.z + Math.sin(ang) * 4.2,
    lx: spec.x,
    ly: 0.35,
    lz: spec.z,
    fov: 46,
  };
}

function eyeCam(t: number, death: Death): MagdurCam {
  const seat = MAGDUR_SEATS[death.i];
  const post = MAGDUR_ROMAN_POSTS[death.roman];
  const fall = magdurFall(death.i, t);
  const spear = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
  const live = magdurSpear(t, death.t, { x: post.x, y: 1.55, z: post.z }, { x: seat.x, y: 1.2, z: seat.z }, spear);
  return {
    x: seat.x + Math.sin(seat.yaw) * 0.35,
    y: 1.48 - fall * 0.9,
    z: seat.z + Math.cos(seat.yaw) * 0.35,
    lx: live ? spear.x : post.x,
    ly: live ? spear.y : 1.3,
    lz: live ? spear.z : post.z,
    fov: 52 - fall * 6,
  };
}

function throwCam(t: number, death: Death): MagdurCam {
  const post = MAGDUR_ROMAN_POSTS[death.roman];
  const seat = MAGDUR_SEATS[death.i];
  const u = (t % 4.2) / 4.2;
  return {
    x: post.x + Math.cos(post.yaw) * (2.4 - u * 0.6),
    y: 1.7,
    z: post.z + Math.sin(post.yaw) * 0.4,
    lx: seat.x,
    ly: 1.1,
    lz: seat.z,
    fov: 42,
  };
}

function deathNear(t: number) {
  let best = MAGDUR_DEATHS[0];
  let score = Infinity;
  for (const death of MAGDUR_DEATHS) {
    const d = Math.abs(death.t - t);
    if (d < score) {
      score = d;
      best = death;
    }
  }
  return best;
}

export function magdurCam(t: number): MagdurCam {
  if (t < 1.05) return rideSpear(t, MAGDUR_DEATHS[0]);
  if (t < 3.7) return topGroup(t, 1);
  const beat = Math.floor((t - 3.7) / 4.2);
  const kind = beat % 3;
  const death = deathNear(t);
  const seat = MAGDUR_SEATS[death.i];
  if (kind === 0) return eyeCam(t, death);
  if (kind === 1) return throwCam(t, death);
  return topGroup(t, seat.group);
}

export function magdurCard(t: number): { lines: readonly string[]; opacity: number } | null {
  if (t >= 3.75) return null;
  const fade = t < 3.15 ? 1 : 1 - (t - 3.15) / 0.6;
  return { lines: MAGDUR_HOOK, opacity: Math.max(0, fade) };
}
