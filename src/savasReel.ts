export const SAVAS_ID = "savas" as const;
export type SavasId = typeof SAVAS_ID;
export const SAVAS_MODE = { id: SAVAS_ID, label: "savaş" } as const;
export const SAVAS_SECONDS = 36;
export const SAVAS_OURS = 80;
export const SAVAS_KNIGHT = "/models/knight.glb";
export const SAVAS_BLUE = "/models/blue.glb";
export const SAVAS_URLS = [SAVAS_KNIGHT, SAVAS_BLUE] as const;

const OPEN_END = 3.7;
const FLIGHT = 0.62;
const BEAT = 4.8;

export type SavasCam = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

/** He stays planted and pounds. The opening step is only so the slam enters the lens. */
export function savasZ(t: number) {
  if (t < 1.05) return 10 - (t / 1.05) * 4.2;
  const u = Math.min(1, (t - 1.05) / 32);
  return 5.8 - u * 1.4;
}

export function savasHp(t: number) {
  const u = Math.min(1, Math.max(0, t) / 34);
  return 1 - u * 0.64;
}

export function savasFriend(i: number) {
  const col = i % 8;
  const row = Math.floor(i / 8);
  return { x: (col - 3.5) * 1.45, z: -2.2 - row * 1.38, yaw: 0 };
}

export function savasRoster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-SAVAS_OURS);
  const out = Array.from({ length: SAVAS_OURS }, () => "");
  const start = SAVAS_OURS - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

type Volley = { i: number; t: number };

function buildVolley(): Volley[] {
  const out: Volley[] = [];
  let t = 0.42;
  let n = 0;
  while (t < SAVAS_SECONDS - 0.3) {
    out.push({ i: (n * 11) % SAVAS_OURS, t });
    t += 0.42;
    n += 1;
  }
  return out;
}

export const SAVAS_VOLLEY = buildVolley();

export type SavasShot = { x: number; y: number; z: number; dx: number; dy: number; dz: number };

export function savasBolt(volley: Volley, t: number, out: SavasShot) {
  const born = volley.t - FLIGHT;
  if (t < born || t > volley.t + 0.05) return false;
  const seat = savasFriend(volley.i);
  const u = Math.min(1, (t - born) / FLIGHT);
  const aim = { x: 0, y: 4.4, z: savasZ(volley.t) };
  const from = { x: seat.x, y: 1.45, z: seat.z + 0.35 };
  const at = (k: number) => ({
    x: from.x + (aim.x - from.x) * k,
    z: from.z + (aim.z - from.z) * k,
    y: from.y + (aim.y - from.y) * k + Math.sin(k * Math.PI) * 1.8,
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

function faceCam(t: number): SavasCam {
  return {
    x: 1.7,
    y: 2.5,
    z: 3.6,
    lx: 0,
    ly: 3.5,
    lz: savasZ(t),
    fov: 32,
  };
}

function soldierEye(t: number): SavasCam {
  return {
    x: 0.4,
    y: 1.85,
    z: -7.4,
    lx: 0,
    ly: 3.6,
    lz: savasZ(t),
    fov: 48,
  };
}

function soldierTps(t: number): SavasCam {
  const seat = savasFriend(12);
  return {
    x: seat.x - 0.3,
    y: 2.7,
    z: seat.z - 4.4,
    lx: 0,
    ly: 3.8,
    lz: savasZ(t),
    fov: 48,
  };
}

function shoulder(t: number): SavasCam {
  const z = savasZ(t);
  return {
    x: 3.4,
    y: 6.2,
    z: z - 1.6,
    lx: 0,
    ly: 1.3,
    lz: -8,
    fov: 42,
  };
}

function eye(t: number): SavasCam {
  const z = savasZ(t);
  return {
    x: 0.2,
    y: 8.7,
    z: z - 1.35,
    lx: Math.sin(t * 0.2) * 0.6,
    ly: 1.1,
    lz: -5,
    fov: 40,
  };
}

export function savasCam(t: number): SavasCam {
  if (t < 1.05) return faceCam(t);
  if (t < OPEN_END) return soldierEye(t);
  const kind = Math.floor((t - OPEN_END) / BEAT) % 4;
  if (kind === 0) return soldierEye(t);
  if (kind === 1) return soldierTps(t);
  if (kind === 2) return shoulder(t);
  return eye(t);
}

export function savasNames(t: number) {
  return t >= OPEN_END;
}

export function savasHideHp(t: number) {
  if (t < OPEN_END) return false;
  return Math.floor((t - OPEN_END) / BEAT) % 4 >= 2;
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function savasMarkReady() {
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function savasIsReady() {
  return ready;
}

export function savasWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function savasHold() {
  playAt = 0;
}

export function savasStart() {
  playAt = performance.now() / 1000;
}

export function savasT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function savasReset() {
  ready = false;
  playAt = 0;
}

export function isSavas(id: string | null | undefined): id is SavasId {
  return id === SAVAS_ID;
}
