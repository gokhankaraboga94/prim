import { MAX_PER_MODEL, MAX_UNITS, TEAMS, characterById, type CharacterDef } from "./catalog";

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
      rank: -1,
    };
    store.units.push(unit);
    store.byId.set(unit.id, unit);
  }
  store.nameStamp += 1;
  store.note = n < count ? `${n} ${def.label} eklendi. Sınır doldu.` : `${n} ${def.label} eklendi.`;
  store.bump();
  return n;
}

const MAP_LIMIT = 320;

function clampMap(value: number) {
  return Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, value));
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
  if (units.length === 1) {
    units[0].x = clampMap(cx);
    units[0].z = clampMap(cz);
    units[0].yaw = face + units[0].yawOffset;
    units[0].aimX = Math.sin(face);
    units[0].aimZ = Math.cos(face);
    units[0].rank = 0;
    return;
  }
  const ordered = lineUp(units, face);
  const { locals } = slotLocals(ordered.length, teamGap(ordered));
  const { rx, rz, fx, fz } = basis(face);
  ordered.forEach((unit, index) => {
    const slot = locals[index];
    unit.x = clampMap(cx + slot.right * rx + slot.forward * fx);
    unit.z = clampMap(cz + slot.right * rz + slot.forward * fz);
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

export function moveSelected(store: EditStore, x: number, z: number) {
  if (store.battle) {
    store.note = "Savaş sürüyor. Yerleştirmek için durdur.";
    store.bump();
    return;
  }
  const picked = store.units.filter((unit) => unit.alive && store.selected.has(unit.id));
  if (!picked.length) return;
  const teamIds = [...new Set(picked.map((unit) => unit.team).filter((team) => team > 0))];
  const packs: { units: Unit[]; form: boolean }[] = teamIds.map((team) => ({
    units: store.units.filter((unit) => unit.alive && unit.team === team),
    form: true,
  }));
  const loose = picked.filter((unit) => unit.team <= 0);
  if (loose.length) packs.push({ units: loose, form: false });
  const involved = packs.flatMap((pack) => pack.units);
  const from = centroid(involved);
  const dx = x - from.x;
  const dz = z - from.z;
  const face = Math.hypot(dx, dz) > 0.2 ? Math.atan2(dx, dz) : faceAim(involved);
  const { rx, rz } = basis(face);
  const widths = packs.map((pack) => (pack.form ? formationWidth(pack.units) : Math.max(formationWidth(pack.units), looseSpan(pack.units, face))));
  const gutter = packs.length > 1 ? Math.max(...widths.map((width, index) => (packs[index].form ? teamGap(packs[index].units) : 1.6))) : 0;
  const total = widths.reduce((sum, width) => sum + width, 0) + gutter * Math.max(0, packs.length - 1);
  let cursor = -total / 2;
  packs.forEach((pack, index) => {
    const mid = cursor + widths[index] / 2;
    cursor += widths[index] + gutter;
    const gx = x + rx * mid;
    const gz = z + rz * mid;
    if (pack.form) putFormation(pack.units, face, gx, gz);
    else shiftLoose(pack.units, face, gx, gz, Math.hypot(dx, dz) > 0.2);
  });
  const formed = packs.filter((pack) => pack.form);
  if (formed.length === 1 && packs.length === 1) store.note = `${teamLabel(formed[0].units[0].team)} takımı (${formed[0].units.length}) nizaya girdi.`;
  else if (formed.length && !loose.length) store.note = `${formed.length} takım nizaya girdi.`;
  else if (!formed.length) store.note = `${loose.length} asker konumlandı.`;
  else store.note = "Takımlar nizaya girdi.";
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
  const same = store.units.filter((unit) => unit.alive && unit.model === seed.model);
  const reach = Math.max(2.6, seed.radius * 3.6);
  const reach2 = reach * reach;
  const chosen = new Set<number>([seed.id]);
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
  if (!additive) store.selected.clear();
  for (const pick of chosen) store.selected.add(pick);
  const label = characterById(seed.model)?.label ?? "asker";
  store.note = chosen.size > 1 ? `${chosen.size} yakın ${label} seçildi.` : `${store.selected.size} asker seçili. Yere tıklayınca oraya gider.`;
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

function removeGone(store: EditStore) {
  store.units = store.units.filter((unit) => {
    if (!unit.gone) return true;
    store.byId.delete(unit.id);
    store.selected.delete(unit.id);
    return false;
  });
  store.nameStamp += 1;
}

export function stepUnits(store: EditStore, dt: number) {
  const step = Math.min(0.05, Math.max(0, dt));
  let changed = false;
  if (!store.battle) {
    for (const unit of store.units) unit.swing = Math.max(0, unit.swing - step * 3);
    return false;
  }
  for (const unit of store.units) {
    if (unit.alive) continue;
    unit.gone = true;
    changed = true;
  }
  if (changed) removeGone(store);
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
    const foeCenter = centers.get(foeTeam);
    if (!foes || !foeCenter) continue;
    const face = Math.atan2(foeCenter.x - home.x, foeCenter.z - home.z);
    const ordered = lineUp(members, face);
    const gap = teamGap(ordered);
    const { locals } = slotLocals(ordered.length, gap);
    const { rx, rz, fx, fz } = basis(face);
    let short = Infinity;
    for (const unit of ordered) {
      for (const enemy of foes) {
        if (!enemy.alive) continue;
        const dist = Math.hypot(enemy.x - unit.x, enemy.z - unit.z);
        const reach = unit.radius + enemy.radius + 0.45;
        short = Math.min(short, dist - reach);
      }
    }
    const pace = ordered.reduce((min, unit) => Math.min(min, unit.speed), ordered[0].speed);
    const advance = short > 0 ? Math.min(pace * step, short + 0.04) : 0;
    const cx = home.x + fx * advance;
    const cz = home.z + fz * advance;
    ordered.forEach((unit, index) => {
      if (!unit.alive) return;
      const slot = locals[index];
      const sx = cx + slot.right * rx + slot.forward * fx;
      const sz = cz + slot.right * rz + slot.forward * fz;
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
      unit.aimX = Math.sin(face);
      unit.aimZ = Math.cos(face);
      unit.yaw = face + unit.yawOffset;
      const dx = sx - unit.x;
      const dz = sz - unit.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.03) {
        const move = Math.min(dist, unit.speed * step);
        unit.x = clampMap(unit.x + (dx / dist) * move);
        unit.z = clampMap(unit.z + (dz / dist) * move);
      }
      const reach = target ? unit.radius + target.radius + 0.45 : 0;
      const engaged = target ? Math.hypot(target.x - unit.x, target.z - unit.z) <= reach : false;
      if (target && engaged) {
        unit.cooldown -= step;
        unit.swing = Math.min(1, unit.swing + step * 7);
        if (unit.cooldown <= 0) {
          target.hp -= unit.damage;
          unit.cooldown = 0.68;
          unit.swing = 1;
          if (target.hp <= 0) {
            target.hp = 0;
            target.alive = false;
            target.gone = true;
            changed = true;
          }
        }
      } else unit.swing = Math.max(0, unit.swing - step * 3);
    });
  }
  for (let i = 0; i < store.units.length; i++) {
    const a = store.units[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < store.units.length; j++) {
      const b = store.units[j];
      if (!b.alive || (a.team > 0 && a.team === b.team)) continue;
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
  if (store.units.some((unit) => unit.gone)) {
    removeGone(store);
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
