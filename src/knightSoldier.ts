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
