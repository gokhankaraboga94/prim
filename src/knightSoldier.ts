import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const HELM = new Set(["Knight_1", "Knight_2", "Knight_3", "Knight_4", "Sword_2", "Sword_3", "Sword_4"]);
const HEIGHT = 1.72;

function baked(mesh: THREE.Mesh) {
  const src = mesh.geometry.clone();
  src.applyMatrix4(mesh.matrixWorld);
  const flat = src.index ? src.toNonIndexed() : src;
  const next = new THREE.BufferGeometry();
  next.setAttribute("position", flat.getAttribute("position").clone());
  const norm = flat.getAttribute("normal");
  if (norm) next.setAttribute("normal", norm.clone());
  else next.computeVertexNormals();
  src.dispose();
  if (flat !== src) flat.dispose();
  return next;
}

export function buildKnightSoldier(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const helm: THREE.BufferGeometry[] = [];
  const body: THREE.BufferGeometry[] = [];
  const fit = new THREE.Box3();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = baked(mesh);
    if (mesh.name.startsWith("Knight_")) {
      geo.computeBoundingBox();
      if (geo.boundingBox) fit.union(geo.boundingBox);
    }
    (HELM.has(mesh.name) ? helm : body).push(geo);
  });
  const height = Math.max(0.001, fit.max.y - fit.min.y);
  const s = HEIGHT / height;
  const cx = (fit.min.x + fit.max.x) / 2;
  const cz = (fit.min.z + fit.max.z) / 2;
  const placed = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-cx, -fit.min.y, -cz));
  for (const geo of [...helm, ...body]) geo.applyMatrix4(placed);
  const pack = (parts: THREE.BufferGeometry[]) => {
    const merged = parts.length ? mergeGeometries(parts, false) : null;
    parts.forEach((geo) => geo.dispose());
    return merged ?? new THREE.BoxGeometry(0.2, 0.2, 0.2);
  };
  return { body: pack(body), helm: pack(helm) };
}

