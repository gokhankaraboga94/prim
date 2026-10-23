export const LOOP_ID = "loop" as const;
export type LoopId = typeof LOOP_ID;
export const LOOP_MODE = { id: LOOP_ID, label: "8 asker" } as const;
export const LOOP_SECONDS = 6;
export const LOOP_HERO = "/models/arena3/armored.glb";

export function isLoop(id: string | null | undefined): id is LoopId {
  return id === LOOP_ID;
}

/** Five stand in the open. Two sit in the shadow. There is no eighth. */
export const LOOP_SPOTS = [
  { x: -1.15, y: 0, z: 0.85, yaw: 0.35, hard: false },
  { x: 1.15, y: 0, z: 0.7, yaw: -0.45, hard: false },
  { x: -1.3, y: 0, z: -0.65, yaw: 1.05, hard: false },
  { x: 1.2, y: 0, z: -0.75, yaw: -1.15, hard: false },
  { x: 0.0, y: 0, z: 0.0, yaw: 0.1, hard: false },
  { x: -3.35, y: 0, z: -3.15, yaw: 1.8, hard: true },
  { x: 3.15, y: 0, z: -0.2, yaw: -1.55, hard: true },
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

/** One locked angle. t does not move the camera, so the first and last frames match. */
export function loopCam(_t: number): LoopCamShot {
  return {
    x: 0.35,
    y: 14.8,
    z: 13.2,
    lx: 0,
    ly: 0.55,
    lz: -0.35,
    fov: 36,
  };
}
