export const LOOP_ID = "loop" as const;
export type LoopId = typeof LOOP_ID;
export const LOOP_MODE = { id: LOOP_ID, label: "8 asker" } as const;
export const LOOP_SECONDS = 6;
export const LOOP_HERO = "/models/new/elf-lite.glb";
/** Model's bind pose looks along -X. This yaws every copy toward the lens. */
export const LOOP_FACE = Math.PI / 2;

export function isLoop(id: string | null | undefined): id is LoopId {
  return id === LOOP_ID;
}

/**
 * Seven copies, scattered in depth. Faces point at the lens (yaw 0).
 * Scale does the size lie: one large, a few mid, two small.
 * The two small ones are the hard finds. There is no eighth.
 */
export const LOOP_SPOTS = [
  { x: -0.85, y: 0, z: 1.7, yaw: 0, scale: 1.78, hard: false },
  { x: 1.65, y: 0, z: 4.05, yaw: 0, scale: 1.32, hard: false },
  { x: -2.45, y: 0, z: -0.2, yaw: 0, scale: 1.18, hard: false },
  { x: 0.45, y: 0, z: -2.7, yaw: 0, scale: 0.9, hard: false },
  { x: 2.75, y: 0, z: 1.85, yaw: 0, scale: 0.78, hard: false },
  { x: -3.15, y: 0, z: -0.15, yaw: 0, scale: 0.52, hard: true },
  { x: 1.05, y: 0, z: -1.05, yaw: 0, scale: 0.4, hard: true },
] as const;

export type LoopCamShot = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

/** Locked front angle. Wider court, first frame matches the last. */
export function loopCam(_t: number): LoopCamShot {
  return {
    x: 0,
    y: 2.55,
    z: 12.2,
    lx: 0,
    ly: 1.8,
    lz: 0.4,
    fov: 54,
  };
}
