import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { buildKnightSoldier } from "../../knightSoldier";
import { buildNameAtlas, type NameAtlas, type NameCell } from "../../nameAtlas";
import { REEL_HOLD } from "../../recordCanvas";
import { makeOrduLayout, orduCam, orduFar, orduKnight, orduRoman, type OrduLayout } from "../../orduReel";

const dummy = new THREE.Object3D();
const lookDir = new THREE.Vector3();

function romanColor(src: THREE.Material) {
  const c = (src as THREE.MeshStandardMaterial).color;
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  const sat = max < 0.02 ? 0 : (max - min) / max;
  const skin = sat > 0.4 && c.r > 0.75 && c.g > 0.4 && c.b > 0.15 && c.b < 0.5;
  const leather = c.r > c.g && c.g > c.b && c.r < 0.45 && sat > 0.45;
  const steel = sat < 0.22 && max > 0.55 && max < 0.9 && min > 0.45;
  if (skin || leather || steel) return c.clone();
  return new THREE.Color("#c41c16");
}

function paintRoman(geo: THREE.BufferGeometry, color: THREE.Color) {
  const src = geo.getIndex() ? geo.toNonIndexed() : geo;
  const pos = src.getAttribute("position");
  const next = new THREE.BufferGeometry();
  next.setAttribute("position", pos.clone());
  const norm = src.getAttribute("normal");
  if (norm) next.setAttribute("normal", norm.clone());
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  next.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  if (!norm) next.computeVertexNormals();
  if (src !== geo) src.dispose();
  return next;
}

function withoutFootBase(geo: THREE.BufferGeometry) {
  const srcPos = geo.getAttribute("position");
  const srcNorm = geo.getAttribute("normal");
  const index = geo.getIndex();
  if (!srcPos) return geo;
  geo.computeBoundingBox();
  const bounds = geo.boundingBox;
  if (!bounds) return geo;
  const height = bounds.max.y - bounds.min.y;
  const wide = bounds.max.x - bounds.min.x > 0.22 && bounds.max.z - bounds.min.z > 0.22;
  if (wide && height < 0.05 && bounds.max.y < -0.15) return null;
  const hasBase = bounds.min.y < -0.3 && bounds.max.y > 0;
  if (!hasBase) return geo;
  const kept: number[] = [];
  const pushTri = (a: number, b: number, c: number) => {
    const top = Math.max(srcPos.getY(a), srcPos.getY(b), srcPos.getY(c));
    if (top < 0) return;
    kept.push(a, b, c);
  };
  if (index) {
    for (let i = 0; i < index.count; i += 3) pushTri(index.getX(i), index.getX(i + 1), index.getX(i + 2));
  } else {
    for (let i = 0; i < srcPos.count; i += 3) pushTri(i, i + 1, i + 2);
  }
  if (!kept.length) return null;
  if (kept.length === (index ? index.count : srcPos.count)) return geo;
  const next = new THREE.BufferGeometry();
  const positions = new Float32Array(kept.length * 3);
  const normals = srcNorm ? new Float32Array(kept.length * 3) : null;
  for (let i = 0; i < kept.length; i++) {
    const v = kept[i];
    positions[i * 3] = srcPos.getX(v);
    positions[i * 3 + 1] = srcPos.getY(v);
    positions[i * 3 + 2] = srcPos.getZ(v);
    if (normals && srcNorm) {
      normals[i * 3] = srcNorm.getX(v);
      normals[i * 3 + 1] = srcNorm.getY(v);
      normals[i * 3 + 2] = srcNorm.getZ(v);
    }
  }
  next.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (normals) next.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.dispose();
  return next;
}

