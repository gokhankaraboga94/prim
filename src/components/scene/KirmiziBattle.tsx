import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { simplifySkinned } from "../../knightSoldier";
import { buildNameAtlas } from "../../nameAtlas";
import {
  BLUE_N,
  KIRMIZI_BLUE,
  KIRMIZI_RED,
  RED_N,
  kirmiziCam,
  kirmiziMarkReady,
  kirmiziNames,
  kirmiziPose,
  kirmiziReset,
  kirmiziRoster,
  kirmiziT,
  type KirmiziWho,
} from "../../kirmiziReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

type Man = {
  who: KirmiziWho;
  i: number;
  host: THREE.Group;
  mix: THREE.AnimationMixer;
  bag: Record<string, THREE.AnimationAction>;
  shown: string;
};

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

function spawn(who: KirmiziWho, proto: THREE.Object3D, gltf: Gltf, count: number) {
  const men: Man[] = [];
  for (let i = 0; i < count; i++) {
    const model = i === 0 ? proto : cloneSkinned(proto);
    const host = new THREE.Group();
    host.add(model);
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
    men.push({ who, i, host, mix, bag, shown: first });
  }
  return men;
}

const HEIGHT = 1.82;
const dummy = new THREE.Object3D();

export function KirmiziBattle({ names }: { names: string[] }) {
  const host = useRef<THREE.Group>(null);
  const men = useRef<Man[]>([]);
  const roster = useMemo(() => kirmiziRoster(names), [names]);
  const named = useMemo(() => roster.map((name, i) => ({ name, i })).filter((row) => row.name), [roster]);
  const atlas = useMemo(
    () =>
      buildNameAtlas(
        named.map((row) => ({ text: row.name, commander: false, plain: false, fill: "#111111", frame: true, plate: "rgba(255,255,255,0.58)" })),
        true,
        false,
      ),
    [named],
  );

  useEffect(() => {
    for (const sheet of atlas.sheets) sheet.material.depthTest = true;
    return () => atlas.dispose();
  }, [atlas]);

  useEffect(() => {
    let drop = false;
    kirmiziReset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const [blueGltf, redGltf] = await Promise.all([loadGlb(loader, KIRMIZI_BLUE), loadGlb(loader, KIRMIZI_RED)]);
        if (drop) return;
        const prep = (gltf: Gltf, cell: number) => {
          const model = gltf.scene;
          if (cell > 0) thin(model, cell);
          toLambert(model);
          fit(model, HEIGHT);
          return model;
        };
        const blues = spawn("blue", prep(blueGltf, 0.01), blueGltf, BLUE_N);
        const reds = spawn("red", prep(redGltf, 0.012), redGltf, RED_N);
        if (drop) return;
        const root = host.current;
        const army = [...blues, ...reds];
        for (const man of army) root?.add(man.host);
        men.current = army;
      } catch (err) {
        console.warn("kirmizi-mavi", err);
      } finally {
        if (!drop) kirmiziMarkReady();
      }
    })();
    return () => {
      drop = true;
      for (const man of men.current) man.mix.stopAllAction();
      men.current = [];
      host.current?.clear();
      kirmiziReset();
    };
  }, []);

  useFrame(({ camera }) => {
    const t = kirmiziT();
    for (const man of men.current) {
      const pose = kirmiziPose(man.who, man.i, t);
      man.host.position.set(pose.x, 0, pose.z);
      man.host.rotation.set(pose.rx, pose.yaw, 0);
      const action = man.bag[pose.clip];
      if (!action) continue;
      if (man.shown !== pose.clip) {
        man.bag[man.shown]?.stop();
        action.reset().play();
        man.shown = pose.clip;
      }
      man.mix.setTime(pose.time);
    }
    const show = kirmiziNames(t);
    const high = camera.position.y > 8;
    for (const sheet of atlas.sheets) {
      const inst = sheet.geometry.userData.mesh as THREE.InstancedMesh | undefined;
      if (!inst) continue;
      for (let n = 0; n < named.length; n++) {
        const cell = atlas.cells[n];
        if (!cell || cell.sheet !== atlas.sheets.indexOf(sheet)) continue;
        const pose = kirmiziPose("blue", named[n].i, t);
        const up = show && !pose.dead;
        const dx = pose.x - camera.position.x;
        const dy = 2.3 - camera.position.y;
        const dz = pose.z - camera.position.z;
        const dist = Math.hypot(dx, dy, dz);
        const base = high ? Math.min(1.45, Math.max(0.9, dist * 0.028)) : Math.min(0.62, 0.18 + dist * 0.032);
        const w = up ? base * 1.45 : 0.001;
        const h = (cell.sy * w) / Math.max(cell.sx, 0.01);
        dummy.position.set(pose.x, up ? (high ? 2.65 : 2.15) : -12, pose.z);
        dummy.quaternion.copy(camera.quaternion);
        dummy.scale.set(w, up ? h : 0.001, 1);
        dummy.updateMatrix();
        inst.setMatrixAt(cell.local, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <hemisphereLight args={["#d7e6f4", "#6a5848", 1.4]} />
      <directionalLight position={[8, 18, 6]} intensity={1.85} color="#fff4e0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshLambertMaterial color="#6a734c" />
      </mesh>
      <group ref={host} />
      {atlas.sheets.map((sheet, s) => (
        <instancedMesh
          key={s}
          args={[sheet.geometry, sheet.material, Math.max(1, sheet.count)]}
          frustumCulled={false}
          ref={(node) => {
            sheet.geometry.userData.mesh = node;
          }}
        />
      ))}
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
