import * as THREE from "three";

export function dropGroundSlab(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute | undefined;
  const index = geo.getIndex();
  if (!pos || pos.count < 30) return geo;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minY = Math.min(minY, pos.getY(i));
    maxY = Math.max(maxY, pos.getY(i));
  }
  const height = maxY - minY;
  if (height < 1e-4) return geo;
  const xs: number[] = [];
  const zs: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY + height * 0.38 || y > minY + height * 0.72) continue;
    xs.push(pos.getX(i));
    zs.push(pos.getZ(i));
  }
  if (xs.length < 20) return geo;
  xs.sort((a, b) => a - b);
  zs.sort((a, b) => a - b);
  const torsoX = xs[Math.floor(xs.length * 0.92)] - xs[Math.floor(xs.length * 0.08)];
  const torsoZ = zs[Math.floor(zs.length * 0.92)] - zs[Math.floor(zs.length * 0.08)];
  if (torsoX < 1e-4 || torsoZ < 1e-4) return geo;
  let cut: number | null = null;
  for (let step = 1; step <= 8; step++) {
    const y0 = minY + height * 0.025 * (step - 1);
    const y1 = minY + height * 0.025 * step;
    let n = 0;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < y0 || y >= y1) continue;
      n += 1;
      x0 = Math.min(x0, pos.getX(i));
      x1 = Math.max(x1, pos.getX(i));
      z0 = Math.min(z0, pos.getZ(i));
      z1 = Math.max(z1, pos.getZ(i));
    }
    if (n < pos.count * 0.012) break;
    const wideX = x1 - x0 > torsoX * 1.35;
    const wideZ = z1 - z0 > torsoZ * 1.35;
    const thin = y1 - y0 < Math.max(x1 - x0, z1 - z0) * 0.35;
    if (!(wideX && wideZ && thin)) break;
    cut = y1;
  }
  if (cut == null) return geo;
  const triCount = index ? index.count / 3 : pos.count / 3;
  const at = (i: number) => (index ? index.getX(i) : i);
  const kept: number[] = [];
  for (let t = 0; t < triCount; t++) {
    const a = at(t * 3);
    const b = at(t * 3 + 1);
    const c = at(t * 3 + 2);
    if (Math.max(pos.getY(a), pos.getY(b), pos.getY(c)) < cut) continue;
    kept.push(a, b, c);
  }
  if (!kept.length || kept.length === triCount * 3) return geo;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  const normal = geo.getAttribute("normal") as THREE.BufferAttribute | undefined;
  const map = new Map<number, number>();
  const order: number[] = [];
  const nextIndex: number[] = [];
  for (const v of kept) {
    let id = map.get(v);
    if (id == null) {
      id = order.length;
      map.set(v, id);
      order.push(v);
    }
    nextIndex.push(id);
  }
  const next = new THREE.BufferGeometry();
  const positions = new Float32Array(order.length * 3);
  for (let i = 0; i < order.length; i++) {
    positions[i * 3] = pos.getX(order[i]);
    positions[i * 3 + 1] = pos.getY(order[i]);
    positions[i * 3 + 2] = pos.getZ(order[i]);
  }
  next.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (uv) {
    const uvs = new Float32Array(order.length * 2);
    for (let i = 0; i < order.length; i++) {
      uvs[i * 2] = uv.getX(order[i]);
      uvs[i * 2 + 1] = uv.getY(order[i]);
    }
    next.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  }
  next.setIndex(nextIndex);
  // Without normals a lit material renders solid black; keep the authored ones or rebuild them.
  if (normal) {
    const normals = new Float32Array(order.length * 3);
    for (let i = 0; i < order.length; i++) {
      normals[i * 3] = normal.getX(order[i]);
      normals[i * 3 + 1] = normal.getY(order[i]);
      normals[i * 3 + 2] = normal.getZ(order[i]);
    }
    next.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  } else {
    next.computeVertexNormals();
  }
  geo.dispose();
  return next;
}
