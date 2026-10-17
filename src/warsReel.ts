export const WARS_ID = "wars" as const;
export type WarsId = typeof WARS_ID;
export const WARS_MODE = { id: WARS_ID, label: "WARS" } as const;
export const WARS_SECONDS = 26;

export const WARS_FRIENDS = 50;
export const WARS_FOES = 200;
export const WARS_RING_IN = 6.35;
export const WARS_RING_OUT = 7.15;

const ROMAN_RINGS = [70, 70, 60];

export function isWars(id: string | null | undefined): id is WarsId {
  return id === WARS_ID;
}

function ramp(t: number, a: number, b: number) {
  const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

export function warsCam(t: number) {
  const spin = t * 0.04;
  return { x: Math.sin(spin) * 20, y: 26.5, z: Math.cos(spin) * 20, lx: 0, ly: 0.4, lz: 0, fov: 46 };
}

export function warsKnight(i: number, t: number) {
  const outer = i >= 20;
  const local = outer ? i - 20 : i;
  const n = outer ? 30 : 20;
  const die = 8.2 + i * 0.19;
  const fall = t < die ? 0 : Math.min(1, (t - die) / 0.62);
  const meet = ramp(t, 2.2, 7.4);
  const a = (local / n) * Math.PI * 2 + (outer ? 0.16 : 0);
  const r = (outer ? 2.75 : 1.5) + meet * 0.7;
  const jab = fall > 0 ? 0 : Math.max(0, Math.sin(t * 8.4 + i)) * 0.16;
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
  const start = [5.85, 5.05, 4.2][ring];
  const end = [5.45, 4.4, 3.55][ring];
  const a = (local / n) * Math.PI * 2 + ring * 0.09;
  const r = start + (end - start) * meet + fall * 0.18;
  const jab = fall > 0 ? 0 : Math.max(0, Math.sin(t * 7.1 + i * 1.6)) * 0.14;
  const x = Math.sin(a) * (r - jab);
  const z = Math.cos(a) * (r - jab);
  return { x, z, yaw: Math.atan2(-x, -z), fall };
}
