export type GameState = {
  soldiers: number;
  instagramHandle: string;
  updatedAt: number;
};

export type Recruit = {
  id: string;
  username: string;
  createdAt: number;
};

export type ReelItem = {
  id: string;
  url: string;
  type: "image" | "video";
  caption?: string;
  createdAt: number;
};

export const DEFAULT_GAME: GameState = {
  soldiers: 0,
  instagramHandle: "inshesabi",
  updatedAt: 0,
};

export const POWER_BASE = 10_000;
export const POWER_GROWTH = 3;

export function castlePower(level: number): number {
  const safe = Math.max(1, Math.floor(level));
  return Math.floor(POWER_BASE * Math.pow(POWER_GROWTH, safe - 1));
}

export function levelForSoldiers(soldiers: number): number {
  const count = Math.max(0, Math.floor(soldiers));
  let level = 1;
  while (count >= castlePower(level) && level < 500) {
    level += 1;
  }
  return level;
}

export function siegePressure(soldiers: number, power: number): number {
  if (power <= 0) return 0;
  return Math.min(0.97, soldiers / power);
}

export function formatCount(n: number): string {
  const v = Math.max(0, Math.floor(n));
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 10_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return v.toLocaleString("tr-TR");
}

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").replace(/[^\w.]/g, "").slice(0, 30);
}

export function instagramUrl(handle: string): string {
  const h = normalizeHandle(handle);
  return h ? `https://www.instagram.com/${h}/` : "https://www.instagram.com/";
}
