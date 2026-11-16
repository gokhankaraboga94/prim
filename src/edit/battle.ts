import { GROUNDS, MAX_PER_MODEL, MAX_UNITS, TEAMS, characterById, type CharacterDef, type GroundId } from "./catalog";

export type Unit = {
  id: number;
  model: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  yawOffset: number;
  team: number;
  name: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  fall: number;
  pitch: number;
  swing: number;
  cooldown: number;
  radius: number;
  height: number;
  speed: number;
  damage: number;
  aimX: number;
  aimZ: number;
  rank: number;
  /** Takım nizamına ek yerel ofset (sağ / ileri). */
  slotOffR: number;
  slotOffF: number;
  /** Üye taşı ile sabitlendi; nizam sıfırlanana kadar toplu taşımada kıpırdamaz. */
  pinned: boolean;
  /** Mermi izi (saniye). */
  boltAge: number;
  boltX: number;
  boltZ: number;
  boltTX: number;
  boltTZ: number;
  gone?: boolean;
};

export type PlaceMode = "team" | "member";
/** reel = 9:16 çerçeveli; map = tam harita ekranda, dosya yine 9:16 */
export type RecordMode = "reel" | "map";

export type EditStore = {
  units: Unit[];
  byId: Map<number, Unit>;
  selected: Set<number>;
  battle: boolean;
  note: string;
  viewX: number;
  viewZ: number;
  recording: boolean;
  recordMode: RecordMode | null;
  /** Kayıt2: bir kez haritayı kadraja al */
  fitMapOnce: boolean;
  reelU: number;
  reelV: number;
  nextId: number;
  nameStamp: number;
  ground: GroundId;
  placeMode: PlaceMode;
  listeners: Set<() => void>;
  bump: () => void;
};

const FALLBACK_NAMES = ["Eryk", "Mira", "Kael", "Rook", "Sena", "Torin", "Ayla", "Bram", "Nox", "Vale", "Iris", "Holt", "Soren", "Nyx", "Cass"];

export function createStore(): EditStore {
  const store: EditStore = {
    units: [],
    byId: new Map(),
    selected: new Set(),
    battle: false,
    note: "Karakter seç, adet gir, haritaya bırak. Kutuya alıp takım yap, sonra VS.",
    viewX: 0,
    viewZ: 0,
    recording: false,
    recordMode: null,
    fitMapOnce: false,
    reelU: 0.5,
    reelV: 0.5,
    nextId: 1,
    nameStamp: 0,
    ground: "grass",
    placeMode: "team",
    listeners: new Set(),
    bump() {
      for (const fn of store.listeners) fn();
    },
  };
  return store;
}

export function teamLabel(id: number) {
  return TEAMS.find((team) => team.id === id)?.label ?? "Takımsız";
}

function stats(def: CharacterDef, radius: number) {
  const giant = def.height > 6;
  const car = def.kind === "car";
  return {
    radius: car ? Math.max(radius, 1.6) : radius,
    height: def.height,
    speed: car ? 0 : giant ? 4.4 : def.gun ? 2.8 : 3.3,
    /** Araç saldıramaz; sadece hasar yer. */
    damage: car ? 0 : def.gun ? 14 : def.id === "savaci" ? 24 : giant ? 26 : 8,
    maxHp: car ? 600 : giant ? 480 : def.gun ? 110 : 86,
  };
}

export function spawnUnits(store: EditStore, def: CharacterDef, radius: number, count: number) {
  if (store.battle) {
    store.note = "Savaş sürüyor. Durdurunca yeni karakter eklenir.";
    store.bump();
    return 0;
  }
  const have = store.units.filter((unit) => unit.model === def.id).length;
  const room = Math.min(MAX_PER_MODEL - have, MAX_UNITS - store.units.length);
  const n = Math.max(0, Math.min(Math.floor(count) || 1, room));
  if (!n) {
    store.note = "Bu modelden daha fazla sığmıyor.";
    store.bump();
    return 0;
  }
  const fit = stats(def, radius);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const gap = Math.max(1.15, radius * 2.2);
  // Aynı model peş peşe → yakına ama üst üste değil; farklı modeller / takım aralıklı
  const origin = spawnOrigin(store, def.id, (cols - 1) * gap + radius * 2, (rows - 1) * gap + radius * 2);
  // The fresh block becomes the selection so a team button applies to it straight away.
  store.selected.clear();
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const unit: Unit = {
      id: store.nextId++,
      model: def.id,
      x: clampMap(origin.x + (col - (cols - 1) / 2) * gap),
      y: 0,
      z: clampMap(origin.z + (row - (rows - 1) / 2) * gap),
      yaw: def.yaw,
      yawOffset: def.yaw,
      team: 0,
      name: "",
      hp: fit.maxHp,
      maxHp: fit.maxHp,
      alive: true,
      fall: 0,
      pitch: 0,
      swing: 0,
      cooldown: 0.4 + Math.random() * 0.3,
      radius: fit.radius,
      height: fit.height,
      speed: fit.speed,
      damage: fit.damage,
      aimX: 0,
      aimZ: 1,
      rank: -1,
      slotOffR: 0,
      slotOffF: 0,
      pinned: false,
      boltAge: 0,
      boltX: 0,
      boltZ: 0,
      boltTX: 0,
      boltTZ: 0,
    };
    store.units.push(unit);
    store.byId.set(unit.id, unit);
    store.selected.add(unit.id);
  }
  store.nameStamp += 1;
  store.note = n < count ? `${n} ${def.label} eklendi, seçili. Sınır doldu.` : `${n} ${def.label} eklendi, seçili. Takım ver.`;
  store.bump();
  return n;
}

const MAP_LIMIT = 320;

