export type GameState = {
  soldiers: number;
  instagramHandle: string;
  names: string[];
  updatedAt: number;
  castleLevel: number;
  castleHp: number;
  hpAt: number;
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

export type SiegeView = {
  level: number;
  hp: number;
  maxHp: number;
  target: number;
  pressure: number;
};

const LEVEL_HP = [0, 10_000, 50_000, 250_000, 1_000_000, 5_000_000, 25_000_000];
const LEVEL_TARGET = [0, 10_000, 50_000, 250_000, 1_000_000, 5_000_000, 25_000_000];

export const DEFAULT_GAME: GameState = {
  soldiers: 0,
  instagramHandle: "inshesabi",
  names: [],
  updatedAt: 0,
  castleLevel: 1,
  castleHp: LEVEL_HP[1],
  hpAt: 0,
};

export const DPS_PER_SOLDIER = 10_000 / (10_000 * 12 * 86400);

export function maxHpForLevel(level: number): number {
  const lv = Math.max(1, Math.floor(level));
  if (lv < LEVEL_HP.length) return LEVEL_HP[lv];
  return Math.floor(LEVEL_HP[LEVEL_HP.length - 1] * Math.pow(5, lv - (LEVEL_HP.length - 1)));
}

export function targetForLevel(level: number): number {
  const lv = Math.max(1, Math.floor(level));
  if (lv < LEVEL_TARGET.length) return LEVEL_TARGET[lv];
  return Math.floor(LEVEL_TARGET[LEVEL_TARGET.length - 1] * Math.pow(5, lv - (LEVEL_TARGET.length - 1)));
}

export function parseGame(v: Partial<GameState> | null): GameState {
  const soldiers = Math.max(0, Math.floor(Number(v?.soldiers) || 0));
  const instagramHandle = String(v?.instagramHandle || DEFAULT_GAME.instagramHandle);
  const updatedAt = Number(v?.updatedAt) || 0;
  const castleLevel = Math.max(1, Math.floor(Number(v?.castleLevel) || 1));
  const hasHp = Number.isFinite(Number(v?.castleHp));
  const hpAt = Number(v?.hpAt) > 0 ? Number(v?.hpAt) : updatedAt;
  const rawNames = coerceNames(v?.names);
  const names = compactNames(
    rawNames.map((item) => normalizeHandle(String(item || ""))),
    soldiers
  );
  return {
    soldiers,
    instagramHandle,
    names,
    updatedAt,
    castleLevel,
    castleHp: hasHp ? Math.max(0, Number(v?.castleHp)) : maxHpForLevel(castleLevel),
    hpAt,
  };
}

export function resolveSiege(game: GameState, now = Date.now()): SiegeView {
  const soldiers = Math.max(0, game.soldiers);
  let level = Math.max(1, Math.floor(game.castleLevel || 1));
  let hp = Number.isFinite(game.castleHp) ? game.castleHp : maxHpForLevel(level);
  const started = game.hpAt > 0 ? game.hpAt : now;
  const elapsed = Math.max(0, (now - started) / 1000);
  hp -= soldiers * DPS_PER_SOLDIER * elapsed;

  while (hp <= 0 && level < 80) {
    level += 1;
    hp += maxHpForLevel(level);
  }

  const maxHp = maxHpForLevel(level);
  hp = Math.min(maxHp, Math.max(0, hp));
  const pressure = Math.min(0.97, 1 - hp / maxHp);

  return {
    level,
    hp,
    maxHp,
    target: targetForLevel(level),
    pressure,
  };
}

export function toGameRecord(
  game: GameState,
  now: number,
  patch: Partial<Pick<GameState, "soldiers" | "instagramHandle" | "names">> = {}
): GameState {
  const siege = resolveSiege(game, now);
  const soldiers = patch.soldiers ?? game.soldiers;
  return {
    soldiers,
    instagramHandle: patch.instagramHandle ?? game.instagramHandle,
    names: compactNames(patch.names ?? game.names, soldiers),
    updatedAt: now,
    castleLevel: siege.level,
    castleHp: siege.hp,
    hpAt: now,
  };
}

export function formatCount(n: number): string {
  const v = Math.max(0, Math.floor(n));
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  return v.toLocaleString("tr-TR");
}

export function formatPower(n: number): string {
  return Math.max(0, n).toLocaleString("tr-TR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").replace(/[^\w.]/g, "").slice(0, 30);
}

function coerceNames(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((item) => String(item || ""));
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const idxs = Object.keys(obj)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0);
    if (!idxs.length) return [];
    const max = Math.max(...idxs);
    return Array.from({ length: max + 1 }, (_, i) => String(obj[i] ?? ""));
  }
  return [];
}

export function parseNameList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const name = normalizeHandle(part);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

export function compactNames(names: string[], soldiers: number): string[] {
  const next = names.slice(0, Math.max(0, soldiers)).map((n) => normalizeHandle(n));
  while (next.length && !next[next.length - 1]) next.pop();
  return next;
}

export function namedCount(names: string[], soldiers: number): number {
  let n = 0;
  const cap = Math.max(0, soldiers);
  for (let i = 0; i < cap && i < names.length; i++) if (names[i]) n += 1;
  return n;
}

export function assignNames(existing: string[], soldiers: number, incoming: string[]): string[] {
  const cap = Math.max(0, Math.floor(soldiers));
  const names = Array.from({ length: cap }, (_, i) => normalizeHandle(existing[i] || ""));
  const empty: number[] = [];
  for (let i = 0; i < cap; i++) if (!names[i]) empty.push(i);
  for (let i = empty.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = empty[i];
    empty[i] = empty[j];
    empty[j] = swap;
  }
  const take = incoming.slice(0, empty.length);
  take.forEach((name, k) => {
    names[empty[k]] = name;
  });
  return compactNames(names, cap);
}

export function instagramUrl(handle: string): string {
  const h = normalizeHandle(handle);
  return h ? `https://www.instagram.com/${h}/` : "https://www.instagram.com/";
}
