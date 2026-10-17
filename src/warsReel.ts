export const WARS_ID = "wars" as const;
export type WarsId = typeof WARS_ID;
export const WARS_MODE = { id: WARS_ID, label: "WARS" } as const;
export const WARS_SECONDS = 26;

export const WARS_FRIENDS = 50;
export const WARS_FOES = 200;
export const WARS_RING_IN = 13.7;
export const WARS_RING_OUT = 15.3;

const ROMAN_RINGS = [70, 70, 60];

export function isWars(id: string | null | undefined): id is WarsId {
  return id === WARS_ID;
}

function ramp(t: number, a: number, b: number) {
  const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

export function warsCam(t: number) {
  const spin = t * 0.035;
  return { x: Math.sin(spin) * 48, y: 56, z: Math.cos(spin) * 48, lx: 0, ly: 0.5, lz: 0, fov: 46 };
}

export function warsKnight(i: number, t: number) {
  const outer = i >= 20;
  const local = outer ? i - 20 : i;
  const n = outer ? 30 : 20;
  const die = 8.2 + i * 0.19;
  const fall = t < die ? 0 : Math.min(1, (t - die) / 0.62);
  const meet = ramp(t, 2.2, 7.4);
  const a = (local / n) * Math.PI * 2 + (outer ? 0.16 : 0);
  const r = (outer ? 6.1 : 3.3) + meet * 1.45;
  const jab = fall > 0 ? 0 : Math.max(0, Math.sin(t * 8.4 + i)) * 0.22;
  const x = Math.sin(a) * (r + jab);
  const z = Math.cos(a) * (r + jab);
  return { x, z, yaw: Math.atan2(x, z), fall };
}

export function warsRoman(i: number, t: number) {
  let ring = 0;
  let local = i;
  if (i >= ROMAN_RINGS[0]) {
    ring = i >= ROMAN_RINGS[0] + ROMAN_RINGS[1] ? 2 : 1;
    local = ring === 2 ? i - ROMAN_RINGS[0] - ROMAN_RINGS[1] : i - ROMAN_RINGS[0];
  }
  const n = ROMAN_RINGS[ring];
  const die = i < 42 ? 9.1 + (i % 42) * 0.24 : 1e9;
  const fall = t < die ? 0 : Math.min(1, (t - die) / 0.55);
  const meet = ramp(t, 2.2, 8.1);
  const start = [12.7, 10.7, 8.8][ring];
  const end = [10.9, 8.9, 7.2][ring];
  const a = (local / n) * Math.PI * 2 + ring * 0.09;
  const r = start + (end - start) * meet + fall * 0.28;
  const jab = fall > 0 ? 0 : Math.max(0, Math.sin(t * 7.1 + i * 1.6)) * 0.2;
  const x = Math.sin(a) * (r - jab);
  const z = Math.cos(a) * (r - jab);
  return { x, z, yaw: Math.atan2(-x, -z) - Math.PI / 2, fall };
}
