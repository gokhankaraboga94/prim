import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { buildKnightSoldier } from "../../knightSoldier";
import { buildNameAtlas, type NameAtlas, type NameCell } from "../../nameAtlas";
import { REEL_HOLD } from "../../recordCanvas";
import { WARS_FOES, WARS_FRIENDS, warsCam, warsKnight, warsRoman } from "../../warsReel";

const dummy = new THREE.Object3D();
const NAME_S = 1.55;

type RomanPart = { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial };

function tuneRoman(src: THREE.Material) {
  const mat = (src as THREE.MeshStandardMaterial).clone();
  const c = mat.color;
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  const sat = max < 0.02 ? 0 : (max - min) / max;
  const skin = sat > 0.4 && c.r > 0.75 && c.g > 0.4 && c.b > 0.15 && c.b < 0.5;
  const leather = c.r > c.g && c.g > c.b && c.r < 0.45 && sat > 0.45;
  const steel = sat < 0.22 && max > 0.55 && max < 0.9 && min > 0.45;
  if (skin || leather) {
    mat.metalness = 0.04;
    mat.roughness = 0.68;
    mat.envMapIntensity = 0.4;
  } else if (steel) {
    mat.metalness = 0.84;
    mat.roughness = 0.26;
    mat.envMapIntensity = 1;
  } else {
    mat.color.set("#c41c16");
    mat.metalness = 0.58;
    mat.roughness = 0.36;
    mat.envMapIntensity = 0.85;
  }
  return mat;
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

function buildRoman(root: THREE.Object3D): RomanPart[] {
  root.updateMatrixWorld(true);
  const raw: RomanPart[] = [];
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
    raw.push({ geometry: geo, material: tuneRoman(Array.isArray(src) ? src[0] : src) });
  });
  const height = Math.max(0.001, box.max.y - box.min.y);
  const s = 1.66 / height;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const fit = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-cx, -box.min.y, -cz));
  for (const part of raw) {
    part.geometry.applyMatrix4(fit);
    part.geometry.computeVertexNormals();
  }
  return raw;
}

function pose(x: number, z: number, yaw: number, fall: number, pitch: number, roll: number, y = 0.05) {
  const ease = fall * fall;
  dummy.rotation.order = "YXZ";
  dummy.position.set(x, y, z);
  dummy.rotation.set(pitch, yaw, roll);
  dummy.scale.setScalar(1);
  dummy.updateMatrix();
}

export function WarsCam() {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = warsCam(Math.max(0, clock.elapsedTime - REEL_HOLD));
    persp.fov = shot.fov;
    persp.near = 0.4;
    persp.far = 420;
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

function useWarsGrass() {
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#4e9a38";
    ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 14000; i++) {
      const n = i % 7;
      ctx.fillStyle = n === 0 ? "#7ec85a" : n === 1 ? "#3d8228" : n === 2 ? "#68b448" : n === 3 ? "#357820" : n === 4 ? "#96d868" : n === 5 ? "#5aa838" : "#2c681c";
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2 + Math.random() * 8, 2 + Math.random() * 7);
    }
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = "rgba(92, 68, 36, 0.2)";
      ctx.beginPath();
      ctx.ellipse(Math.random() * 1024, Math.random() * 1024, 8 + Math.random() * 24, 5 + Math.random() * 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(42, 42);
    map.anisotropy = 8;
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  useEffect(() => () => tex?.dispose(), [tex]);
  return tex;
}

function WarsGround() {
  const grass = useWarsGrass();
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[1800, 1800]} />
        <meshStandardMaterial map={grass} color="#68b44a" roughness={0.94} metalness={0.02} envMapIntensity={0.2} />
      </mesh>
    </group>
  );
}

