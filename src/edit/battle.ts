import { MAX_PER_MODEL, MAX_UNITS, TEAMS, type CharacterDef } from "./catalog";

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
  gone?: boolean;
};

export type EditStore = {
  units: Unit[];
  byId: Map<number, Unit>;
  selected: Set<number>;
  battle: boolean;
  note: string;
  viewX: number;
  viewZ: number;
  nextId: number;
  nameStamp: number;
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
    nextId: 1,
    nameStamp: 0,
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
  return {
    radius,
    height: def.height,
    speed: giant ? 4.4 : 3.3,
    damage: giant ? 26 : 8,
    maxHp: giant ? 480 : 86,
  };
}

export function spawnUnits(store: EditStore, def: CharacterDef, radius: number, count: number) {
  if (store.battle) {
    store.note = "Savaş sürüyor. Durdurunca yeni karakter eklenir.";
    store.bump();
    return 0;
  }
  const have = store.units.filter((unit) => unit.model === def.id).length;
  const room = Math.min(MAX_PER_MODEL - have, MAX_UNITS - store.units.length, 40);
  const n = Math.max(0, Math.min(Math.floor(count) || 1, room));
  if (!n) {
    store.note = "Bu modelden daha fazla sığmıyor.";
    store.bump();
    return 0;
  }
  const fit = stats(def, radius);
  const cols = Math.ceil(Math.sqrt(n));
  const gap = Math.max(1.15, radius * 2.2);
  let originX = store.viewX;
  const originZ = store.viewZ + 6;
  if (store.units.length) originX = store.units.reduce((max, unit) => Math.max(max, unit.x), store.viewX) + gap + 1.4;
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const unit: Unit = {
      id: store.nextId++,
      model: def.id,
      x: originX + (col - (cols - 1) / 2) * gap,
      y: 0,
      z: originZ + row * gap,
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
    };
    store.units.push(unit);
    store.byId.set(unit.id, unit);
  }
  store.nameStamp += 1;
  store.note = n < count ? `${n} ${def.label} eklendi. Sınır doldu.` : `${n} ${def.label} eklendi.`;
  store.bump();
  return n;
}

export function moveSelected(store: EditStore, x: number, z: number) {
  if (store.battle) {
    store.note = "Savaş sürüyor. Yerleştirmek için durdur.";
    store.bump();
    return;
  }
  const picked = store.units.filter((unit) => unit.alive && store.selected.has(unit.id));
  if (!picked.length) return;
  let cx = 0;
  let cz = 0;
  for (const unit of picked) {
    cx += unit.x;
    cz += unit.z;
  }
  cx /= picked.length;
  cz /= picked.length;
  const dx = x - cx;
  const dz = z - cz;
  const face = Math.hypot(dx, dz) > 0.2 ? Math.atan2(dx, dz) : 0;
  for (const unit of picked) {
    unit.x = Math.max(-320, Math.min(320, unit.x + dx));
    unit.z = Math.max(-320, Math.min(320, unit.z + dz));
    if (Math.hypot(dx, dz) > 0.2) {
      unit.yaw = face + unit.yawOffset;
      unit.aimX = dx;
      unit.aimZ = dz;
    }
  }
  store.note = `${picked.length} asker konumlandı.`;
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
  for (const id of picked) {
    const unit = store.byId.get(id);
    if (!unit || !unit.alive) continue;
    unit.team = team;
    n += 1;
  }
  store.note = n ? `${n} asker ${teamLabel(team)} takım oldu.` : "Seçili asker yok.";
  store.bump();
}

export function removeSelected(store: EditStore) {
  if (!store.selected.size) {
    store.note = "Silmek için asker seç.";
    store.bump();
    return;
  }
  const drop = new Set(store.selected);
  store.units = store.units.filter((unit) => !drop.has(unit.id));
  for (const id of drop) store.byId.delete(id);
  store.selected.clear();
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
  store.note = "Savaş başladı.";
  store.bump();
}

export function stepUnits(store: EditStore, dt: number) {
  const step = Math.min(0.05, Math.max(0, dt));
  let changed = false;
  if (!store.battle) {
    for (const unit of store.units) unit.swing = Math.max(0, unit.swing - step * 3);
    return false;
  }
  const fighting = store.units.filter((unit) => unit.alive && unit.team > 0);
  for (const unit of store.units) {
    if (!unit.alive) {
      unit.fall += step;
      unit.y = -unit.fall * unit.fall * 8;
      unit.pitch = Math.min(1.35, unit.fall * 1.8);
      if (unit.fall > 1.05) {
        unit.gone = true;
        changed = true;
      }
      continue;
    }
    if (unit.team <= 0) {
      unit.swing = Math.max(0, unit.swing - step * 2);
      continue;
    }
    let foe: Unit | null = null;
    let best = Infinity;
    for (const other of fighting) {
      if (!other.alive || other.team === unit.team) continue;
      const dx = other.x - unit.x;
      const dz = other.z - unit.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < best) {
        best = d2;
        foe = other;
      }
    }
    if (!foe) continue;
    const dist = Math.sqrt(best);
    const dx = foe.x - unit.x;
    const dz = foe.z - unit.z;
    unit.aimX = dx;
    unit.aimZ = dz;
    unit.yaw = Math.atan2(dx, dz) + unit.yawOffset;
    const reach = unit.radius + foe.radius + 0.45;
    if (dist > reach) {
      const move = Math.min(dist - reach, unit.speed * step);
      unit.x += (dx / dist) * move;
      unit.z += (dz / dist) * move;
      unit.swing = Math.max(0, unit.swing - step * 3);
    } else {
      unit.cooldown -= step;
      unit.swing = Math.min(1, unit.swing + step * 7);
      if (unit.cooldown <= 0) {
        foe.hp -= unit.damage;
        unit.cooldown = 0.68;
        unit.swing = 1;
        if (foe.hp <= 0) {
          foe.hp = 0;
          foe.alive = false;
          foe.fall = 0;
          changed = true;
        }
      }
    }
  }
  for (let i = 0; i < store.units.length; i++) {
    const a = store.units[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < store.units.length; j++) {
      const b = store.units[j];
      if (!b.alive) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const min = (a.radius + b.radius) * 0.82;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1e-4 || d2 >= min * min) continue;
      const dist = Math.sqrt(d2);
      const push = (min - dist) * 0.35;
      const nx = dx / dist;
      const nz = dz / dist;
      a.x -= nx * push;
      a.z -= nz * push;
      b.x += nx * push;
      b.z += nz * push;
    }
  }
  if (store.units.some((unit) => unit.gone)) {
    store.units = store.units.filter((unit) => {
      if (!unit.gone) return true;
      store.byId.delete(unit.id);
      store.selected.delete(unit.id);
      return false;
    });
    store.nameStamp += 1;
    changed = true;
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
