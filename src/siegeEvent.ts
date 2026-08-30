export const SALLY_CYCLE = 60;
export const SALLY_LEN = 10;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export function smooth01(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export function sallyLocal(now: number) {
  return now % SALLY_CYCLE;
}

export function sallyGate(p: number) {
  if (p >= SALLY_LEN) return 0;
  if (p < 1.7) return smooth01(p / 1.7);
  if (p < 7.5) return 1;
  return 1 - smooth01((p - 7.5) / 2.5);
}

export function sallyMarch(p: number) {
  if (p < 1.6) return 0;
  if (p < 3.3) return smooth01((p - 1.6) / 1.7);
  if (p < 6.1) return 1;
  if (p < 7.9) return 1 - smooth01((p - 6.1) / 1.8);
  return 0;
}

export function sallyDuck(p: number) {
  if (p < 3.05) return 0;
  if (p < 3.55) return smooth01((p - 3.05) / 0.5);
  if (p < 6.05) return 1;
  if (p < 6.9) return 1 - smooth01((p - 6.05) / 0.85);
  return 0;
}

export function sallyThrowAt(p: number, i: number) {
  return 3.15 + i * 0.28;
}
