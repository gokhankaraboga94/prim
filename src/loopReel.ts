export const LOOP_ID = "loop" as const;
export type LoopId = typeof LOOP_ID;
export const LOOP_MODE = { id: LOOP_ID, label: "8 asker" } as const;
export const LOOP_SECONDS = 6;
export const LOOP_HERO = "/models/new/elf-lite.glb";

export function isLoop(id: string | null | undefined): id is LoopId {
  return id === LOOP_ID;
}

/** Five face the camera. Two sit at the edges, in the shadow. There is no eighth. */
export const LOOP_SPOTS = [
  { x: -1.35, y: 0, z: 0.95, yaw: 0, hard: false },
  { x: 1.35, y: 0, z: 0.85, yaw: 0.08, hard: false },
  { x: -0.7, y: 0, z: -0.35, yaw: -0.06, hard: false },
  { x: 0.75, y: 0, z: -0.45, yaw: 0.05, hard: false },
  { x: 0.05, y: 0, z: 0.35, yaw: 0, hard: false },
  { x: -3.25, y: 0, z: -2.55, yaw: 1.4, hard: true },
  { x: 3.05, y: 0, z: -0.95, yaw: -0.35, hard: true },
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

/** Locked front angle. Faces the line, so the first and last frames match. */
export function loopCam(_t: number): LoopCamShot {
  return {
    x: 0,
    y: 2.65,
    z: 9.2,
    lx: 0,
    ly: 1.45,
    lz: 0.15,
    fov: 56,
  };
}
