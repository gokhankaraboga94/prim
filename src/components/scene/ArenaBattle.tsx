import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { HERO_URLS, HERO_YAW } from "../../heroReel";
import {
  ARENA_CAGE,
  ARENA_CAGE_H,
  ARENA_FLOOR,
  ARENA_FOES,
  ARENA_HEROES,
  arenaCam,
  arenaFoe,
  arenaHero,
  type ArenaPose,
} from "../../arenaReel";

const HERO_H = 1.58;
const FOE_H = 1.22;
const dummy = new THREE.Object3D();
const pose: ArenaPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1 };

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

function buildFoe(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const pieces: THREE.BufferGeometry[] = [];
  const box = new THREE.Box3();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
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
  const s = FOE_H / height;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  merged.applyMatrix4(new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-cx, -box.min.y, -cz)));
  return merged;
}

function fitHero(scene: THREE.Group, yaw: number) {
  scene.rotation.y = yaw;
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const span = Math.max(0.001, box.max.y - box.min.y);
  scene.scale.setScalar(HERO_H / span);
  scene.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(scene);
  scene.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) mesh.frustumCulled = false;
  });
  return scene;
}

function ArenaCam() {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = arenaCam(Math.max(0, clock.elapsedTime - REEL_HOLD));
    persp.fov = shot.fov;
    persp.near = 0.15;
    persp.far = 280;
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

function ArenaSky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        vertexShader: `
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vPos;
          void main() {
            float h = normalize(vPos).y;
            vec3 zenith = vec3(0.16, 0.42, 0.86);
            vec3 horizon = vec3(0.62, 0.80, 0.95);
            vec3 below = vec3(0.74, 0.86, 0.96);
            vec3 col = mix(below, horizon, smoothstep(-0.55, -0.02, h));
            col = mix(col, zenith, smoothstep(0.0, 0.55, h));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    []
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} frustumCulled={false}>
      <sphereGeometry args={[140, 24, 16]} />
    </mesh>
  );
}

function ArenaCage() {
  const posts = 40;
  const rings = [0.55, 1.45, 2.35, 3.2];
  return (
    <group>
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <cylinderGeometry args={[ARENA_FLOOR, ARENA_FLOOR * 0.92, 0.36, 48]} />
        <meshStandardMaterial color="#c2ad8b" roughness={0.86} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[ARENA_FLOOR - 0.04, 48]} />
        <meshStandardMaterial color="#d7c4a2" roughness={0.78} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ARENA_FLOOR - 0.28, ARENA_FLOOR - 0.02, 48]} />
        <meshStandardMaterial color="#8d6a3e" roughness={0.7} />
      </mesh>
      {Array.from({ length: posts }, (_, i) => {
        const a = (i / posts) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * ARENA_CAGE, ARENA_CAGE_H / 2, Math.cos(a) * ARENA_CAGE]}>
            <cylinderGeometry args={[0.012, 0.012, ARENA_CAGE_H, 5]} />
            <meshStandardMaterial color="#9aa3ad" metalness={0.82} roughness={0.22} />
          </mesh>
        );
      })}
      {rings.map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[ARENA_CAGE, 0.018, 6, 64]} />
          <meshStandardMaterial color="#b7c0c8" metalness={0.86} roughness={0.18} />
        </mesh>
      ))}
      {Array.from({ length: posts / 2 }, (_, i) => {
        const a = (i / (posts / 2)) * Math.PI * 2;
        return (
          <mesh key={`x${i}`} position={[Math.sin(a) * ARENA_CAGE, ARENA_CAGE_H * 0.62, Math.cos(a) * ARENA_CAGE]} rotation={[0.9, a, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 1.55, 4]} />
            <meshStandardMaterial color="#aeb6be" metalness={0.8} roughness={0.24} />
          </mesh>
        );
      })}
    </group>
  );
}

function ArenaClouds() {
  return (
    <group position={[0, -22, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[70, 24]} />
        <meshBasicMaterial color="#f4f7fb" transparent opacity={0.9} />
      </mesh>
      <mesh position={[18, -3, -12]} rotation={[-Math.PI / 2, 0, 0.2]}>
        <circleGeometry args={[28, 20]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.75} />
      </mesh>
      <mesh position={[-22, -1.5, 8]} rotation={[-Math.PI / 2, 0, -0.4]}>
        <circleGeometry args={[22, 18]} />
        <meshBasicMaterial color="#e7eef6" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function ArenaFoes() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  useEffect(() => {
    let drop = false;
    const loader = new GLTFLoader();
    loader.load("/models/roman.glb", (gltf) => {
      if (drop) return;
      setGeo(buildFoe(gltf.scene));
    });
    return () => {
      drop = true;
    };
  }, []);
  useEffect(() => () => geo?.dispose(), [geo]);
  useFrame(({ clock }) => {
    const body = mesh.current;
    if (!body) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    let live = 0;
    for (let i = 0; i < ARENA_FOES; i++) {
      arenaFoe(i, t, pose);
      if (pose.s <= 0) continue;
      dummy.position.set(pose.x, pose.y, pose.z);
      dummy.rotation.set(pose.rx, pose.ry, pose.rz);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      body.setMatrixAt(live, dummy.matrix);
      live += 1;
    }
    body.count = live;
    body.instanceMatrix.needsUpdate = true;
  });
  if (!geo) return null;
  return (
    <instancedMesh ref={mesh} args={[geo, undefined, ARENA_FOES]} frustumCulled={false}>
      <meshLambertMaterial vertexColors />
    </instancedMesh>
  );
}

function ArenaHeroes() {
  const [bodies, setBodies] = useState<THREE.Object3D[] | null>(null);
  const keep = useRef<THREE.Group[]>([]);
  useEffect(() => {
    let drop = false;
    const loader = new GLTFLoader();
    let left = HERO_URLS.length;
    const loaded: THREE.Group[] = [];
    HERO_URLS.forEach((url, index) => {
      loader.load(url, (gltf) => {
        if (drop) return;
        loaded[index] = fitHero(gltf.scene, HERO_YAW[index] ?? 0);
        left -= 1;
        if (left > 0) return;
        keep.current = loaded;
        setBodies(loaded.slice(0, ARENA_HEROES));
      });
    });
    return () => {
      drop = true;
      for (const scene of keep.current) {
        scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            const std = mat as THREE.MeshStandardMaterial;
            std.map?.dispose();
            std.normalMap?.dispose();
            std.roughnessMap?.dispose();
            std.metalnessMap?.dispose();
            mat.dispose();
          }
        });
      }
      keep.current = [];
    };
  }, []);
  if (!bodies) return null;
  return (
    <group>
      {bodies.map((body, i) => (
        <ArenaHero key={i} index={i} body={body} />
      ))}
    </group>
  );
}

function ArenaHero({ index, body }: { index: number; body: THREE.Object3D }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const node = ref.current;
    if (!node) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    arenaHero(index, t, pose);
    node.position.set(pose.x, pose.y, pose.z);
    node.rotation.set(pose.rx, pose.ry, pose.rz);
  });
  return (
    <group ref={ref}>
      <primitive object={body} />
    </group>
  );
}

export function ArenaBattle() {
  return (
    <group>
      <ArenaSky />
      <ArenaClouds />
      <hemisphereLight args={["#d5e7ff", "#8a7048", 0.72]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[6, 11, 4]} intensity={2.2} color="#fff2dc" />
      <directionalLight position={[-5, 4, -3]} intensity={0.45} color="#9eb6ff" />
      <ArenaCage />
      <ArenaFoes />
      <ArenaHeroes />
    </group>
  );
}

export { ArenaCam };
