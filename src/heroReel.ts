export const HERO_ID = "kahramanlar" as const;
export type HeroId = typeof HERO_ID;
export const HERO_MODE = { id: HERO_ID, label: "kahramanlar" } as const;
export const HERO_SECONDS = 12;
export const HERO_N = 15;

export const HERO_URLS = [
  "/models/heroes/armored.glb",
  "/models/heroes/fantasy-a.glb",
  "/models/heroes/fantasy-b.glb",
  "/models/heroes/fantasy.glb",
  "/models/heroes/medieval.glb",
] as const;

// fantasy.glb helmet sticks out toward local -Z. The others face +Z.
export const HERO_YAW = [0, 0, 0, Math.PI, 0];

const PX = 1.28;
const PZ = 1.12;
const LAYOUT = [4, 0, 4, 1, 2, 1, 2, 4, 3, 3, 0, 3, 0, 1, 2];

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
  const row = Math.floor(i / 3);
  const col = i % 3;
  return {
    x: (col - 1) * PX,
    z: (row - 4) * PZ,
    model: LAYOUT[i] ?? 0,
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
    y: 1.58,
    z: 9.2 - u * 0.65,
    lx: 0,
    ly: 1.2,
    lz: -1.6,
    fov: 42,
  };
}
