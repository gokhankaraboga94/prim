import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { dropGroundSlab } from "../groundSlab";
import { simplifySkinned } from "../knightSoldier";
import type { CharacterDef } from "./catalog";

export type CharacterAsset = {
  id: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  radius: number;
};

const METAL = new THREE.Color("#a7b0b8");
const INK = new THREE.Color("#3a3e46");
const STEEL = new THREE.Color("#d7dee6");
const WRAP = new THREE.Color("#3a3e46");

function loaderParse(url: string) {
  return new Promise<THREE.Group>((resolve, reject) => {
    new GLTFLoader().load(url, (gltf) => resolve(gltf.scene), undefined, reject);
  });
}

function materialColor(src: THREE.Material) {
  const mat = (Array.isArray(src) ? src[0] : src) as THREE.MeshStandardMaterial;
  return mat.color ? mat.color.clone() : new THREE.Color("#d8d2c8");
}

function materialMap(src: THREE.Material) {
  const mat = (Array.isArray(src) ? src[0] : src) as THREE.MeshStandardMaterial;
  return mat.map ?? null;
}

function dropFoot(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position");
  if (!pos) return geo;
  geo.computeBoundingBox();
  const bounds = geo.boundingBox;
  if (!bounds) return geo;
  const wide = bounds.max.x - bounds.min.x > 0.22 && bounds.max.z - bounds.min.z > 0.22;
  const height = bounds.max.y - bounds.min.y;
  if (wide && height < 0.05 && bounds.max.y < -0.15) return null;
  if (bounds.min.y >= -0.3 || bounds.max.y <= 0) return geo;
  const index = geo.getIndex();
  const kept: number[] = [];
  const push = (a: number, b: number, c: number) => {
    if (Math.max(pos.getY(a), pos.getY(b), pos.getY(c)) < 0) return;
    kept.push(a, b, c);
  };
  if (index) {
    for (let i = 0; i < index.count; i += 3) push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
  } else {
    for (let i = 0; i < pos.count; i += 3) push(i, i + 1, i + 2);
  }
  if (!kept.length || kept.length === (index ? index.count : pos.count)) return geo;
  const next = new THREE.BufferGeometry();
  const positions = new Float32Array(kept.length * 3);
  for (let i = 0; i < kept.length; i++) {
    const v = kept[i];
    positions[i * 3] = pos.getX(v);
    positions[i * 3 + 1] = pos.getY(v);
    positions[i * 3 + 2] = pos.getZ(v);
  }
  next.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  next.computeVertexNormals();
  geo.dispose();
  return next;
}

function painted(geo: THREE.BufferGeometry, color: THREE.Color) {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const pos = src.getAttribute("position");
  const next = new THREE.BufferGeometry();
  next.setAttribute("position", pos.clone());
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  next.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  next.computeVertexNormals();
  if (src !== geo) src.dispose();
  return next;
}

function fit(geo: THREE.BufferGeometry, height: number) {
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  if (!box) return 0.4;
  const span = Math.max(0.001, box.max.y - box.min.y);
  const s = height / span;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  geo.applyMatrix4(new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-cx, -box.min.y, -cz)));
  geo.computeBoundingBox();
  const fitted = geo.boundingBox;
  if (!fitted) return height * 0.3;
  return Math.max(0.35, fitted.max.x, -fitted.min.x, fitted.max.z, -fitted.min.z);
}

function bake(mesh: THREE.Mesh) {
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  return geo;
}

function colossusInk(mesh: THREE.Mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const hand = (center.z > 0.55 && center.y < 0.65 && center.y > -0.95 && center.x < 0.15) || (center.x > 0.28 && center.y > 0.02 && center.y < 0.55 && size.y < 0.4);
  const foot = center.y < -0.82 || (center.y < -0.7 && size.y < 0.4 && center.z < 0.55);
  const head = box.min.y > 0.62;
  return hand || foot || head;
}

function colossusSword() {
  const group = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.32, 6));
  grip.rotation.x = Math.PI / 2;
  grip.userData.paint = WRAP;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.08));
  guard.position.z = 0.18;
  guard.userData.paint = STEEL;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.028, 1.55));
  blade.position.z = 0.98;
  blade.userData.paint = STEEL;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.26, 4));
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 1.86;
  tip.userData.paint = STEEL;
  group.add(grip, guard, blade, tip);
  group.position.set(-0.42, -0.64, 0.98);
  group.rotation.x = 0.42;
  return group;
}

function lighten(geo: THREE.BufferGeometry) {
  const count = geo.getAttribute("position")?.count ?? 0;
  if (count < 12000) return geo;
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const span = box ? Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) : 1;
  const next = simplifySkinned(geo, Math.max(1e-4, span * (count > 200000 ? 0.01 : 0.014)));
  geo.dispose();
  return next;
}

export async function loadCharacter(def: CharacterDef): Promise<CharacterAsset> {
  const scene = await loaderParse(def.url);
  scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) meshes.push(mesh);
  });
  if (!meshes.length) throw new Error(def.label);
  if (meshes.length === 1 && def.id !== "colossus" && def.id !== "roman") {
    const mesh = meshes[0];
    let geo = lighten(dropGroundSlab(bake(mesh)));
    const radius = fit(geo, def.height);
    const map = materialMap(mesh.material as THREE.Material);
    const material = new THREE.MeshLambertMaterial({
      map,
      color: materialColor(mesh.material as THREE.Material),
      side: THREE.DoubleSide,
    });
    return { id: def.id, geometry: geo, material, radius };
  }
  const sword = def.id === "colossus" ? colossusSword() : null;
  if (sword) {
    scene.add(sword);
    scene.updateMatrixWorld(true);
    sword.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) meshes.push(mesh);
    });
  }
  const parts: THREE.BufferGeometry[] = [];
  for (const mesh of meshes) {
    let geo: THREE.BufferGeometry | null = bake(mesh);
    if (def.id === "roman") geo = dropFoot(geo);
    if (!geo) continue;
    const paint = (mesh.userData.paint as THREE.Color | undefined) ?? (def.id === "colossus" ? (colossusInk(mesh) ? INK : METAL) : materialColor(mesh.material as THREE.Material));
    parts.push(painted(geo, paint));
    geo.dispose();
  }
  if (!parts.length) throw new Error(def.label);
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error(def.label);
  const radius = fit(merged, def.height);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  return { id: def.id, geometry: merged, material, radius };
}

let thumbRenderer: THREE.WebGLRenderer | null = null;

export function snapshotCharacter(asset: CharacterAsset) {
  if (!thumbRenderer) {
    thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbRenderer.setSize(160, 160, false);
    thumbRenderer.setClearColor(0x14110e, 1);
    thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight("#ffffff", 0.85));
  const sun = new THREE.DirectionalLight("#fff2dc", 1.6);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  const mesh = new THREE.Mesh(asset.geometry, asset.material);
  scene.add(mesh);
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 200);
  const dist = Math.max(size.x, size.y, size.z) * 1.7;
  cam.position.set(center.x + dist * 0.45, center.y + dist * 0.28, center.z + dist);
  cam.lookAt(center);
  thumbRenderer.render(scene, cam);
  const url = thumbRenderer.domElement.toDataURL("image/jpeg", 0.72);
  scene.clear();
  return url;
}

export function disposeThumbRenderer() {
  thumbRenderer?.dispose();
  thumbRenderer = null;
}
