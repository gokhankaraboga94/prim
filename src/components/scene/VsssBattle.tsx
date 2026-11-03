import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { VSSS_HEIGHT, VSSS_HULK, VSSS_KING, vsssCam, vsssMarkReady, vsssPose, vsssReset, vsssT } from "../../vsssReel";

const GAP = 0.78;

function toLambert(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    mesh.material = new THREE.MeshLambertMaterial({
      map: src.map ?? null,
      color: src.color ? src.color.clone() : new THREE.Color("#ffffff"),
    });
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
  });
}

function fit(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const span = Math.max(0.001, box.max.y - box.min.y);
  const scale = VSSS_HEIGHT / span;
  root.scale.setScalar(scale);
  root.position.set(-((box.min.x + box.max.x) / 2) * scale, -box.min.y * scale, -((box.min.z + box.max.z) / 2) * scale);
}

function park(clip: THREE.AnimationClip) {
  const next = clip.clone();
  next.tracks = clip.tracks.filter((track) => !track.name.endsWith("Hips.position"));
  return next;
}

export function VsssBattle() {
  const host = useRef<THREE.Group>(null);
  const mixers = useRef<{ king: THREE.AnimationMixer; hulk: THREE.AnimationMixer } | null>(null);
  const bags = useRef<{ king: Record<string, THREE.AnimationAction>; hulk: Record<string, THREE.AnimationAction> } | null>(null);
  const shown = useRef<{ king: string; hulk: string }>({ king: "", hulk: "" });

  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    vsssReset();
    const load = (url: string) =>
      new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((ok, fail) => {
        loader.load(url, (gltf) => ok({ scene: gltf.scene, animations: gltf.animations }), undefined, fail);
      });
    void Promise.all([load(VSSS_KING), load(VSSS_HULK)])
      .then(([kingFile, hulkFile]) => {
        const root = host.current;
        if (drop || !root) return;
        const make = (file: { scene: THREE.Group; animations: THREE.AnimationClip[] }, z: number, yaw: number) => {
          const model = file.scene;
          toLambert(model);
          fit(model);
          const holder = new THREE.Group();
          holder.position.set(0, 0, z);
          holder.rotation.y = yaw;
          holder.add(model);
          root.add(holder);
          const mixer = new THREE.AnimationMixer(model);
          const bag: Record<string, THREE.AnimationAction> = {};
          for (const src of file.animations) {
            if (src.name.startsWith("run") || src.name === "walk.001") continue;
            const action = mixer.clipAction(park(src));
            action.loop = THREE.LoopOnce;
            action.clampWhenFinished = true;
            bag[src.name] = action;
          }
          return { mixer, bag };
        };
        const king = make(kingFile, -GAP, 0);
        const hulk = make(hulkFile, GAP, Math.PI);
        mixers.current = { king: king.mixer, hulk: hulk.mixer };
        bags.current = { king: king.bag, hulk: hulk.bag };
        vsssMarkReady();
      })
      .catch(() => {
        if (!drop) console.warn("vsss modelleri yuklenemedi");
      });
    return () => {
      drop = true;
      mixers.current?.king.stopAllAction();
      mixers.current?.hulk.stopAllAction();
      mixers.current = null;
      const root = host.current;
      root?.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) mat.dispose();
      });
      root?.clear();
    };
  }, []);

  useFrame(() => {
    const mix = mixers.current;
    const bag = bags.current;
    if (!mix || !bag) return;
    const t = vsssT();
    for (const who of ["king", "hulk"] as const) {
      const play = vsssPose(who, t);
      const action = bag[who][play.name];
      if (!action) continue;
      if (shown.current[who] !== play.name) {
        if (shown.current[who]) bag[who][shown.current[who]]?.stop();
        action.reset().play();
        shown.current[who] = play.name;
      }
      mix[who].setTime(play.time);
    }
  });

  return (
    <group>
      <hemisphereLight args={["#d5d8de", "#1a1a1a", 1.15]} />
      <directionalLight position={[3, 8, 4]} intensity={1.8} color="#fff4e4" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <group ref={host} />
    </group>
  );
}

export function VsssCam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = vsssCam(vsssT());
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
