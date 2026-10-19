import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { buildNameAtlas, type NameAtlas, type NameCell } from "../../nameAtlas";
import { REEL_HOLD } from "../../recordCanvas";
import { HERO_N, HERO_URLS, HERO_YAW, heroCam, heroNameIndex, heroRoster, heroSlot } from "../../heroReel";

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
    persp.far = 220;
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

function HeroNames({ names }: { names: string[] }) {
  const labels = useMemo(() => heroRoster(names), [names]);
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
  useFrame(({ camera, clock }) => {
    if (!atlas) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    dummy.quaternion.copy(camera.quaternion);
    dummy.position.set(0, -30, 0);
    dummy.scale.set(0, 0, 1);
    dummy.updateMatrix();
    for (let i = 0; i < labels.length; i++) {
      const cell: NameCell | undefined = atlas.cells[i];
      const mesh = cell ? refs.current[cell.sheet] : null;
      if (!cell || !mesh) continue;
      mesh.setMatrixAt(cell.local, dummy.matrix);
    }
    for (let h = 0; h < HERO_N; h++) {
      const idx = heroNameIndex(h, t, labels.length);
      const cell: NameCell | undefined = idx >= 0 ? atlas.cells[idx] : undefined;
      const mesh = cell ? refs.current[cell.sheet] : null;
      if (!cell || !mesh) continue;
      const slot = heroSlot(h);
      const width = 1.05;
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
        const placed: THREE.Object3D[] = [];
        for (let i = 0; i < HERO_N; i++) {
          const src = loaded[heroSlot(i).model];
          if (src) placed[i] = src;
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
  useFrame(({ camera, clock }) => {
    const node = ref.current;
    if (!node) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const slot = heroSlot(index);
    node.position.set(slot.x, Math.sin(t * 1.25 + index * 0.7) * 0.012, slot.z);
    node.rotation.y = Math.atan2(camera.position.x - slot.x, camera.position.z - slot.z);
  });
  return (
    <group ref={ref}>
      <primitive object={body} />
    </group>
  );
}

function HeroSky() {
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
            vec3 zenith = vec3(0.20, 0.46, 0.90);
            vec3 horizon = vec3(0.69, 0.84, 0.96);
            vec3 col = mix(horizon, zenith, smoothstep(-0.05, 0.62, h));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    []
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} frustumCulled={false}>
      <sphereGeometry args={[90, 20, 12]} />
    </mesh>
  );
}

export function HeroBattle({ names }: { names: string[] }) {
  return (
    <group>
      <HeroSky />
      <hemisphereLight args={["#d7e8ff", "#6a8a48", 0.85]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4.2, 8.2, 6.4]} intensity={2.4} color="#fff4e4" />
      <directionalLight position={[-4.2, 3.4, -3]} intensity={0.55} color="#9eb6ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#4f9a3c" roughness={0.96} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0.2]}>
        <circleGeometry args={[8.4, 48]} />
        <meshStandardMaterial color="#c9a56a" roughness={0.9} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.008, 0.2]}>
        <ringGeometry args={[7.55, 8.15, 48]} />
        <meshStandardMaterial color="#8d6a3e" roughness={0.92} metalness={0} />
      </mesh>
      <HeroLine />
      <HeroNames names={names} />
    </group>
  );
}

export { HeroCam };