function clampMap(value: number) {
  return Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, value));
}

function blockClear(blockers: Unit[], x: number, z: number, w: number, d: number, pad: number) {
  for (const unit of blockers) {
    if (Math.abs(unit.x - x) < w / 2 + unit.radius + pad && Math.abs(unit.z - z) < d / 2 + unit.radius + pad) return false;
  }
  return true;
}

/** Aynı model peş peşe: kümenin yanına, hafif boşlukla — üst üste değil. */
function spawnOrigin(store: EditStore, modelId: string, w: number, d: number) {
  const loose = store.units.filter((unit) => unit.alive && unit.model === modelId && unit.team <= 0);
  if (loose.length) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const unit of loose) {
      minX = Math.min(minX, unit.x - unit.radius);
      maxX = Math.max(maxX, unit.x + unit.radius);
      minZ = Math.min(minZ, unit.z - unit.radius);
      maxZ = Math.max(maxZ, unit.z + unit.radius);
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const gap = Math.max(2.4, Math.max(w, d) * 0.28 + 1.8);
    const all = store.units.filter((unit) => unit.alive);
    const pad = Math.max(1.2, Math.max(w, d) * 0.12 + 0.8);
    const candidates: { x: number; z: number }[] = [
      { x: maxX + gap + w / 2, z: cz },
      { x: minX - gap - w / 2, z: cz },
      { x: cx, z: maxZ + gap + d / 2 },
      { x: cx, z: minZ - gap - d / 2 },
      { x: maxX + gap + w / 2, z: maxZ + gap + d / 2 },
      { x: minX - gap - w / 2, z: minZ - gap - d / 2 },
      { x: maxX + gap + w / 2, z: minZ - gap - d / 2 },
      { x: minX - gap - w / 2, z: maxZ + gap + d / 2 },
    ];
    for (const c of candidates) {
      const x = clampMap(c.x);
      const z = clampMap(c.z);
      if (blockClear(all, x, z, w, d, pad)) return { x, z };
    }
    // Küme etrafında spiral
    const step = Math.max(w, d) + gap;
    for (let ring = 1; ring <= 10; ring++) {
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2 + ring * 0.2;
        const x = clampMap(cx + Math.sin(ang) * step * ring);
        const z = clampMap(cz + Math.cos(ang) * step * ring);
        if (blockClear(all, x, z, w, d, pad)) return { x, z };
      }
    }
  }
  return freeSpotWithGap(store, w, d, modelId);
}

/**
 * Yeni model: takımlar + diğer modeller üstüne binmesin, arada boşluk olsun.
 */
function freeSpotWithGap(store: EditStore, w: number, d: number, modelId: string) {
  const blockers = store.units.filter((unit) => unit.alive && !(unit.model === modelId && unit.team <= 0));
  if (!blockers.length) return { x: clampMap(store.viewX), z: clampMap(store.viewZ) };

  const pad = Math.max(12, Math.max(w, d) * 0.65 + 10);
  const clear = (x: number, z: number) => blockClear(blockers, x, z, w, d, pad);

  // Mevcut kümelerin merkezlerinden uzak tarafa yerleştir
  const clusters = new Map<string, { x: number; z: number; n: number }>();
  for (const unit of blockers) {
    const key = unit.team > 0 ? `t${unit.team}` : `m${unit.model}`;
    const cur = clusters.get(key);
    if (cur) {
      cur.x += unit.x;
      cur.z += unit.z;
      cur.n += 1;
    } else clusters.set(key, { x: unit.x, z: unit.z, n: 1 });
  }
  let mx = 0;
  let mz = 0;
  let cn = 0;
  for (const c of clusters.values()) {
    mx += c.x / c.n;
    mz += c.z / c.n;
    cn += 1;
  }
  mx /= Math.max(1, cn);
  mz /= Math.max(1, cn);

  const base = Math.max(w, d) + pad + 8;
  for (let ring = 1; ring <= 20; ring++) {
    const dist = base * ring * 0.9;
    const dirs = 8 + (ring > 2 ? 4 : 0);
    for (let k = 0; k < dirs; k++) {
      const ang = (k / dirs) * Math.PI * 2 + ring * 0.37;
      const x = clampMap(mx + Math.sin(ang) * dist);
      const z = clampMap(mz + Math.cos(ang) * dist);
      if (clear(x, z)) return { x, z };
    }
  }

  const stepX = Math.max(w + 8, 16);
  const stepZ = Math.max(d + 8, 16);
  for (let ring = 1; ring < 16; ring++) {
    for (let i = -ring; i <= ring; i++) {
      for (let j = -ring; j <= ring; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const x = clampMap(store.viewX + i * stepX);
        const z = clampMap(store.viewZ + j * stepZ);
        if (clear(x, z)) return { x, z };
      }
    }
  }
  return { x: clampMap(mx + base * 2.2), z: clampMap(mz + base * 0.6) };
}

export function selectAll(store: EditStore) {
  store.selected.clear();
  for (const unit of store.units) if (unit.alive) store.selected.add(unit.id);
  store.note = store.selected.size ? `${store.selected.size} asker seçildi.` : "Haritada asker yok.";
  store.bump();
}

export function clearField(store: EditStore) {
  if (!store.units.length) return;
  const n = store.units.length;
  store.battle = false;
  store.units = [];
  store.byId.clear();
  store.selected.clear();
  store.nameStamp += 1;
  store.note = `${n} asker kaldırıldı. Harita boş.`;
  store.bump();
}

const SAVE_LIB_KEY = "wargame-edit-saves-v2";
const SAVE_KEY_LEGACY = "wargame-edit-scene-v1";
const MAX_SAVES = 40;

