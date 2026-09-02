export type GameState = {
  soldiers: number;
  instagramHandle: string;
  names: string[];
  commanders: string[];
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
  commanders: [],
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
  const commanders = compactCommanders(coerceNames(v?.commanders), names);
  return {
    soldiers,
    instagramHandle,
    names,
    commanders,
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
  patch: Partial<Pick<GameState, "soldiers" | "instagramHandle" | "names" | "commanders">> = {}
): GameState {
  const siege = resolveSiege(game, now);
  const soldiers = patch.soldiers ?? game.soldiers;
  const names = compactNames(patch.names ?? game.names, soldiers);
  return {
    soldiers,
    instagramHandle: patch.instagramHandle ?? game.instagramHandle,
    names,
    commanders: compactCommanders(patch.commanders ?? game.commanders, names),
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
  return raw.trim().replace(/^@+/, "").replace(/[^\w.]/g, "");
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

export function renameSoldier(names: string[], soldiers: number, index: number, nextName: string): string[] {
  const cap = Math.max(0, Math.floor(soldiers));
  const next = Array.from({ length: Math.max(cap, names.length) }, (_, i) => normalizeHandle(names[i] || ""));
  if (index < 0 || index >= cap) return compactNames(next, cap);
  next[index] = normalizeHandle(nextName);
  return compactNames(next, cap);
}

export function removeSoldierName(names: string[], soldiers: number, index: number): string[] {
  return renameSoldier(names, soldiers, index, "");
}

export function namedCount(names: string[], soldiers: number): number {
  let n = 0;
  const cap = Math.max(0, soldiers);
  for (let i = 0; i < cap && i < names.length; i++) if (names[i]) n += 1;
  return n;
}

export function compactCommanders(commanders: string[] | undefined, names: string[]): string[] {
  const allowed = new Set(names.map((n) => normalizeHandle(n).toLowerCase()).filter(Boolean));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of commanders || []) {
    const handle = normalizeHandle(raw);
    const key = handle.toLowerCase();
    if (!handle || !allowed.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(handle);
  }
  return out;
}

export function isCommander(handle: string, commanders: string[] | undefined): boolean {
  const key = normalizeHandle(handle).toLowerCase();
  if (!key) return false;
  return (commanders || []).some((c) => normalizeHandle(c).toLowerCase() === key);
}

export function toggleCommander(commanders: string[] | undefined, names: string[], handle: string): string[] {
  const next = compactCommanders(commanders, names);
  const key = normalizeHandle(handle).toLowerCase();
  const idx = next.findIndex((c) => c.toLowerCase() === key);
  if (idx >= 0) next.splice(idx, 1);
  else next.push(normalizeHandle(handle));
  return compactCommanders(next, names);
}

export function retargetCommander(commanders: string[] | undefined, prev: string, nextName: string): string[] {
  const from = normalizeHandle(prev).toLowerCase();
  const to = normalizeHandle(nextName);
  return (commanders || []).map((c) => (normalizeHandle(c).toLowerCase() === from ? to : c));
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

export function enlistWithNames(
  existing: string[],
  soldiers: number,
  incoming: string[],
  extraSoldiers = 0
): { soldiers: number; names: string[]; added: number; named: number } {
  const cap = Math.max(0, Math.floor(soldiers));
  const extra = Math.max(0, Math.floor(extraSoldiers));
  const have = new Set(
    existing
      .slice(0, cap)
      .map((n) => normalizeHandle(n).toLowerCase())
      .filter(Boolean)
  );
  const fresh: string[] = [];
  for (const raw of incoming) {
    const name = normalizeHandle(raw);
    const key = name.toLowerCase();
    if (!name || have.has(key)) continue;
    have.add(key);
    fresh.push(name);
  }
  const grow = Math.max(extra, fresh.length);
  const nextCount = cap + grow;
  const names = Array.from({ length: nextCount }, (_, i) => normalizeHandle(existing[i] || ""));
  fresh.forEach((name, k) => {
    names[cap + k] = name;
  });
  return {
    soldiers: nextCount,
    names: compactNames(names, nextCount),
    added: grow,
    named: fresh.length,
  };
}

export function instagramUrl(handle: string): string {
  const h = normalizeHandle(handle);
  return h ? `https://www.instagram.com/${h}/` : "https://www.instagram.com/";
}
