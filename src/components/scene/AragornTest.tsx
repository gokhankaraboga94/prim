import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import {
  ARAGORN2_URL,
  ARAGORN_RED,
  ARAGORN_URL,
  aragornCam,
  aragornClip,
  aragornMarkReady,
  aragornReset,
  aragornT,
} from "../../aragornTestReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

type Rig = {
  mix: THREE.AnimationMixer;
  shown: string;
  bag: Record<string, THREE.AnimationAction>;
};

type Line = { rigs: Rig[] };

const HEIGHT = 1.82;

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

function fit(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const span = Math.max(0.001, box.max.y - box.min.y);
  const scale = HEIGHT / span;
  root.scale.setScalar(scale);
  root.position.set(
    -((box.min.x + box.max.x) / 2) * scale,
    -box.min.y * scale,
    -((box.min.z + box.max.z) / 2) * scale,
  );
}

function boundTracks(root: THREE.Object3D, clip: THREE.AnimationClip) {
  let hit = 0;
  for (const track of clip.tracks) {
    const name = track.name.split(".")[0];
    if (THREE.PropertyBinding.findNode(root, name)) hit += 1;
  }
  return hit;
}

function mountRig(root: THREE.Object3D, clips: THREE.AnimationClip[], label: string): Rig {
  const mix = new THREE.AnimationMixer(root);
  const bag: Record<string, THREE.AnimationAction> = {};
  let bound = 0;
  for (const clip of clips) {
    bound = Math.max(bound, boundTracks(root, clip));
    const action = mix.clipAction(clip);
    action.loop = THREE.LoopOnce;
    action.clampWhenFinished = true;
    bag[clip.name] = action;
  }
  const first = bag.Sword_Attack ?? Object.values(bag)[0];
  first?.reset().play();
  console.warn(bound > 0 ? `${label} kemik eslesti: ${bound}` : `${label} iskeleti yok, kirmizi klibi baglanamadi`);
  return { mix, shown: first?.getClip().name ?? "", bag };
}

export function AragornTest() {
  const host = useRef<THREE.Group>(null);
  const pack = useRef<Line | null>(null);

  useEffect(() => {
    let drop = false;
    aragornReset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const [hero, hero2, red] = await Promise.all([
          loadGlb(loader, ARAGORN_URL),
          loadGlb(loader, ARAGORN2_URL),
          loadGlb(loader, ARAGORN_RED),
        ]);
        if (drop) return;
        const seats: Array<[Gltf, number, string]> = [
          [hero, -1.75, "aragorn"],
          [hero2, 0, "aragorn2"],
          [red, 1.75, "kirmizi"],
        ];
        const rigs: Rig[] = [];
        for (const [file, x, label] of seats) {
          const model = file.scene;
          toLambert(model);
          fit(model);
          const holder = new THREE.Group();
          holder.position.x = x;
          holder.rotation.y = Math.PI;
          holder.add(model);
          host.current?.add(holder);
          rigs.push(mountRig(model, red.animations, label));
        }
        pack.current = { rigs };
      } catch (err) {
        console.warn("aragorn test", err);
      } finally {
        if (!drop) aragornMarkReady();
      }
    })();
    return () => {
      drop = true;
      for (const rig of pack.current?.rigs ?? []) rig.mix.stopAllAction();
      pack.current = null;
      host.current?.clear();
      aragornReset();
    };
  }, []);

  useFrame(() => {
    const live = pack.current;
    if (!live) return;
    const play = aragornClip(aragornT());
    for (const rig of live.rigs) {
      const action = rig.bag[play.name];
      if (action && rig.shown !== play.name) {
        rig.bag[rig.shown]?.stop();
        action.reset().play();
        rig.shown = play.name;
      }
      if (action) rig.mix.setTime(Math.min(action.getClip().duration - 0.001, play.time));
    }
  });

  return (
    <group>
      <hemisphereLight args={["#d7e6f4", "#6a5848", 1.4]} />
      <directionalLight position={[4, 12, -6]} intensity={1.7} color="#fff4e0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshLambertMaterial color="#6a734c" />
      </mesh>
      <group ref={host} />
    </group>
  );
}

export function AragornCam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = aragornCam();
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