function buildRoman(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const pieces: THREE.BufferGeometry[] = [];
  const box = new THREE.Box3();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const cloned = mesh.geometry.clone();
    cloned.applyMatrix4(mesh.matrixWorld);
    const geo = withoutFootBase(cloned);
    if (!geo) {
      cloned.dispose();
      return;
    }
    geo.computeBoundingBox();
    if (geo.boundingBox) box.union(geo.boundingBox);
    const src = mesh.material;
    pieces.push(paintRoman(geo, romanColor(Array.isArray(src) ? src[0] : src)));
    geo.dispose();
  });
  if (!pieces.length || box.isEmpty()) return null;
  const merged = mergeGeometries(pieces, false);
  for (const piece of pieces) piece.dispose();
  if (!merged) return null;
  const height = Math.max(0.001, box.max.y - box.min.y);
  const s = 1.66 / height;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  merged.applyMatrix4(new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-cx, -box.min.y, -cz)));
  merged.computeVertexNormals();
  return merged;
}

function pose(x: number, z: number, yaw: number, pitch: number, roll: number, show: boolean) {
  dummy.rotation.order = "YXZ";
  dummy.position.set(x, 0.05, z);
  dummy.rotation.set(pitch, yaw, roll);
  dummy.scale.setScalar(show ? 1 : 0);
  dummy.updateMatrix();
}

function inFront(camera: THREE.Camera, x: number, z: number) {
  camera.getWorldDirection(lookDir);
  const dx = x - camera.position.x;
  const dy = 1.4 - camera.position.y;
  const dz = z - camera.position.z;
  return dx * lookDir.x + dy * lookDir.y + dz * lookDir.z > 2.4;
}

export function OrduCam({ soldiers }: { soldiers: number }) {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = orduCam(Math.max(0, clock.elapsedTime - REEL_HOLD), soldiers);
    persp.fov = shot.fov;
    persp.near = 0.35;
    persp.far = orduFar(soldiers);
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

const SOIL_PERIOD = 64;

function soilHash(ix: number, iy: number) {
  const x = ((ix % SOIL_PERIOD) + SOIL_PERIOD) % SOIL_PERIOD;
  const y = ((iy % SOIL_PERIOD) + SOIL_PERIOD) % SOIL_PERIOD;
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function soilNoise(x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = soilHash(x0, y0);
  const b = soilHash(x0 + 1, y0);
  const c = soilHash(x0, y0 + 1);
  const d = soilHash(x0 + 1, y0 + 1);
  return a * (1 - sx) * (1 - sy) + b * sx * (1 - sy) + c * (1 - sx) * sy + d * sx * sy;
}

function soilFbm(x: number, y: number) {
  let value = 0;
  let amp = 0.52;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    value += amp * soilNoise(x * freq, y * freq);
    freq *= 2;
    amp *= 0.5;
  }
  return value;
}

function soilStep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function buildOrduSoil() {
  const size = 768;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const colorCtx = colorCanvas.getContext("2d");
  const bumpCtx = bumpCanvas.getContext("2d");
  if (!colorCtx || !bumpCtx) return null;
  const color = colorCtx.createImageData(size, size);
  const bump = bumpCtx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * SOIL_PERIOD;
      const v = (y / size) * SOIL_PERIOD;
      const broad = soilFbm(u * 0.85, v * 0.85);
      const mid = soilFbm(u * 2.3 + 5, v * 2.3 + 2);
      const grit = soilNoise(u * 22, v * 22);
      const pebbleN = soilNoise(u * 9.5 + 14, v * 9.5 + 6);
      const pebble = pebbleN > 0.74 ? (pebbleN - 0.74) / 0.26 : 0;
      const damp = soilStep(0.58, 0.88, soilFbm(u * 1.25 + 8, v * 1.25));
      const dust = soilStep(0.66, 0.9, soilFbm(u * 1.6 + 3, v * 1.15 + 11));
      let r = 58 + broad * 28 + mid * 11 + (grit - 0.5) * 10;
      let g = 32 + broad * 16 + mid * 6 + (grit - 0.5) * 6;
      let b = 14 + broad * 8 + mid * 3 + (grit - 0.5) * 3;
      r = r * (1 - damp * 0.34) + dust * 16;
      g = g * (1 - damp * 0.26) + dust * 10;
      b = b * (1 - damp * 0.14) + dust * 4;
      r = r * (1 - pebble * 0.85) + 96 * pebble;
      g = g * (1 - pebble * 0.85) + 84 * pebble;
      b = b * (1 - pebble * 0.85) + 68 * pebble;
      const i = (y * size + x) * 4;
      color.data[i] = Math.max(0, Math.min(255, r));
      color.data[i + 1] = Math.max(0, Math.min(255, g));
      color.data[i + 2] = Math.max(0, Math.min(255, b));
      color.data[i + 3] = 255;
      const height = Math.max(0, Math.min(255, (broad * 0.42 + mid * 0.28 + grit * 0.12 + pebble * 0.7) * 255));
      bump.data[i] = height;
      bump.data[i + 1] = height;
      bump.data[i + 2] = height;
      bump.data[i + 3] = 255;
    }
  }
  colorCtx.putImageData(color, 0, 0);
  bumpCtx.putImageData(bump, 0, 0);
  const map = new THREE.CanvasTexture(colorCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  for (const tex of [map, bumpMap]) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  bumpMap.colorSpace = THREE.LinearSRGBColorSpace;
  return { map, bumpMap };
}

