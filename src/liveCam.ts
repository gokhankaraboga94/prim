type LiveCamState = {
  speed: number;
  fov: number;
  height: number | null;
  tick: number;
  restore: number;
};

export const liveCam: LiveCamState = {
  speed: 1,
  fov: 36,
  height: null,
  tick: 0,
  restore: 0,
};

const listeners = new Set<() => void>();

function poke() {
  liveCam.tick += 1;
  for (const fn of listeners) fn();
}

export function setLiveCam(patch: Partial<Pick<LiveCamState, "speed" | "fov" | "height">>) {
  if (patch.speed != null) liveCam.speed = patch.speed;
  if (patch.fov != null) liveCam.fov = patch.fov;
  if ("height" in patch) liveCam.height = patch.height ?? null;
  poke();
}

export function resetLiveCam() {
  liveCam.speed = 1;
  liveCam.fov = 36;
  liveCam.height = null;
  liveCam.restore += 1;
  poke();
}

export function subscribeLiveCam(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
