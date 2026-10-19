import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { buildNameAtlas, type NameAtlas, type NameCell } from "../../nameAtlas";
import { REEL_HOLD } from "../../recordCanvas";
import { HERO_N, HERO_URLS, HERO_YAW, heroCam, heroLatest, heroSlot } from "../../heroReel";

const HEIGHT = 1.72;
const dummy = new THREE.Object3D();

function fitKnight(scene: THREE.Group, yaw: number) {
  scene.rotation.y = yaw;
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const span = Math.max(0.001, box.max.y - box.min.y);
  scene.scale.setScalar(HEIGHT / span);
  scene.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(scene);
  scene.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) mesh.frustumCulled = false;
  });
  return scene;
}

function HeroCam() {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = heroCam(Math.max(0, clock.elapsedTime - REEL_HOLD));
    persp.fov = shot.fov;
    persp.near = 0.15;
    persp.far = 80;
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

function HeroNames({ names }: { names: string[] }) {
  const labels = useMemo(() => heroLatest(names), [names]);
  const atlas = useMemo<NameAtlas | null>(() => {
    if (!labels.length) return null;
    const items = labels.map((text) => ({ text, commander: false, plain: true, fill: "#ffe14a", frame: true }));
    try {
      return buildNameAtlas(items, true);
    } catch {
      return buildNameAtlas(items);
    }
  }, [labels]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useEffect(() => () => atlas?.dispose(), [atlas]);
  useFrame(({ camera }) => {
    if (!atlas) return;
    dummy.quaternion.copy(camera.quaternion);
    for (let i = 0; i < labels.length; i++) {
      const cell: NameCell | undefined = atlas.cells[i];
      const mesh = cell ? refs.current[cell.sheet] : null;
      if (!cell || !mesh) continue;
      const slot = heroSlot(i);
      const width = 0.96;
      const size = width / Math.max(1.15, cell.sx);
      dummy.position.set(slot.x, 2.04, slot.z);
      dummy.scale.set(cell.sx * size, cell.sy * size, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(cell.local, dummy.matrix);
    }
    for (const mesh of refs.current) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });
  if (!atlas) return null;
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
            renderOrder={20}
          />
        ) : null
      )}
    </group>
  );
}

function HeroLine() {
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
        loaded[index] = fitKnight(gltf.scene, HERO_YAW[index] ?? 0);
        left -= 1;
        if (left > 0) return;
        keep.current = loaded;
        const used = new Array(loaded.length).fill(false);
        const placed: THREE.Object3D[] = [];
        for (let i = 0; i < HERO_N; i++) {
          const model = heroSlot(i).model;
          const src = loaded[model];
          if (!src) continue;
          placed[i] = used[model] ? src.clone(true) : src;
          used[model] = true;
        }
        setBodies(placed);
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
        <HeroStand key={i} index={i} body={body} />
      ))}
    </group>
  );
}

function HeroStand({ index, body }: { index: number; body: THREE.Object3D }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const node = ref.current;
    if (!node) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const slot = heroSlot(index);
    node.position.set(slot.x, Math.sin(t * 1.25 + index * 0.7) * 0.012, slot.z);
  });
  return (
    <group ref={ref}>
      <primitive object={body} />
    </group>
  );
}

export function HeroBattle({ names }: { names: string[] }) {
  return (
    <group>
      <ambientLight intensity={0.62} />
      <directionalLight position={[3.2, 6.4, 5.2]} intensity={2.6} color="#fff2e2" />
      <directionalLight position={[-3.4, 3.2, -2.2]} intensity={0.7} color="#9eb4ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -2.2]} receiveShadow={false}>
        <circleGeometry args={[16, 40]} />
        <meshStandardMaterial color="#2a221b" roughness={0.96} metalness={0} />
      </mesh>
      <HeroLine />
      <HeroNames names={names} />
    </group>
  );
}

export { HeroCam };