function OrduGround({ layout }: { layout: OrduLayout }) {
  const size = Math.max(420, layout.width * 6 + layout.depth * 8 + 80);
  const soil = useMemo(() => buildOrduSoil(), []);
  useLayoutEffect(() => {
    if (!soil) return;
    const repeat = size / 12;
    soil.map.repeat.set(repeat, repeat);
    soil.bumpMap.repeat.set(repeat, repeat);
  }, [soil, size]);
  useEffect(() => () => {
    soil?.map.dispose();
    soil?.bumpMap.dispose();
  }, [soil]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial map={soil?.map} bumpMap={soil?.bumpMap} bumpScale={1.8} color="#c4aa96" roughness={0.96} metalness={0} />
    </mesh>
  );
}

function markDynamic(mesh: THREE.InstancedMesh | null) {
  mesh?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
}

function OrduFighters({ layout }: { layout: OrduLayout }) {
  const [knight, setKnight] = useState<{ body: THREE.BufferGeometry; helm: THREE.BufferGeometry } | null>(null);
  const [roman, setRoman] = useState<THREE.BufferGeometry | null>(null);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const helmRef = useRef<THREE.InstancedMesh>(null);
  const romanRef = useRef<THREE.InstancedMesh>(null);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a56e8", roughness: 0.42, metalness: 0.38, envMapIntensity: 0.85 }), []);
  const helmMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e7eef5", roughness: 0.18, metalness: 0.9, envMapIntensity: 1.15 }), []);
  const romanMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.46, metalness: 0.4, envMapIntensity: 0.7 }), []);

  useEffect(() => {
    let drop = false;
    const loader = new GLTFLoader();
    loader.load("/models/knight.glb", (gltf) => {
      if (drop) return;
      setKnight(buildKnightSoldier(gltf.scene));
    });
    loader.load("/models/roman.glb", (gltf) => {
      const built = buildRoman(gltf.scene);
      if (drop) {
        built?.dispose();
        return;
      }
      setRoman(built);
    });
    return () => {
      drop = true;
    };
  }, []);

  useEffect(() => () => {
    bodyMat.dispose();
    helmMat.dispose();
    romanMat.dispose();
  }, [bodyMat, helmMat, romanMat]);
  useEffect(() => () => {
    knight?.body.dispose();
    knight?.helm.dispose();
  }, [knight]);
  useEffect(() => () => roman?.dispose(), [roman]);
  useLayoutEffect(() => {
    markDynamic(bodyRef.current);
    markDynamic(helmRef.current);
    markDynamic(romanRef.current);
  }, [knight, roman, layout.friends]);

  useFrame(({ clock, camera }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const body = bodyRef.current;
    const helm = helmRef.current;
    for (let i = 0; i < layout.friends; i++) {
      const p = orduKnight(layout, i, t);
      layout.liveX[i] = p.x;
      layout.liveZ[i] = p.z;
      const show = inFront(camera, p.x, p.z);
      if (!body || !helm) continue;
      pose(p.x, p.z, p.yaw, p.pitch, p.roll, show);
      body.setMatrixAt(i, dummy.matrix);
      helm.setMatrixAt(i, dummy.matrix);
    }
    if (body && helm) {
      body.instanceMatrix.needsUpdate = true;
      helm.instanceMatrix.needsUpdate = true;
    }
    const foes = romanRef.current;
    if (!foes) return;
    for (let i = 0; i < layout.foes; i++) {
      const p = orduRoman(layout, i, t);
      const show = inFront(camera, p.x, p.z);
      pose(p.x, p.z, p.yaw, p.pitch, p.roll, show);
      foes.setMatrixAt(i, dummy.matrix);
    }
    foes.instanceMatrix.needsUpdate = true;
  });

  if (layout.friends < 1) return null;
  return (
    <group>
      {knight && (
        <>
          <instancedMesh ref={bodyRef} args={[knight.body, bodyMat, layout.friends]} frustumCulled={false} />
          <instancedMesh ref={helmRef} args={[knight.helm, helmMat, layout.friends]} frustumCulled={false} />
        </>
      )}
      {roman && <instancedMesh ref={romanRef} args={[roman, romanMat, layout.foes]} frustumCulled={false} />}
    </group>
  );
}

