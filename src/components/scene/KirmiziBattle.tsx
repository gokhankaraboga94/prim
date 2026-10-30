import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { simplifySkinned } from "../../knightSoldier";
import {
  KIRMIZI_BLUE,
  KIRMIZI_RED,
  kirmiziCam,
  kirmiziClip,
  kirmiziHp,
  kirmiziMarkReady,
  kirmiziPlace,
  kirmiziReset,
  kirmiziT,
  type KirmiziWho,
} from "../../kirmiziReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

function loadGlb(loader: GLTFLoader, url: string) {
  const buf = preloadedGlb(url);
  return new Promise<Gltf>((ok, fail) => {
    if (buf) loader.parse(buf.slice(0), "", ok, fail);
    else loader.load(url, ok, undefined, fail);
  });
}

function toLambert(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    const next = new THREE.MeshLambertMaterial({
      map: src.map ?? null,
      color: src.color ? src.color.clone() : "#ffffff",
    });
    src.map = null;
    src.normalMap?.dispose();
    src.roughnessMap?.dispose();
    src.metalnessMap?.dispose();
    src.dispose();
    mesh.material = next;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
  });
}

function thin(root: THREE.Object3D, cell: number) {
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const next = simplifySkinned(mesh.geometry, cell);
    mesh.geometry.dispose();
    mesh.geometry = next;
  });
}

function fit(root: THREE.Object3D, height: number) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const span = Math.max(0.001, box.max.y - box.min.y);
  const scale = height / span;
  root.scale.setScalar(scale);
  root.position.set(
    -((box.min.x + box.max.x) / 2) * scale,
    -box.min.y * scale,
    -((box.min.z + box.max.z) / 2) * scale,
  );
}

const HEIGHT = 1.82;

export function KirmiziBattle() {
  const [pair, setPair] = useState<{ blue: THREE.Group; red: THREE.Group } | null>(null);
  const blueRef = useRef<THREE.Group>(null);
  const redRef = useRef<THREE.Group>(null);
  const blueBar = useRef<THREE.Mesh>(null);
  const redBar = useRef<THREE.Mesh>(null);
  const bluePlate = useRef<THREE.Group>(null);
  const redPlate = useRef<THREE.Group>(null);
  const mixers = useRef<Partial<Record<KirmiziWho, THREE.AnimationMixer>>>({});
  const actions = useRef<Partial<Record<KirmiziWho, Record<string, THREE.AnimationAction>>>>({});
  const shown = useRef<Partial<Record<KirmiziWho, string>>>({});

  useEffect(() => {
    let drop = false;
    kirmiziReset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const [blueGltf, redGltf] = await Promise.all([loadGlb(loader, KIRMIZI_BLUE), loadGlb(loader, KIRMIZI_RED)]);
        if (drop) return;
        const mount = (who: KirmiziWho, gltf: Gltf, cell: number) => {
          const model = gltf.scene;
          if (cell > 0) thin(model, cell);
          toLambert(model);
          fit(model, HEIGHT);
          const mix = new THREE.AnimationMixer(model);
          const bag: Record<string, THREE.AnimationAction> = {};
          for (const clip of gltf.animations) {
            const action = mix.clipAction(clip);
            action.loop = THREE.LoopOnce;
            action.clampWhenFinished = true;
            bag[clip.name] = action;
          }
          const first = who === "red" ? "Sword_Attack" : "Attack_Ground_Pound";
          bag[first]?.reset().play();
          mixers.current[who] = mix;
          actions.current[who] = bag;
          shown.current[who] = first;
          return model;
        };
        const blue = mount("blue", blueGltf, 0.004);
        const red = mount("red", redGltf, 0);
        if (!drop) setPair({ blue, red });
      } catch (err) {
        console.warn("kirmizi-mavi", err);
      } finally {
        if (!drop) kirmiziMarkReady();
      }
    })();
    return () => {
      drop = true;
      mixers.current.blue?.stopAllAction();
      mixers.current.red?.stopAllAction();
      mixers.current = {};
      kirmiziReset();
    };
  }, []);

  useFrame(({ camera }) => {
    const t = kirmiziT();
    const pose = (who: KirmiziWho, host: THREE.Group | null, bar: THREE.Mesh | null, plate: THREE.Group | null) => {
      const place = kirmiziPlace(who, t);
      if (host) {
        host.position.set(place.x, 0, place.z);
        host.rotation.set(place.rx, place.yaw, 0);
      }
      const hp = kirmiziHp(who, t);
      if (plate) plate.lookAt(camera.position);
      if (bar) {
        bar.scale.x = Math.max(0.04, hp);
        bar.position.x = -0.72 + 1.44 * hp * 0.5;
      }
      const mix = mixers.current[who];
      const bag = actions.current[who];
      if (!mix || !bag) return;
      const play = kirmiziClip(who, t);
      const action = bag[play.name];
      if (!action) return;
      if (shown.current[who] !== play.name) {
        const prev = bag[shown.current[who] ?? ""];
        prev?.stop();
        action.reset().play();
        shown.current[who] = play.name;
      }
      mix.setTime(play.time);
    };
    pose("blue", blueRef.current, blueBar.current, bluePlate.current);
    pose("red", redRef.current, redBar.current, redPlate.current);
  });

  return (
    <group>
      <hemisphereLight args={["#d7e6f4", "#6a5848", 1.4]} />
      <directionalLight position={[6, 12, 4]} intensity={1.85} color="#fff4e0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshLambertMaterial color="#6a734c" />
      </mesh>
      <group ref={blueRef}>
        {pair && <primitive object={pair.blue} />}
        <group ref={bluePlate} position={[0, 2.15, 0]}>
          <mesh position={[0, 0, -0.02]}>
            <planeGeometry args={[1.6, 0.18]} />
            <meshBasicMaterial color="#1a120e" side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={blueBar}>
            <planeGeometry args={[1.44, 0.1]} />
            <meshBasicMaterial color="#2f6fe0" side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
      <group ref={redRef}>
        {pair && <primitive object={pair.red} />}
        <group ref={redPlate} position={[0, 2.15, 0]}>
          <mesh position={[0, 0, -0.02]}>
            <planeGeometry args={[1.6, 0.18]} />
            <meshBasicMaterial color="#1a120e" side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={redBar}>
            <planeGeometry args={[1.44, 0.1]} />
            <meshBasicMaterial color="#e23b3b" side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function KirmiziCam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = kirmiziCam(kirmiziT());
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
