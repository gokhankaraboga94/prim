export const HERO_ID = "kahramanlar" as const;
export type HeroId = typeof HERO_ID;
export const HERO_MODE = { id: HERO_ID, label: "kahramanlar" } as const;
export const HERO_SECONDS = 36;
export const HERO_N = 5;

export const HERO_URLS = [
  "/models/heroes/armored.glb",
  "/models/heroes/fantasy-a.glb",
  "/models/heroes/fantasy-b.glb",
  "/models/heroes/fantasy.glb",
  "/models/heroes/medieval.glb",
] as const;

export const HERO_YAW = [0, 0, 0, 0, 0];

const RING = 2.35;

export function isHero(id: string | null | undefined): id is HeroId {
  return id === HERO_ID;
}

export function heroRoster(names: string[]): string[] {
  const picked: string[] = [];
  const seen = new Set<string>();
  for (let i = names.length - 1; i >= 0; i--) {
    const raw = String(names[i] || "").trim().replace(/^@+/, "");
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(raw);
  }
  return picked;
}

export function heroNameIndex(i: number, t: number, count: number) {
  if (count <= 0 || i < 0 || i >= HERO_N) return -1;
  if (count <= HERO_N) return i < count ? i : -1;
  const pages = Math.ceil(count / HERO_N);
  const step = Math.min(0.16, HERO_SECONDS / pages);
  const page = Math.floor(Math.max(0, t) / Math.max(step, 1e-4)) % pages;
  const idx = page * HERO_N + i;
  return idx < count ? idx : i % count;
}

export function heroSlot(i: number) {
  const a = (i / HERO_N) * Math.PI * 2;
  return {
    x: Math.sin(a) * RING,
    z: Math.cos(a) * RING,
    model: i,
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
  const ang = u * Math.PI * 2;
  const dist = 14.2;
  return {
    x: Math.sin(ang) * dist,
    y: 1.72,
    z: Math.cos(ang) * dist,
    lx: 0,
    ly: 1.05,
    lz: 0,
    fov: 48,
  };
}