function OrduNames({ names, layout }: { names: string[]; layout: OrduLayout }) {
  const labels = useMemo(() => {
    const out: { slot: number; text: string }[] = [];
    for (let i = 0; i < layout.friends; i++) {
      const text = String(names[i] ?? "").trim().replace(/^@+/, "");
      if (text) out.push({ slot: i, text });
    }
    return out;
  }, [names, layout.friends]);
  const atlas = useMemo<NameAtlas>(
    () => buildNameAtlas(labels.map((n) => ({ text: n.text, commander: false, plain: true, fill: "#ffe14a" })), true),
    [labels]
  );
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const { camera } = useThree();
  useEffect(() => () => atlas.dispose(), [atlas]);

  useFrame(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const fov = persp.isPerspectiveCamera ? persp.fov : 50;
    const tanH = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * (1080 / 1920);
    camera.getWorldDirection(lookDir);
    dummy.quaternion.copy(camera.quaternion);
    for (let k = 0; k < labels.length; k++) {
      const cell: NameCell | undefined = atlas.cells[k];
      const mesh = cell ? refs.current[cell.sheet] : null;
      if (!cell || !mesh) continue;
      const slot = labels[k].slot;
      const x = layout.liveX[slot];
      const z = layout.liveZ[slot];
      const dx = x - camera.position.x;
      const dz = z - camera.position.z;
      const ahead = dx * lookDir.x + (2.45 - camera.position.y) * lookDir.y + dz * lookDir.z;
      const dist = Math.hypot(dx, camera.position.y - 2.45, dz);
      const hide = ahead < 2.4;
      const want = Math.min(layout.pitchX * 0.86, dist * tanH * 0.46) * 1.5;
      const size = want / 2.9;
      dummy.position.set(x, 2.42, z);
      dummy.scale.set(hide ? 0 : cell.sx * size, hide ? 0 : cell.sy * size, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(cell.local, dummy.matrix);
    }
    for (const mesh of refs.current) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {atlas.sheets.map((sheet, s) =>
        sheet.count > 0 ? (
          <instancedMesh
            key={s}
            ref={(node) => {
              refs.current[s] = node;
            }}
            args={[sheet.geometry, sheet.material, sheet.count]}
            frustumCulled={false}
            renderOrder={40}
          />
        ) : null
      )}
    </group>
  );
}

export function OrduBattle({ names, soldiers }: { names: string[]; soldiers: number }) {
  const layout = useMemo(() => makeOrduLayout(soldiers), [soldiers]);
  return (
    <group>
      <OrduGround layout={layout} />
      <OrduFighters layout={layout} />
      <OrduNames names={names} layout={layout} />
    </group>
  );
}
