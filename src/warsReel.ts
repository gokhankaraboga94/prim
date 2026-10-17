export const WARS_ID = "wars" as const;
export type WarsId = typeof WARS_ID;
export const WARS_MODE = { id: WARS_ID, label: "WARS" } as const;
export const WARS_SECONDS = 26;

export const WARS_FRIENDS = 50;
export const WARS_FOES = 200;
export const WARS_RING_IN = 13.7;

export function isWars(id: string | null | undefined): id is WarsId {
  return id === WARS_ID;
}

const GOLD = Math.PI * (3 - Math.sqrt(5));

function ramp(t: number, a: number, b: number) {
  const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

function mix(i: number, salt: number) {
  let n = Math.imul(i + 1, 374761393) + Math.imul(salt, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function warsCam(t: number) {
  const spin = t * 0.04;
  return { x: Math.sin(spin) * 34.5, y: 22.65, z: Math.cos(spin) * 34.5, lx: 0, ly: 0.6, lz: 0, fov: 58 };
}

export function warsKnight(i: number, t: number) {
  const die = 7.1 + mix(i, 1) * 10.2;
  const fall = t < die ? 0 : Math.min(1, (t - die) / 0.55);
  const meet = ramp(t, 2.0, 7.2);
  const a = i * GOLD + mix(i, 2) * 1.7;
  const r = 2.2 + mix(i, 3) * 4.5 + meet * (0.35 + mix(i, 4) * 1.15);
  const jab = fall > 0 ? 0 : Math.sin(t * 8.2 + mix(i, 11) * 6) * 0.16;
  const x = Math.sin(a) * (r + jab);
  const z = Math.cos(a) * (r + jab);
  return { x, z, yaw: Math.atan2(x, z), fall };
}

export function warsRoman(i: number, t: number) {
  const marked = mix(i, 5) < 0.2;
  const die = marked ? 7.4 + mix(i, 6) * 10.6 : 1e9;
  const fall = t < die ? 0 : Math.min(1, (t - die) / 0.52);
  const meet = ramp(t, 2.0, 8.0);
  const a = i * GOLD * 1.13 + mix(i, 7) * 2.1;
  const start = 8.05 + mix(i, 8) * 4.45;
  const r = start - meet * (0.55 + mix(i, 9) * 1.45) + fall * 0.22;
  const jab = fall > 0 ? 0 : Math.sin(t * 7.1 + mix(i, 12) * 8) * 0.16;
  const x = Math.sin(a) * Math.max(6.6, r - jab);
  const z = Math.cos(a) * Math.max(6.6, r - jab);
  return { x, z, yaw: Math.atan2(-x, -z) - Math.PI / 2, fall };
}