function clusterMesh(geo: THREE.BufferGeometry, cell: number) {
  const pos = geo.getAttribute("position");
  const uv = geo.getAttribute("uv");
  const index = geo.getIndex();
  const cells = new Map<string, number>();
  const remap = new Uint32Array(pos.count);
  const acc: { x: number; y: number; z: number; u: number; v: number; n: number; d: number }[] = [];
  const used = index ? new Uint8Array(pos.count) : null;
  if (index && used) for (let i = 0; i < index.count; i++) used[index.getX(i)] = 1;
  for (let i = 0; i < pos.count; i++) {
    if (used && !used[i]) continue;
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${Math.round(x / cell)},${Math.round(y / cell)},${Math.round(z / cell)}`;
    let id = cells.get(key);
    if (id == null) {
      id = acc.length;
      cells.set(key, id);
      acc.push({ x: 0, y: 0, z: 0, u: uv ? uv.getX(i) : 0, v: uv ? uv.getY(i) : 0, n: 0, d: Infinity });
    }
    const slot = acc[id];
    slot.x += x;
    slot.y += y;
    slot.z += z;
    slot.n += 1;
    remap[i] = id;
  }
  for (const slot of acc) {
    slot.x /= slot.n;
    slot.y /= slot.n;
    slot.z /= slot.n;
  }
  for (let i = 0; i < pos.count; i++) {
    if (used && !used[i]) continue;
    const slot = acc[remap[i]];
    const dx = pos.getX(i) - slot.x;
    const dy = pos.getY(i) - slot.y;
    const dz = pos.getZ(i) - slot.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d >= slot.d) continue;
    slot.d = d;
    if (!uv) continue;
    slot.u = uv.getX(i);
    slot.v = uv.getY(i);
  }
  const positions = new Float32Array(acc.length * 3);
  const uvs = new Float32Array(acc.length * 2);
  for (let i = 0; i < acc.length; i++) {
    positions[i * 3] = acc[i].x;
    positions[i * 3 + 1] = acc[i].y;
    positions[i * 3 + 2] = acc[i].z;
    uvs[i * 2] = acc[i].u;
    uvs[i * 2 + 1] = acc[i].v;
  }
  const triCount = index ? index.count : pos.count;
  const at = (i: number) => (index ? index.getX(i) : i);
  const tris: number[] = [];
  for (let i = 0; i < triCount; i += 3) {
    const a = remap[at(i)];
    const b = remap[at(i + 1)];
    const c = remap[at(i + 2)];
    if (a === b || b === c || a === c) continue;
    tris.push(a, b, c);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  out.setIndex(tris);
  out.computeVertexNormals();
  return out;
}

function dropFlatBase(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position");
  const index = geo.getIndex();
  if (!pos) return;
  let minY = Infinity;
  for (let i = 0; i < pos.count; i += 16) minY = Math.min(minY, pos.getY(i));
  const floor = minY + 0.03;
  const triCount = index ? index.count : pos.count;
  const at = (i: number) => (index ? index.getX(i) : i);
  const keep: number[] = [];
  for (let i = 0; i < triCount; i += 3) {
    const a = at(i);
    const b = at(i + 1);
    const c = at(i + 2);
    if (pos.getY(a) < floor && pos.getY(b) < floor && pos.getY(c) < floor) continue;
    keep.push(a, b, c);
  }
  geo.setIndex(keep);
}

function tintCape(geo: THREE.BufferGeometry, map: THREE.Texture | null) {
  const image = map?.image as HTMLImageElement | undefined;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  if (!map || !image || !width || !height || typeof document === "undefined") return map;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return map;
  ctx.drawImage(image, 0, 0);
  const frame = ctx.getImageData(0, 0, width, height);
  const data = frame.data;
  const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = (r: number, g: number, b: number) => {
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    return mx === 0 ? 0 : (mx - mn) / mx;
  };
  const step = 4;
  const sw = Math.floor(width / step);
  const sh = Math.floor(height / step);
  const cloth = new Uint8Array(sw * sh);
  const seeds = new Uint16Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const p = ((y * step) * width + x * step) * 4;
      if (lum(data[p], data[p + 1], data[p + 2]) > 128 && sat(data[p], data[p + 1], data[p + 2]) < 0.2) cloth[y * sw + x] = 1;
    }
  }
  const pos = geo.getAttribute("position");
  const uv = geo.getAttribute("uv");
  const zs: number[] = [];
  for (let i = 0; i < pos.count; i += 8) {
    const y = pos.getY(i);
    if (y > 0.7 && y < 0.9) zs.push(pos.getZ(i));
  }
  zs.sort((a, b) => a - b);
  const midZ = zs.length ? zs[zs.length >> 1] : 0.1;
  if (uv) {
    for (let i = 0; i < pos.count; i += 8) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (z > midZ - 0.16 || y < 0.04 || y > 0.7) continue;
      const x = Math.max(0, Math.min(width - 1, Math.round(uv.getX(i) * (width - 1))));
      const py = Math.max(0, Math.min(height - 1, Math.round((1 - uv.getY(i)) * (height - 1))));
      const p = (py * width + x) * 4;
      if (lum(data[p], data[p + 1], data[p + 2]) <= 128 || sat(data[p], data[p + 1], data[p + 2]) >= 0.2) continue;
      const cell = Math.floor(py / step) * sw + Math.floor(x / step);
      if (cell >= 0 && cell < seeds.length) seeds[cell] += 1;
    }
  }
  let cur = cloth;
  for (let pass = 0; pass < 2; pass++) {
    const next = new Uint8Array(sw * sh);
    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const i = y * sw + x;
        if (cur[i] && cur[i - 1] && cur[i + 1] && cur[i - sw] && cur[i + sw]) next[i] = 1;
      }
    }
    cur = next;
  }
  const seen = new Uint8Array(sw * sh);
  let best: number[] = [];
  let bestScore = -1;
  const queue: number[] = [];
  for (let i = 0; i < cur.length; i++) {
    if (!cur[i] || seen[i]) continue;
    queue.length = 0;
    queue.push(i);
    seen[i] = 1;
    const cells: number[] = [];
    let score = 0;
    for (let q = 0; q < queue.length; q++) {
      const cell = queue[q];
      cells.push(cell);
      score += seeds[cell];
      const x = cell % sw;
      const y = (cell - x) / sw;
      const near = [x > 0 ? cell - 1 : -1, x + 1 < sw ? cell + 1 : -1, y > 0 ? cell - sw : -1, y + 1 < sh ? cell + sw : -1];
      for (const n of near) {
        if (n < 0 || seen[n] || !cur[n]) continue;
        seen[n] = 1;
        queue.push(n);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = cells;
    }
  }
  const mask = new Uint8Array(sw * sh);
  const grow: number[] = [];
  for (const cell of best) {
    mask[cell] = 1;
    grow.push(cell, 0);
  }
  for (let q = 0; q < grow.length; q += 2) {
    const cell = grow[q];
    const depth = grow[q + 1];
    if (depth >= 5) continue;
    const x = cell % sw;
    const y = (cell - x) / sw;
    const near = [x > 0 ? cell - 1 : -1, x + 1 < sw ? cell + 1 : -1, y > 0 ? cell - sw : -1, y + 1 < sh ? cell + sw : -1];
    for (const n of near) {
      if (n < 0 || mask[n] || !cloth[n]) continue;
      mask[n] = 1;
      grow.push(n, depth + 1);
    }
  }
  for (let y = 0; y < height; y++) {
    const sy = Math.min(sh - 1, Math.floor(y / step));
    for (let x = 0; x < width; x++) {
      if (!mask[sy * sw + Math.min(sw - 1, Math.floor(x / step))]) continue;
      const p = (y * width + x) * 4;
      const tone = lum(data[p], data[p + 1], data[p + 2]);
      if (tone < 70) continue;
      data[p] = Math.min(255, tone * 0.2);
      data[p + 1] = Math.min(255, tone * 0.45);
      data[p + 2] = Math.min(255, tone * 1.08);
    }
  }
  ctx.putImageData(frame, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.colorSpace = map.colorSpace;
  tex.needsUpdate = true;
  map.dispose();
  return tex;
}

export function buildArmoredSoldier(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  let source: THREE.Mesh | null = null;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && !source) source = mesh;
  });
  if (!source) return null;
  const bakedGeo = (source as THREE.Mesh).geometry.clone();
  bakedGeo.applyMatrix4((source as THREE.Mesh).matrixWorld);
  dropFlatBase(bakedGeo);
  bakedGeo.computeBoundingBox();
  const box = bakedGeo.boundingBox;
  if (!box) {
    bakedGeo.dispose();
    return null;
  }
  const height = Math.max(0.001, box.max.y - box.min.y);
  const raw = (source as THREE.Mesh).material;
  const srcMat = (Array.isArray(raw) ? raw[0] : raw) as THREE.MeshStandardMaterial;
  const map = tintCape(bakedGeo, srcMat.map ?? null);
  const simplified = clusterMesh(bakedGeo, height * 0.09);
  bakedGeo.dispose();
  simplified.computeBoundingBox();
  const fit = simplified.boundingBox;
  if (!fit) {
    simplified.dispose();
    return null;
  }
  const span = Math.max(0.001, fit.max.y - fit.min.y);
  const placed = new THREE.Matrix4()
    .makeScale(HEIGHT / span, HEIGHT / span, HEIGHT / span)
    .multiply(new THREE.Matrix4().makeTranslation(-(fit.min.x + fit.max.x) / 2, -fit.min.y, -(fit.min.z + fit.max.z) / 2));
  simplified.applyMatrix4(placed);
  const material = new THREE.MeshLambertMaterial({ map, color: "#ffffff" });
  return { geometry: simplified, material };
}

export function simplifySkinned(geo: THREE.BufferGeometry, cell: number) {
  const pos = geo.getAttribute("position");
  const uv = geo.getAttribute("uv");
  const skinIndex = geo.getAttribute("skinIndex");
  const skinWeight = geo.getAttribute("skinWeight");
  const index = geo.getIndex();
  const cells = new Map<string, number>();
  const remap = new Uint32Array(pos.count);
  const rep: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const gx = Math.round(x / cell);
    const gy = Math.round(y / cell);
    const gz = Math.round(z / cell);
    const key = `${gx},${gy},${gz}`;
    let id = cells.get(key);
    if (id == null) {
      id = rep.length;
      cells.set(key, id);
      rep.push(i);
      remap[i] = id;
      continue;
    }
    remap[i] = id;
    const keep = rep[id];
    const cx = gx * cell;
    const cy = gy * cell;
    const cz = gz * cell;
    const ox = x - cx;
    const oy = y - cy;
    const oz = z - cz;
    const dx = pos.getX(keep) - cx;
    const dy = pos.getY(keep) - cy;
    const dz = pos.getZ(keep) - cz;
    if (ox * ox + oy * oy + oz * oz < dx * dx + dy * dy + dz * dz) rep[id] = i;
  }
  const positions = new Float32Array(rep.length * 3);
  const uvs = new Float32Array(rep.length * 2);
  const joints = new Float32Array(rep.length * 4);
  const weights = new Float32Array(rep.length * 4);
  for (let i = 0; i < rep.length; i++) {
    const v = rep[i];
    positions[i * 3] = pos.getX(v);
    positions[i * 3 + 1] = pos.getY(v);
    positions[i * 3 + 2] = pos.getZ(v);
    if (uv) {
      uvs[i * 2] = uv.getX(v);
      uvs[i * 2 + 1] = uv.getY(v);
    }
    if (skinIndex && skinWeight) {
      joints[i * 4] = skinIndex.getX(v);
      joints[i * 4 + 1] = skinIndex.getY(v);
      joints[i * 4 + 2] = skinIndex.getZ(v);
      joints[i * 4 + 3] = skinIndex.getW(v);
      weights[i * 4] = skinWeight.getX(v);
      weights[i * 4 + 1] = skinWeight.getY(v);
      weights[i * 4 + 2] = skinWeight.getZ(v);
      weights[i * 4 + 3] = skinWeight.getW(v);
    }
  }
  const triCount = index ? index.count : pos.count;
  const at = (i: number) => (index ? index.getX(i) : i);
  const tris: number[] = [];
  for (let i = 0; i < triCount; i += 3) {
    const a = remap[at(i)];
    const b = remap[at(i + 1)];
    const c = remap[at(i + 2)];
    if (a === b || b === c || a === c) continue;
    tris.push(a, b, c);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  if (skinIndex && skinWeight) {
    out.setAttribute("skinIndex", new THREE.BufferAttribute(joints, 4));
    out.setAttribute("skinWeight", new THREE.BufferAttribute(weights, 4));
  }
  out.setIndex(tris);
  out.computeVertexNormals();
  return out;
}
