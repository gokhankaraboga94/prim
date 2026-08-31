export const CASTLE_SX = 3.25;
export const CASTLE_SY = 4;
export const CASTLE_SZ = 3.55;
export const CASTLE_OLD_SZ = 2.15;
export const CASTLE_FRONT_LOCAL = 6.55;

export function castleGrow(level: number) {
  return 1 + Math.min(0.35, (Math.max(1, level) - 1) * 0.02);
}

export function castleAxes(grow: number) {
  const sx = CASTLE_SX * grow;
  const sy = CASTLE_SY * grow;
  const sz = CASTLE_SZ * grow;
  const zShift = CASTLE_FRONT_LOCAL * (CASTLE_OLD_SZ - CASTLE_SZ) * grow;
  return { sx, sy, sz, zShift };
}
