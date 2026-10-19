export const HERO_ID = "kahramanlar" as const;
export type HeroId = typeof HERO_ID;
export const HERO_MODE = { id: HERO_ID, label: "kahramanlar" } as const;
export const HERO_SECONDS = 12;
export const HERO_N = 5;

export const HERO_URLS = [
  "/models/heroes/armored.glb",
  "/models/heroes/fantasy-a.glb",
  "/models/heroes/fantasy-b.glb",
  "/models/heroes/fantasy.glb",
  "/models/heroes/medieval.glb",
] as const;

// fantasy.glb helmet sticks out toward local -Z. The others face +Z.
export const HERO_YAW = [0, 0, 0, Math.PI, 0];

const PX = 1.4;
const ORDER = [0, 1, 4, 2, 3];

export function isHero(id: string | null | undefined): id is HeroId {
  return id === HERO_ID;
}

export function heroLatest(names: string[]): string[] {
  const picked: string[] = [];
  const seen = new Set<string>();
  for (let i = names.length - 1; i >= 0 && picked.length < HERO_N; i--) {
    const raw = String(names[i] || "").trim().replace(/^@+/, "");
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(raw);
  }
  picked.reverse();
  return picked;
}

export function heroSlot(i: number) {
  return {
    x: (i - 2) * PX,
    z: 0,
    model: ORDER[i] ?? i,
  };
}

export type HeroCam = {
  x: number;
  y: number;
  z: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

export function heroCam(t: number): HeroCam {
  const u = Math.max(0, Math.min(1, t / HERO_SECONDS));
  return {
    x: 0,
    y: 1.72,
    z: 14.4 - u * 0.45,
    lx: 0,
    ly: 1.05,
    lz: 0,
    fov: 48,
  };
}
