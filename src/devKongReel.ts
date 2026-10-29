export const DEVKONG_ID = "dev-kong" as const;
export type DevKongId = typeof DEVKONG_ID;
export const DEVKONG_MODE = { id: DEVKONG_ID, label: "dev-kong" } as const;
export const DEVKONG_SECONDS = 52;
export const DEVKONG_OURS = 200;
export const DEVKONG_KNIGHT = "/models/knight.glb";
export const DEVKONG_KONG = "/models/bigfoot.glb";
export const DEVKONG_URLS = [DEVKONG_KNIGHT, DEVKONG_KONG] as const;

const OPEN_END = 3.7;
const FLIGHT = 0.72;
const BEAT = 4.6;

export type DevKongCam = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

export function devKongZ(t: number) {
  const base = 36 - Math.min(1, t / 50) * 18;
  if (t < 1.05) return base - (t / 1.05) * 2.6;
  const back = Math.min(1, (t - 1.05) / 1.5);
  const s = back * back * (3 - 2 * back);
  return base - 2.6 * (1 - s);
}

export function devKongHp(t: number) {
  const u = Math.min(1, Math.max(0, t) / 50);
  return 1 - u * 0.72;
}

export function devFriend(i: number) {
  const col = i % 10;
  const row = Math.floor(i / 10);
  return { x: (col - 4.5) * 1.48, z: -1.8 - row * 1.42, yaw: 0 };
}

export function devKongRoster(names: readonly string[]) {
  const last = names.map((name) => name.trim()).filter(Boolean).slice(-DEVKONG_OURS);
  const out = Array.from({ length: DEVKONG_OURS }, () => "");
  const start = DEVKONG_OURS - last.length;
  for (let i = 0; i < last.length; i++) out[start + i] = last[i];
  return out;
}

type Volley = { i: number; t: number; spear: boolean };

function buildVolley(): Volley[] {
  const out: Volley[] = [];
  let t = 0.34;
  let n = 0;
  while (t < DEVKONG_SECONDS - 0.4) {
    out.push({ i: (n * 13) % DEVKONG_OURS, t, spear: n % 2 === 0 });
    t += 0.36;
    n += 1;
  }
  return out;
}

export const DEVKONG_VOLLEY = buildVolley();

export type DevKongShot = { x: number; y: number; z: number; dx: number; dy: number; dz: number };

export function devKongBolt(volley: Volley, t: number, out: DevKongShot) {
  const born = volley.t - FLIGHT;
  if (t < born || t > volley.t + 0.05) return false;
  const seat = devFriend(volley.i);
  const u = Math.min(1, (t - born) / FLIGHT);
  const aim = { x: 0, y: volley.spear ? 8.2 : 11.4, z: devKongZ(volley.t) };
  const from = { x: seat.x, y: 1.45, z: seat.z + 0.4 };
  const at = (k: number) => ({
    x: from.x + (aim.x - from.x) * k,
    z: from.z + (aim.z - from.z) * k,
    y: from.y + (aim.y - from.y) * k + Math.sin(k * Math.PI) * (volley.spear ? 2.4 : 3.6),
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

function footCam(t: number): DevKongCam {
  const z0 = devKongZ(0);
  const u = Math.min(1, t / 1.05);
  return {
    x: 7.4,
    y: 6.8,
    z: z0 - 56,
    lx: 0,
    ly: 7.2,
    lz: devKongZ(t),
    fov: 28 - u,
  };
}

function soldierEye(t: number): DevKongCam {
  const seat = devFriend(4);
  return {
    x: seat.x + Math.sin(t * 0.4) * 0.15,
    y: 1.62,
    z: seat.z + 0.55,
    lx: 0,
    ly: 6.6,
    lz: devKongZ(t),
    fov: 42,
  };
}

function soldierTps(t: number): DevKongCam {
  const seat = devFriend(14);
  return {
    x: seat.x - 0.35,
    y: 2.85,
    z: seat.z - 5.2,
    lx: 0.2,
    ly: 5.6,
    lz: devKongZ(t) + 1,
    fov: 46,
  };
}

function lineCam(t: number): DevKongCam {
  return {
    x: Math.sin(t * 0.25) * 1.4,
    y: 2.7,
    z: -11.2,
    lx: 0,
    ly: 5.8,
    lz: devKongZ(t),
    fov: 50,
  };
}

function kongShoulder(t: number): DevKongCam {
  const z = devKongZ(t);
  return {
    x: 5.6,
    y: 13.2,
    z: z - 4.8,
    lx: 0.4,
    ly: 1.2,
    lz: -9,
    fov: 44,
  };
}

function kongEye(t: number): DevKongCam {
  const z = devKongZ(t);
  return {
    x: 0.15 + Math.sin(t * 0.3) * 0.15,
    y: 16.6,
    z: z - 2.4,
    lx: Math.sin(t * 0.22) * 0.8,
    ly: 0.9,
    lz: -7,
    fov: 40,
  };
}

export function devKongCam(t: number): DevKongCam {
  if (t < 1.05) return footCam(t);
  if (t < OPEN_END) return kongEye(t);
  const kind = Math.floor((t - OPEN_END) / BEAT) % 5;
  if (kind === 0) return soldierEye(t);
  if (kind === 1) return soldierTps(t);
  if (kind === 2) return lineCam(t);
  if (kind === 3) return kongShoulder(t);
  return kongEye(t);
}

export function devKongNames(t: number) {
  if (t < OPEN_END) return false;
  return Math.floor((t - OPEN_END) / BEAT) % 5 <= 2;
}

export function devKongHideHp(t: number) {
  if (t < 1.05) return false;
  if (t < OPEN_END) return true;
  return Math.floor((t - OPEN_END) / BEAT) % 5 >= 3;
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function devKongMarkReady() {
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function devKongIsReady() {
  return ready;
}

export function devKongWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function devKongHold() {
  playAt = 0;
}

export function devKongStart() {
  playAt = performance.now() / 1000;
}

export function devKongT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function devKongReset() {
  ready = false;
  playAt = 0;
}

export function isDevKong(id: string | null | undefined): id is DevKongId {
  return id === DEVKONG_ID;
}
