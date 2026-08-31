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

export function castleFrame(level: number) {
  const grow = castleGrow(level);
  const { sx, sy, sz, zShift } = castleAxes(grow);
  const front = 6.85 * sz + zShift;
  const back = -13.4 * sz + zShift;
  return {
    width: 22.4 * sx,
    height: 9.3 * sy,
    front,
    back,
    midZ: (front + back) / 2,
    midY: 4.4 * sy,
  };
}