function WarsFighters() {
  const [knight, setKnight] = useState<{ body: THREE.BufferGeometry; helm: THREE.BufferGeometry } | null>(null);
  const [roman, setRoman] = useState<RomanPart[] | null>(null);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const helmRef = useRef<THREE.InstancedMesh>(null);
  const romanRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a56e8", roughness: 0.42, metalness: 0.38, envMapIntensity: 0.85 }), []);
  const helmMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e7eef5", roughness: 0.18, metalness: 0.9, envMapIntensity: 1.15 }), []);

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
        for (const part of built) {
          part.geometry.dispose();
          part.material.dispose();
        }
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
    };
  }, [bodyMat, helmMat]);

  useEffect(() => {
    return () => {
      knight?.body.dispose();
      knight?.helm.dispose();
    };
  }, [knight]);

  useEffect(() => {
    return () => {
      for (const part of roman ?? []) {
        part.geometry.dispose();
        part.material.dispose();
      }
    };
  }, [roman]);

  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const body = bodyRef.current;
    const helm = helmRef.current;
    if (body && helm) {
      for (let i = 0; i < WARS_FRIENDS; i++) {
        const p = warsKnight(i, t);
        const ease = p.fall * p.fall;
        const swing = p.fall > 0 ? 0 : Math.max(0, Math.sin(t * 8.4 + i));
        pose(p.x, p.z, p.yaw, p.fall, p.fall > 0 ? -1.38 * ease : -(swing * 0.16 + p.lean * 0.72), p.fall > 0 ? (i % 2 ? 0.22 : -0.22) * ease : p.lean * 0.28);
        body.setMatrixAt(i, dummy.matrix);
        helm.setMatrixAt(i, dummy.matrix);
      }
      body.instanceMatrix.needsUpdate = true;
      helm.instanceMatrix.needsUpdate = true;
    }
    if (!roman) return;
    for (let part = 0; part < roman.length; part++) {
      const mesh = romanRefs.current[part];
      if (!mesh) continue;
      for (let i = 0; i < WARS_FOES; i++) {
        const p = warsRoman(i, t);
        const ease = p.fall * p.fall;
        const swing = p.fall > 0 ? 0 : Math.max(0, Math.sin(t * 7.1 + i * 1.6));
        pose(p.x, p.z, p.yaw, p.fall, p.fall > 0 ? -1.32 * ease : -(swing * 0.14 + p.lean * 0.68), p.fall > 0 ? (i % 2 ? -0.18 : 0.18) * ease : -p.lean * 0.24);
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {knight && (
        <>
          <instancedMesh ref={bodyRef} args={[knight.body, bodyMat, WARS_FRIENDS]} frustumCulled={false} />
          <instancedMesh ref={helmRef} args={[knight.helm, helmMat, WARS_FRIENDS]} frustumCulled={false} />
        </>
      )}
      {roman?.map((part, i) => (
        <instancedMesh
          key={i}
          ref={(node) => {
            romanRefs.current[i] = node;
          }}
          args={[part.geometry, part.material, WARS_FOES]}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}

function WarsNames({ names }: { names: string[] }) {
  const labels = useMemo(() => {
    const out: { slot: number; text: string }[] = [];
    for (let i = 0; i < WARS_FRIENDS; i++) {
      const text = String(names[i] ?? "").trim().replace(/^@+/, "");
      if (text) out.push({ slot: i, text });
    }
    return out;
  }, [names]);
  const atlas = useMemo<NameAtlas>(
    () => buildNameAtlas(labels.map((n) => ({ text: n.text, commander: false, plain: true, fill: "#ffe14a" })), true),
    [labels]
  );
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const { camera } = useThree();

  useEffect(() => () => atlas.dispose(), [atlas]);

  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    for (let s = 0; s < atlas.sheets.length; s++) {
      const mesh = refs.current[s];
      if (!mesh) continue;
      for (let k = 0; k < labels.length; k++) {
        const cell: NameCell | undefined = atlas.cells[k];
        if (!cell || cell.sheet !== s) continue;
        const slot = labels[k].slot;
        const p = warsKnight(slot, t);
        const hide = p.fall > 0.72;
        dummy.quaternion.copy(camera.quaternion);
        dummy.rotateY(Math.PI);
        dummy.position.set(p.x, 2.55, p.z);
        dummy.scale.set(hide ? 0 : Math.min(2.85, cell.sx * NAME_S), hide ? 0 : cell.sy * NAME_S, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(cell.local, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
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

export function WarsBattle({ names }: { names: string[] }) {
  return (
    <group>
      <WarsGround />
      <WarsFighters />
      <WarsNames names={names} />
    </group>
  );
}
