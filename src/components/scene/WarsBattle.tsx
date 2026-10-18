import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { buildKnightSoldier } from "../../knightSoldier";
import { buildNameAtlas, type NameAtlas, type NameCell } from "../../nameAtlas";
import { REEL_HOLD } from "../../recordCanvas";
import { makeWarsLayout, warsCam, warsKnight, warsRoman, warsView, type WarsLayout } from "../../warsReel";

const dummy = new THREE.Object3D();
const NAME_S = 1.395 * 0.8 * (56 / 40.95);
const NAME_CAP = 2.57 * 0.8 * (56 / 40.95);

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

function pose(x: number, z: number, yaw: number, fall: number, pitch: number, roll: number, y = 0.05) {
  const ease = fall * fall;
  dummy.rotation.order = "YXZ";
  dummy.position.set(x, y, z);
  dummy.rotation.set(pitch, yaw, roll);
  dummy.scale.setScalar(1);
  dummy.updateMatrix();
}

export function WarsCam({ soldiers }: { soldiers: number }) {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = warsCam(Math.max(0, clock.elapsedTime - REEL_HOLD), soldiers);
    persp.fov = shot.fov;
    persp.near = 0.4;
    persp.far = Math.max(640, 860 * warsView(soldiers));
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

function useWarsStone() {
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#6a6560";
    ctx.fillRect(0, 0, 1024, 1024);
    const tones = ["#c8c2b6", "#b3aea3", "#d5d0c4", "#9a958c", "#aea89c", "#e0dbd0", "#8d8880", "#bcb6aa"];
    const cols = 14;
    const rows = 14;
    const cw = 1024 / cols;
    const ch = 1024 / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const jx = ((x * 17 + y * 9) % 9) - 4;
        const jy = ((x * 5 + y * 13) % 9) - 4;
        const w = cw - 8;
        const h = ch - 8;
        const px = x * cw + 4 + jx;
        const py = y * ch + 4 + jy;
        ctx.fillStyle = tones[(x * 3 + y * 5) % tones.length];
        ctx.fillRect(px, py, w, h);
        ctx.fillStyle = "rgba(255,252,246,0.16)";
        ctx.fillRect(px, py, w, 3);
        ctx.fillRect(px, py, 3, h);
        ctx.fillStyle = "rgba(28,24,20,0.22)";
        ctx.fillRect(px, py + h - 4, w, 4);
        ctx.fillRect(px + w - 4, py, 4, h);
      }
    }
    for (let i = 0; i < 7000; i++) {
      ctx.fillStyle = i % 3 === 0 ? "rgba(255,250,242,0.14)" : "rgba(36,32,28,0.16)";
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    ctx.strokeStyle = "rgba(42,38,34,0.4)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 22; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 16 + Math.random() * 48, y + 8 + Math.random() * 36);
      ctx.stroke();
    }
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(64, 64);
    map.anisotropy = 8;
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  useEffect(() => () => tex?.dispose(), [tex]);
  return tex;
}

function WarsGround({ span }: { span: number }) {
  const stone = useWarsStone();
  useLayoutEffect(() => {
    if (!stone) return;
    const repeat = 64 * span;
    stone.repeat.set(repeat, repeat);
  }, [stone, span]);
  const size = 1800 * span;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial map={stone} color="#f3f0ea" roughness={0.84} metalness={0.04} envMapIntensity={0.32} />
      </mesh>
    </group>
  );
}

function markDynamic(mesh: THREE.InstancedMesh | null) {
  mesh?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
}

function WarsFighters({ layout }: { layout: WarsLayout }) {
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

  useEffect(() => {
    return () => {
      bodyMat.dispose();
      helmMat.dispose();
      romanMat.dispose();
    };
  }, [bodyMat, helmMat, romanMat]);

  useEffect(() => {
    return () => {
      knight?.body.dispose();
      knight?.helm.dispose();
    };
  }, [knight]);

  useEffect(() => () => roman?.dispose(), [roman]);

  useLayoutEffect(() => {
    markDynamic(bodyRef.current);
    markDynamic(helmRef.current);
    markDynamic(romanRef.current);
  }, [knight, roman, layout.friends]);

  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const body = bodyRef.current;
    const helm = helmRef.current;
    for (let i = 0; i < layout.friends; i++) {
      const p = warsKnight(layout, i, t);
      layout.liveX[i] = p.x;
      layout.liveZ[i] = p.z;
      layout.liveFall[i] = p.fall;
      if (!body || !helm) continue;
      pose(p.x, p.z, p.yaw, p.fall, p.fall > 0 ? -1.25 * p.fall : -p.lean * 0.42, p.fall > 0 ? (i % 2 ? 0.16 : -0.16) * p.fall : p.lean * 0.08);
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
      const p = warsRoman(layout, i, t);
      pose(p.x, p.z, p.yaw, p.fall, p.fall > 0 ? -1.22 * p.fall : -p.lean * 0.4, p.fall > 0 ? (i % 2 ? -0.12 : 0.12) * p.fall : -p.lean * 0.08);
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

function WarsNames({ names, layout }: { names: string[]; layout: WarsLayout }) {
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

  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const size = NAME_S * layout.view;
    const cap = NAME_CAP * layout.view;
    const lift = 2.45 * layout.view;
    dummy.quaternion.copy(camera.quaternion);
    for (let k = 0; k < labels.length; k++) {
      const cell: NameCell | undefined = atlas.cells[k];
      const mesh = cell ? refs.current[cell.sheet] : null;
      if (!cell || !mesh) continue;
      const slot = labels[k].slot;
      const hide = layout.liveFall[slot] > 0.72;
      dummy.position.set(layout.liveX[slot], lift, layout.liveZ[slot]);
      dummy.scale.set(hide ? 0 : Math.min(cap, cell.sx * size), hide ? 0 : cell.sy * size, 1);
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

export function WarsBattle({ names, soldiers }: { names: string[]; soldiers: number }) {
  const layout = useMemo(() => makeWarsLayout(soldiers), [soldiers]);
  return (
    <group>
      <WarsGround span={layout.span} />
      <WarsFighters layout={layout} />
      <WarsNames names={names} layout={layout} />
    </group>
  );
}