type SavedUnit = {
  id: number;
  model: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  yawOffset: number;
  team: number;
  name: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  radius: number;
  height: number;
  speed: number;
  damage: number;
  aimX: number;
  aimZ: number;
  rank: number;
  slotOffR: number;
  slotOffF: number;
  pinned: boolean;
};

type SavedScene = {
  v: 1;
  id: string;
  at: string;
  ground: GroundId;
  viewX: number;
  viewZ: number;
  placeMode: PlaceMode;
  nextId: number;
  nameStamp: number;
  units: SavedUnit[];
};

export type SaveListItem = {
  id: string;
  at: string;
  label: string;
  units: number;
};

type SaveLibrary = { v: 2; saves: SavedScene[] };

function num(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function newSaveId() {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function sortSavesNewest(saves: SavedScene[]) {
  return saves.slice().sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

function readLibrary(): SaveLibrary {
  try {
    const raw = localStorage.getItem(SAVE_LIB_KEY);
    if (raw) {
      const data = JSON.parse(raw) as SaveLibrary;
      if (data && data.v === 2 && Array.isArray(data.saves)) {
        return { v: 2, saves: sortSavesNewest(data.saves.filter((s) => s && s.v === 1 && Array.isArray(s.units))) };
      }
    }
  } catch {
    /* ignore */
  }
  // Eski tek slot → kütüphaneye taşı
  try {
    const legacy = localStorage.getItem(SAVE_KEY_LEGACY);
    if (legacy) {
      const old = JSON.parse(legacy) as SavedScene;
      if (old && old.v === 1 && Array.isArray(old.units)) {
        const migrated: SavedScene = { ...old, id: old.id || newSaveId(), at: old.at || new Date().toISOString() };
        const lib: SaveLibrary = { v: 2, saves: [migrated] };
        localStorage.setItem(SAVE_LIB_KEY, JSON.stringify(lib));
        return lib;
      }
    }
  } catch {
    /* ignore */
  }
  return { v: 2, saves: [] };
}

function writeLibrary(lib: SaveLibrary) {
  localStorage.setItem(SAVE_LIB_KEY, JSON.stringify({ v: 2, saves: sortSavesNewest(lib.saves).slice(0, MAX_SAVES) }));
}

export function listSaves(): SaveListItem[] {
  return readLibrary().saves.map((save) => ({
    id: save.id,
    at: save.at,
    label: new Date(save.at).toLocaleString("tr-TR"),
    units: save.units.length,
  }));
}

export function hasSavedScene() {
  return listSaves().length > 0;
}

/** Tüm save'lerdeki model id'leri (Load öncesi GLB). */
export function peekSavedModels(): string[] {
  const ids = new Set<string>();
  for (const save of readLibrary().saves) {
    for (const row of save.units) {
      if (row && typeof row.model === "string" && characterById(row.model)) ids.add(row.model);
    }
  }
  return [...ids];
}

export function peekSavedModelsFor(id: string): string[] {
  const save = readLibrary().saves.find((item) => item.id === id);
  if (!save) return [];
  const ids = new Set<string>();
  for (const row of save.units) {
    if (row && typeof row.model === "string" && characterById(row.model)) ids.add(row.model);
  }
  return [...ids];
}

export function deleteSave(id: string) {
  const lib = readLibrary();
  lib.saves = lib.saves.filter((save) => save.id !== id);
  try {
    writeLibrary(lib);
    return true;
  } catch {
    return false;
  }
}

export function saveScene(store: EditStore) {
  if (store.recording) {
    store.note = "Kayıt sürerken Save yok. Önce kaydı durdur.";
    store.bump();
    return false;
  }
  const payload: SavedScene = {
    v: 1,
    id: newSaveId(),
    at: new Date().toISOString(),
    ground: store.ground,
    viewX: store.viewX,
    viewZ: store.viewZ,
    placeMode: store.placeMode,
    nextId: store.nextId,
    nameStamp: store.nameStamp,
    units: store.units.map((unit) => ({
      id: unit.id,
      model: unit.model,
      x: unit.x,
      y: unit.y,
      z: unit.z,
      yaw: unit.yaw,
      yawOffset: unit.yawOffset,
      team: unit.team,
      name: unit.name,
      hp: unit.hp,
      maxHp: unit.maxHp,
      alive: unit.alive,
      radius: unit.radius,
      height: unit.height,
      speed: unit.speed,
      damage: unit.damage,
      aimX: unit.aimX,
      aimZ: unit.aimZ,
      rank: unit.rank,
      slotOffR: unit.slotOffR,
      slotOffF: unit.slotOffF,
      pinned: unit.pinned,
    })),
  };
  try {
    const lib = readLibrary();
    lib.saves.unshift(payload);
    writeLibrary(lib);
  } catch {
    store.note = "Save başarısız (tarayıcı depolama dolu olabilir).";
    store.bump();
    return false;
  }
  const when = new Date(payload.at).toLocaleString("tr-TR");
  store.note = `Save OK · ${payload.units.length} birim · ${when} · ${listSaves().length} kayıt`;
  store.bump();
  return true;
}

export function loadScene(store: EditStore, saveId?: string) {
  if (store.recording) {
    store.note = "Kayıt sürerken Load yok. Önce kaydı durdur.";
    store.bump();
    return false;
  }
  const lib = readLibrary();
  if (!lib.saves.length) {
    store.note = "Kayıtlı sahne yok. Önce Save.";
    store.bump();
    return false;
  }
  const data = saveId ? lib.saves.find((save) => save.id === saveId) : lib.saves[0];
  if (!data || data.v !== 1 || !Array.isArray(data.units)) {
    store.note = "Kayıt bulunamadı veya uyumsuz.";
    store.bump();
    return false;
  }

  const grounds = new Set(GROUNDS.map((g) => g.id));
  const units: Unit[] = [];
  let skipped = 0;
  let maxId = 0;
  for (const row of data.units) {
    if (!row || typeof row.model !== "string") {
      skipped += 1;
      continue;
    }
    const def = characterById(row.model);
    if (!def) {
      skipped += 1;
      continue;
    }
    const fit = stats(def, Math.max(0.4, num(row.radius, 0.55)));
    const id = Math.max(1, Math.floor(num(row.id, 0)));
    maxId = Math.max(maxId, id);
    const maxHp = Math.max(1, num(row.maxHp, fit.maxHp));
    const alive = bool(row.alive, true);
    units.push({
      id,
      model: def.id,
      x: clampMap(num(row.x, 0)),
      y: 0,
      z: clampMap(num(row.z, 0)),
      yaw: num(row.yaw, def.yaw),
      yawOffset: num(row.yawOffset, def.yaw),
      team: Math.max(0, Math.floor(num(row.team, 0))),
      name: typeof row.name === "string" ? row.name.slice(0, 40) : "",
      hp: alive ? Math.max(1, Math.min(maxHp, num(row.hp, maxHp))) : 0,
      maxHp,
      alive,
      fall: alive ? 0 : 1,
      pitch: alive ? 0 : 1.5,
      swing: 0,
      cooldown: 0.35,
      radius: fit.radius,
      height: fit.height,
      speed: fit.speed,
      damage: fit.damage,
      aimX: num(row.aimX, 0),
      aimZ: num(row.aimZ, 1),
      rank: Math.floor(num(row.rank, -1)),
      slotOffR: num(row.slotOffR, 0),
      slotOffF: num(row.slotOffF, 0),
      pinned: bool(row.pinned, false),
      boltAge: 0,
      boltX: 0,
      boltZ: 0,
      boltTX: 0,
      boltTZ: 0,
    });
  }

  store.battle = false;
  store.units = units;
  store.byId = new Map(units.map((unit) => [unit.id, unit]));
  store.selected.clear();
  store.ground = grounds.has(data.ground) ? data.ground : "grass";
  store.viewX = clampMap(num(data.viewX, 0));
  store.viewZ = clampMap(num(data.viewZ, 0));
  store.placeMode = data.placeMode === "member" ? "member" : "team";
  store.nextId = Math.max(num(data.nextId, 1), maxId + 1);
  store.nameStamp = Math.max(0, Math.floor(num(data.nameStamp, 0))) + 1;
  const when = data.at ? new Date(data.at).toLocaleString("tr-TR") : "?";
  store.note = skipped
    ? `Load · ${units.length} birim (${skipped} atlandı) · ${when}`
    : `Load · ${units.length} birim · ${when}`;
  store.bump();
  return true;
}

export function unassignTeam(store: EditStore) {
  const picked = store.units.filter((unit) => unit.alive && store.selected.has(unit.id) && unit.team > 0);
  if (!picked.length) {
    store.note = "Takımdan çıkarmak için takımlı asker seç.";
    store.bump();
    return;
  }
  const touched = new Set(picked.map((unit) => unit.team));
  for (const unit of picked) {
    unit.team = 0;
    unit.rank = -1;
  }
  for (const team of touched) dressTeam(store, team);
  store.note = `${picked.length} asker takımdan çıktı.`;
  store.bump();
}

function basis(face: number) {
  return {
    rx: Math.cos(face),
    rz: -Math.sin(face),
    fx: Math.sin(face),
    fz: Math.cos(face),
  };
}

function centroid(units: Unit[]) {
  let x = 0;
  let z = 0;
  for (const unit of units) {
    x += unit.x;
    z += unit.z;
  }
  return { x: x / units.length, z: z / units.length };
}

function faceAim(units: Unit[]) {
  let ax = 0;
  let az = 0;
  for (const unit of units) {
    ax += unit.aimX;
    az += unit.aimZ;
  }
  if (Math.hypot(ax, az) < 0.2) return 0;
  return Math.atan2(ax, az);
}

function teamGap(units: Unit[]) {
  let radius = 0.45;
  for (const unit of units) radius = Math.max(radius, unit.radius);
  return Math.max(1.15, radius * 2.15);
}

function columnCount(n: number) {
  let cols = Math.max(1, Math.ceil(Math.sqrt(n * 2)));
  if (cols > 1 && n % cols !== 0 && n % (cols - 1) === 0) {
    const next = cols - 1;
    if (n / next <= next) cols = next;
  }
  return Math.min(n, cols);
}

function slotLocals(n: number, gap: number) {
  const cols = columnCount(n);
  const locals: { right: number; forward: number }[] = [];
  let left = n;
  let row = 0;
  while (left > 0) {
    const count = Math.min(cols, left);
    left -= count;
    for (let c = 0; c < count; c++) locals.push({ right: (c - (count - 1) / 2) * gap, forward: -row * gap });
    row += 1;
  }
  const depth = (row - 1) * gap;
  for (const slot of locals) slot.forward += depth / 2;
  return { locals, depth, cols };
}

function sortFacing(units: Unit[], face: number) {
  const { rx, rz, fx, fz } = basis(face);
  return units.slice().sort((a, b) => {
    const af = a.x * fx + a.z * fz;
    const bf = b.x * fx + b.z * fz;
    if (Math.abs(af - bf) > 0.05) return bf - af;
    const ar = a.x * rx + a.z * rz;
    const br = b.x * rx + b.z * rz;
    if (Math.abs(ar - br) > 0.05) return ar - br;
    return a.id - b.id;
  });
}

function lineUp(units: Unit[], face: number) {
  const ranks = new Set(units.map((unit) => unit.rank));
  const ranked = units.every((unit) => unit.rank >= 0) && ranks.size === units.length;
  const ordered = ranked ? units.slice().sort((a, b) => a.rank - b.rank) : sortFacing(units, face);
  ordered.forEach((unit, index) => {
    unit.rank = index;
  });
  return ordered;
}

function putFormation(units: Unit[], face: number, cx: number, cz: number) {
  const mobile = units.filter((unit) => !unit.pinned);
  for (const unit of units) {
    if (!unit.pinned) continue;
    unit.yaw = face + unit.yawOffset;
    unit.aimX = Math.sin(face);
    unit.aimZ = Math.cos(face);
  }
  if (!mobile.length) return;
  if (mobile.length === 1) {
    mobile[0].x = clampMap(cx);
    mobile[0].z = clampMap(cz);
    mobile[0].yaw = face + mobile[0].yawOffset;
    mobile[0].aimX = Math.sin(face);
    mobile[0].aimZ = Math.cos(face);
    mobile[0].rank = 0;
    return;
  }
  const ordered = lineUp(mobile, face);
  const { locals } = slotLocals(ordered.length, teamGap(ordered));
  const { rx, rz, fx, fz } = basis(face);
  ordered.forEach((unit, index) => {
    const slot = locals[index];
    const right = slot.right + unit.slotOffR;
    const forward = slot.forward + unit.slotOffF;
    unit.x = clampMap(cx + right * rx + forward * fx);
    unit.z = clampMap(cz + right * rz + forward * fz);
    unit.yaw = face + unit.yawOffset;
    unit.aimX = Math.sin(face);
    unit.aimZ = Math.cos(face);
  });
}

function dressTeam(store: EditStore, team: number) {
  const members = store.units.filter((unit) => unit.alive && unit.team === team);
  if (!members.length) return;
  for (const unit of members) unit.rank = -1;
  const center = centroid(members);
  putFormation(members, faceAim(members), center.x, center.z);
}

function formationWidth(units: Unit[]) {
  const gap = teamGap(units);
  const front = Math.min(columnCount(units.length), units.length);
  return Math.max(gap, (front - 1) * gap + gap);
}

/** Seçili grubu tıklanan noktaya kaydır (göreli düzen korunur). */
function shiftGroupTo(units: Unit[], x: number, z: number, turn: boolean) {
  if (!units.length) return;
  const from = centroid(units);
  const dx = x - from.x;
  const dz = z - from.z;
  const face = Math.hypot(dx, dz) > 0.2 ? Math.atan2(dx, dz) : faceAim(units);
  for (const unit of units) {
    unit.x = clampMap(unit.x + dx);
    unit.z = clampMap(unit.z + dz);
    if (!turn) continue;
    unit.yaw = face + unit.yawOffset;
    unit.aimX = Math.sin(face);
    unit.aimZ = Math.cos(face);
  }
}

/** Üye taşı: seçilenleri koy ve sabitle (pinned). */
function placeMembersPinned(store: EditStore, picked: Unit[], x: number, z: number) {
  shiftGroupTo(picked, x, z, true);
  for (const unit of picked) unit.pinned = true;
  store.note = picked.length === 1 ? "Üye sabitlendi. Nizam sıfırla demeden toplu taşımada kıpırdamaz." : `${picked.length} üye sabitlendi. Nizam sıfırla demeden yerleri korunur.`;
  store.bump();
}

export function moveSelected(store: EditStore, x: number, z: number) {
  if (store.battle) {
    store.note = "Savaş sürüyor. Yerleştirmek için durdur.";
    store.bump();
    return;
  }
  const picked = store.units.filter((unit) => unit.alive && store.selected.has(unit.id));
  if (!picked.length) return;

  // Üye taşı: yalnız seçilenler gider ve sabitlenir
  if (store.placeMode === "member") {
    placeMembersPinned(store, picked, x, z);
    return;
  }

  // Takım taşı: seçim 1 kişi → o takımın sabitlenmemişleri; seçim 2+ → yalnız seçilenler
  const teamIds = [...new Set(picked.map((unit) => unit.team).filter((team) => team > 0))];
  const packs: { units: Unit[]; form: boolean }[] = [];
  for (const team of teamIds) {
    const mates = store.units.filter((unit) => unit.alive && unit.team === team);
    const sel = picked.filter((unit) => unit.team === team);
    if (sel.length === 1) {
      const mobile = mates.filter((unit) => !unit.pinned);
      if (mobile.length) packs.push({ units: mobile, form: true });
    } else {
      packs.push({ units: sel.filter((unit) => !unit.pinned), form: false });
    }
  }
  const loose = picked.filter((unit) => unit.team <= 0 && !unit.pinned);
  if (loose.length) packs.push({ units: loose, form: false });

  const moving = packs.flatMap((pack) => pack.units);
  if (!moving.length) {
    store.note = "Seçililer sabitli (pinned). Nizam sıfırla ile çöz.";
    store.bump();
    return;
  }

  const from = centroid(moving);
  const dx = x - from.x;
  const dz = z - from.z;
  const face = Math.hypot(dx, dz) > 0.2 ? Math.atan2(dx, dz) : faceAim(moving);
  const { rx, rz } = basis(face);
  const widths = packs.map((pack) => (pack.form ? formationWidth(pack.units) : Math.max(formationWidth(pack.units), looseSpan(pack.units, face))));
  const gutter = packs.length > 1 ? Math.max(...widths.map((width, index) => (packs[index].form ? teamGap(packs[index].units) : 1.6))) : 0;
  const total = widths.reduce((sum, width) => sum + width, 0) + gutter * Math.max(0, packs.length - 1);
  let cursor = -total / 2;
  packs.forEach((pack, index) => {
    if (!pack.units.length) return;
    const mid = cursor + widths[index] / 2;
    cursor += widths[index] + gutter;
    const gx = x + rx * mid;
    const gz = z + rz * mid;
    if (pack.form) putFormation(pack.units, face, gx, gz);
    else shiftLoose(pack.units, face, gx, gz, Math.hypot(dx, dz) > 0.2);
  });
  const formed = packs.filter((pack) => pack.form && pack.units.length);
  const skipped = picked.filter((unit) => unit.pinned).length;
  if (formed.length === 1 && packs.length === 1) store.note = `${teamLabel(formed[0].units[0].team)} taşındı (${formed[0].units.length})${skipped ? ` · ${skipped} sabitli kaldı` : ""}.`;
  else if (formed.length && packs.every((p) => p.form)) store.note = `${formed.length} takım taşındı.`;
  else store.note = `${moving.length} seçili konumlandı${skipped ? ` · ${skipped} sabitli dokunulmadı` : ""}.`;
  store.bump();
}

export function rotateSelected(store: EditStore, delta: number) {
  const picked = store.units.filter((unit) => unit.alive && store.selected.has(unit.id));
  if (!picked.length) {
    store.note = "Yön için önce seç.";
    store.bump();
    return;
  }
  for (const unit of picked) {
    unit.yawOffset += delta;
    unit.yaw += delta;
  }
  store.note = `Yön ${delta > 0 ? "sağa" : "sola"} döndü.`;
  store.bump();
}

export function nudgeSelected(store: EditStore, dRight: number, dForward: number) {
  const picked = store.units.filter((unit) => unit.alive && store.selected.has(unit.id));
  if (!picked.length) {
    store.note = "Konum için önce seç.";
    store.bump();
    return;
  }
  for (const unit of picked) {
    if (unit.team <= 0) {
      const face = Math.atan2(unit.aimX, unit.aimZ);
      const { rx, rz, fx, fz } = basis(face);
      unit.x = clampMap(unit.x + dRight * rx + dForward * fx);
      unit.z = clampMap(unit.z + dRight * rz + dForward * fz);
      continue;
    }
    unit.slotOffR += dRight;
    unit.slotOffF += dForward;
    const mates = store.units.filter((u) => u.alive && u.team === unit.team);
    const center = centroid(mates);
    putFormation(mates, faceAim(mates), center.x, center.z);
  }
  store.note = "Üye konumu güncellendi.";
  store.bump();
}

export function resetSlotOffsets(store: EditStore) {
  const picked = store.units.filter((unit) => unit.alive && store.selected.has(unit.id));
  if (!picked.length) return;
  const teams = new Set<number>();
  for (const unit of picked) {
    unit.slotOffR = 0;
    unit.slotOffF = 0;
    unit.pinned = false;
    if (unit.team > 0) teams.add(unit.team);
  }
  for (const team of teams) {
    const mates = store.units.filter((u) => u.alive && u.team === team);
    for (const unit of mates) {
      if (store.selected.has(unit.id)) continue;
      // Seçili değilse sabitli kalsın; seçililerin kilidi açıldı
    }
    const center = centroid(mates);
    putFormation(
      mates.filter((u) => store.selected.has(u.id) || !u.pinned),
      faceAim(mates),
      center.x,
      center.z
    );
  }
  store.note = "Seçili nizam/sabit sıfırlandı.";
  store.bump();
}

export function setGround(store: EditStore, ground: GroundId) {
  store.ground = ground;
  store.note = `Zemin: ${ground}`;
  store.bump();
}

export function setPlaceMode(store: EditStore, mode: PlaceMode) {
  store.placeMode = mode;
  store.note =
    mode === "member"
      ? "Üye taşı: seçtiklerin (1 veya grup) gider ve sabitlenir; nizam sıfırla ile çözülür."
      : "Takım taşı: 1 seçiliyse takım (sabitliler hariç); birden fazla seçiliyse yalnız onlar.";
  store.bump();
}

function looseSpan(units: Unit[], face: number) {
  const { rx, rz } = basis(face);
  let min = Infinity;
  let max = -Infinity;
  for (const unit of units) {
    const right = unit.x * rx + unit.z * rz;
    min = Math.min(min, right - unit.radius);
    max = Math.max(max, right + unit.radius);
  }
  return Math.max(1.2, max - min);
}

function shiftLoose(units: Unit[], face: number, cx: number, cz: number, turn: boolean) {
  const center = centroid(units);
  for (const unit of units) {
    unit.x = clampMap(cx + (unit.x - center.x));
    unit.z = clampMap(cz + (unit.z - center.z));
    if (!turn) continue;
    unit.yaw = face + unit.yawOffset;
    unit.aimX = Math.sin(face);
    unit.aimZ = Math.cos(face);
  }
}

export function selectNearby(store: EditStore, id: number, additive: boolean) {
  const seed = store.byId.get(id);
  if (!seed || !seed.alive) return;
  const label = characterById(seed.model)?.label ?? "asker";
  const chosen = new Set<number>();

  if (seed.team <= 0) {
    // Takımsız: aynı modelin tüm takımsızları (10 eklediysen 10'u)
    for (const unit of store.units) {
      if (!unit.alive || unit.model !== seed.model || unit.team > 0) continue;
      chosen.add(unit.id);
    }
  } else {
    // Takımlı: aynı model + aynı takım, yakın küme
    const same = store.units.filter((unit) => unit.alive && unit.model === seed.model && unit.team === seed.team);
    const reach = Math.max(2.6, seed.radius * 3.6);
    const reach2 = reach * reach;
    chosen.add(seed.id);
    const queue = [seed];
    while (queue.length) {
      const current = queue.pop();
      if (!current) break;
      for (const other of same) {
        if (chosen.has(other.id)) continue;
        const dx = other.x - current.x;
        const dz = other.z - current.z;
        if (dx * dx + dz * dz > reach2) continue;
        chosen.add(other.id);
        queue.push(other);
      }
    }
  }

  if (!additive) store.selected.clear();
  for (const pick of chosen) store.selected.add(pick);
  store.note =
    seed.team <= 0
      ? chosen.size > 1
        ? `${chosen.size} takımsız ${label} seçildi. Takım olsun.`
        : `1 ${label} seçili.`
      : chosen.size > 1
        ? `${chosen.size} yakın ${label} seçildi.`
        : `${store.selected.size} asker seçili. Yere tıklayınca oraya gider.`;
  store.bump();
}

export function assignTeam(store: EditStore, team: number) {
  const picked = [...store.selected];
  if (!picked.length) {
    store.note = "Önce kutuyla ya da tıklayarak asker seç.";
    store.bump();
    return;
  }
  let n = 0;
  const touched = new Set<number>();
  for (const id of picked) {
    const unit = store.byId.get(id);
    if (!unit || !unit.alive) continue;
    if (unit.team > 0) touched.add(unit.team);
    unit.team = team;
    unit.rank = -1;
    n += 1;
  }
  if (!n) {
    store.note = "Seçili asker yok.";
    store.bump();
    return;
  }
  touched.add(team);
  for (const id of touched) dressTeam(store, id);
  const mates = store.units.filter((unit) => unit.alive && unit.team === team).length;
  store.note = `${n} asker ${teamLabel(team)} takım oldu. ${mates} kişi nizamda.`;
  store.bump();
}

export function removeSelected(store: EditStore) {
  if (!store.selected.size) {
    store.note = "Silmek için asker seç.";
    store.bump();
    return;
  }
  const drop = new Set(store.selected);
  const touched = new Set<number>();
  for (const id of drop) {
    const unit = store.byId.get(id);
    if (unit && unit.team > 0) touched.add(unit.team);
  }
  store.units = store.units.filter((unit) => !drop.has(unit.id));
  for (const id of drop) store.byId.delete(id);
  store.selected.clear();
  for (const team of touched) dressTeam(store, team);
  store.nameStamp += 1;
  store.note = `${drop.size} asker silindi.`;
  store.bump();
}

export function assignNames(store: EditStore, pool: string[], manual: string) {
  const picked = store.units.filter((unit) => unit.alive && store.selected.has(unit.id));
  if (!picked.length) {
    store.note = "Ad vermek için asker seç.";
    store.bump();
    return;
  }
  const typed = manual.trim();
  if (typed) {
    for (const unit of picked) unit.name = typed;
    store.nameStamp += 1;
    store.note = `${picked.length} askere “${typed}” verildi.`;
    store.bump();
    return;
  }
  const source = pool.map((name) => name.trim()).filter(Boolean);
  const names = source.length ? source : FALLBACK_NAMES;
  const bag = [...names];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = bag[i];
    bag[i] = bag[j];
    bag[j] = swap;
  }
  picked.forEach((unit, index) => {
    unit.name = bag[index % bag.length];
  });
  store.nameStamp += 1;
  store.note = source.length ? `${picked.length} askere takipçi adı verildi.` : `${picked.length} askere yedek ad verildi. Takipçi listesi boş.`;
  store.bump();
}

/** Drops the names of the selected soldiers; select one soldier or a whole team first. */
export function clearNames(store: EditStore) {
  const picked = store.units.filter((unit) => unit.alive && store.selected.has(unit.id) && unit.name);
  if (!picked.length) {
    store.note = "Adı geri almak için adlı asker seç.";
    store.bump();
    return;
  }
  for (const unit of picked) unit.name = "";
  store.nameStamp += 1;
  store.note = picked.length === 1 ? "1 askerin adı geri alındı." : `${picked.length} askerin adı geri alındı.`;
  store.bump();
}

export function selectTeam(store: EditStore, team: number) {
  const mates = store.units.filter((unit) => unit.alive && unit.team === team);
  if (!mates.length) {
    store.note = `${teamLabel(team)} takımında asker yok.`;
    store.bump();
    return;
  }
  store.selected.clear();
  for (const unit of mates) store.selected.add(unit.id);
  store.note = `${teamLabel(team)} takımının ${mates.length} askeri seçildi.`;
  store.bump();
}

export function startBattle(store: EditStore) {
  if (store.battle) {
    store.battle = false;
    store.note = "Savaş durdu.";
    store.bump();
    return;
  }
  const teams = new Set(store.units.filter((unit) => unit.alive && unit.team > 0).map((unit) => unit.team));
  if (teams.size < 2) {
    store.note = "VS için en az iki takım gerekli. Kutuya al, Takım olsun.";
    store.bump();
    return;
  }
  store.battle = true;
  store.note = "Savaş başladı — konuşlandıkları yerden ateş.";
  store.bump();
}

function removeGone(store: EditStore) {
  store.units = store.units.filter((unit) => {
    if (!unit.gone) return true;
    store.byId.delete(unit.id);
    store.selected.delete(unit.id);
    return false;
  });
  store.nameStamp += 1;
}

const FALL_SECONDS = 1.8;

/** A struck soldier pitches forward and sinks before the slot closes. Runs with or without a battle. */
function advanceFalls(store: EditStore, step: number) {
  let done = false;
  for (const unit of store.units) {
    if (unit.alive || unit.gone) continue;
    unit.fall = Math.min(1, unit.fall + step / FALL_SECONDS);
    const k = Math.min(1, unit.fall * 1.6);
    unit.pitch = 1.5 * k * k * (3 - 2 * k);
    unit.y = -unit.height * 0.12 * Math.max(0, unit.fall - 0.55) * 2.2;
    unit.swing = 0;
    if (unit.fall >= 1) {
      unit.gone = true;
      done = true;
    }
  }
  if (done) removeGone(store);
  return done;
}

export function stepUnits(store: EditStore, dt: number) {
  const step = Math.min(0.05, Math.max(0, dt));
  let changed = advanceFalls(store, step);
  if (!store.battle) {
    for (const unit of store.units) if (unit.alive) unit.swing = Math.max(0, unit.swing - step * 3);
    return changed;
  }
  const groups = new Map<number, Unit[]>();
  for (const unit of store.units) {
    if (!unit.alive) continue;
    if (unit.team <= 0) {
      unit.swing = Math.max(0, unit.swing - step * 2);
      continue;
    }
    const list = groups.get(unit.team);
    if (list) list.push(unit);
    else groups.set(unit.team, [unit]);
  }
  const centers = new Map<number, { x: number; z: number }>();
  for (const [team, members] of groups) centers.set(team, centroid(members));
  for (const [team, members] of groups) {
    let foeTeam = 0;
    let foeDist = Infinity;
    const home = centers.get(team)!;
    for (const [other, center] of centers) {
      if (other === team) continue;
      const dist = Math.hypot(center.x - home.x, center.z - home.z);
      if (dist < foeDist) {
        foeDist = dist;
        foeTeam = other;
      }
    }
    const foes = groups.get(foeTeam);
    if (!foes) continue;
    for (const unit of members) {
      if (!unit.alive) continue;
      if (unit.boltAge > 0) unit.boltAge = Math.max(0, unit.boltAge - step);
      const def = characterById(unit.model);
      const gun = Boolean(def?.gun);
      const car = def?.kind === "car";

      // Araç: yerinde kalır, saldıramaz
      if (car) {
        unit.swing = 0;
        unit.cooldown = 1;
        continue;
      }

      let target: Unit | null = null;
      let best = Infinity;
      for (const enemy of foes) {
        if (!enemy.alive) continue;
        const d2 = (enemy.x - unit.x) ** 2 + (enemy.z - unit.z) ** 2;
        if (d2 < best) {
          best = d2;
          target = enemy;
        }
      }
      if (target) {
        const tdx = target.x - unit.x;
        const tdz = target.z - unit.z;
        const look = Math.atan2(tdx, tdz);
        unit.aimX = Math.sin(look);
        unit.aimZ = Math.cos(look);
        unit.yaw = look + unit.yawOffset;
      }

      // Üye taşı (pinned) veya silahlı: konuşlandırıldığı yerden ateş; nizam kaydırmaz
      // Yalnızca sabitlenmemiş yakın dövüşçü hedefe yürür
      if (!unit.pinned && !gun && target && unit.speed > 0.05) {
        const meleeReach = unit.radius + target.radius + 0.45;
        const dist = Math.hypot(target.x - unit.x, target.z - unit.z);
        if (dist > meleeReach) {
          const move = Math.min(dist - meleeReach + 0.02, unit.speed * step);
          unit.x = clampMap(unit.x + unit.aimX * move);
          unit.z = clampMap(unit.z + unit.aimZ * move);
        }
      }

      const meleeReach = target ? unit.radius + target.radius + 0.45 : 0;
      const gunReach = 18;
      const distTo = target ? Math.hypot(target.x - unit.x, target.z - unit.z) : 1e9;
      const engaged = target ? (gun ? distTo <= gunReach : distTo <= meleeReach) : false;
      if (target && engaged && unit.damage > 0) {
        unit.cooldown -= step;
        unit.swing = Math.min(1, unit.swing + step * (gun ? 5 : 7));
        if (unit.cooldown <= 0) {
          target.hp -= unit.damage;
          unit.cooldown = gun ? 0.55 : 0.68;
          unit.swing = 1;
          if (gun) {
            unit.boltAge = 0.22;
            unit.boltX = unit.x;
            unit.boltZ = unit.z;
            unit.boltTX = target.x;
            unit.boltTZ = target.z;
          }
          if (target.hp <= 0) {
            target.hp = 0;
            target.alive = false;
            target.fall = 0;
            store.selected.delete(target.id);
            changed = true;
          }
        }
      } else unit.swing = Math.max(0, unit.swing - step * 3);
    }
  }
  for (let i = 0; i < store.units.length; i++) {
    const a = store.units[i];
    if (!a.alive || a.pinned) continue;
    for (let j = i + 1; j < store.units.length; j++) {
      const b = store.units[j];
      if (!b.alive || b.pinned || (a.team > 0 && a.team === b.team)) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const min = (a.radius + b.radius) * 0.82;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1e-4 || d2 >= min * min) continue;
      const dist = Math.sqrt(d2);
      const push = (min - dist) * 0.2;
      const nx = dx / dist;
      const nz = dz / dist;
      a.x = clampMap(a.x - nx * push);
      a.z = clampMap(a.z - nz * push);
      b.x = clampMap(b.x + nx * push);
      b.z = clampMap(b.z + nz * push);
    }
  }
  const left = new Set(store.units.filter((unit) => unit.alive && unit.team > 0).map((unit) => unit.team));
  if (left.size <= 1) {
    store.battle = false;
    const winner = [...left][0];
    store.note = winner ? `${teamLabel(winner)} kazandı.` : "İki taraf da düştü.";
    changed = true;
  }
  return changed;
}
