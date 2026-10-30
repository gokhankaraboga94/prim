import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { simplifySkinned } from "../../knightSoldier";
import { buildNameAtlas } from "../../nameAtlas";
import {
  BASKA_N,
  BASKA_URL,
  baskaCam,
  baskaMarkReady,
  baskaPose,
  baskaReset,
  baskaRoster,
  baskaT,
} from "../../baskaReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

type Man = {
  i: number;
  host: THREE.Group;
  mix: THREE.AnimationMixer;
};

const HEIGHT = 1.82;
const dummy = new THREE.Object3D();

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

function thin(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const next = simplifySkinned(mesh.geometry, 0.01);
    mesh.geometry.dispose();
    mesh.geometry = next;
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

export function BaskaBattle({ names }: { names: string[] }) {
  const host = useRef<THREE.Group>(null);
  const pack = useRef<Man[]>([]);
  const roster = useMemo(() => baskaRoster(names), [names]);
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
    for (const sheet of atlas.sheets) sheet.material.depthTest = false;
    return () => atlas.dispose();
  }, [atlas]);

  useEffect(() => {
    let drop = false;
    baskaReset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const gltf = await loadGlb(loader, BASKA_URL);
        if (drop) return;
        const model = gltf.scene;
        thin(model);
        toLambert(model);
        fit(model);
        const root = host.current;
        const men: Man[] = [];
        for (let i = 0; i < BASKA_N; i++) {
          const body = i === 0 ? model : cloneSkinned(model);
          const holder = new THREE.Group();
          holder.add(body);
          const mix = new THREE.AnimationMixer(body);
          const clip = gltf.animations.find((item) => item.name === "Attack_Ground_Pound") ?? gltf.animations[0];
          if (clip) {
            const action = mix.clipAction(clip);
            action.loop = THREE.LoopOnce;
            action.clampWhenFinished = true;
            action.reset().play();
          }
          root?.add(holder);
          men.push({ i, host: holder, mix });
        }
        if (drop) return;
        pack.current = men;
      } catch (err) {
        console.warn("baska", err);
      } finally {
        if (!drop) baskaMarkReady();
      }
    })();
    return () => {
      drop = true;
      for (const man of pack.current) man.mix.stopAllAction();
      pack.current = [];
      host.current?.clear();
      baskaReset();
    };
  }, []);

  useFrame(({ camera }) => {
    const t = baskaT();
    for (const man of pack.current) {
      const pose = baskaPose(man.i, t);
      man.host.position.set(pose.x, 0, pose.z);
      man.host.rotation.set(pose.rx, pose.yaw, 0);
      man.mix.setTime(pose.time);
    }
    const high = camera.position.y > 4;
    for (const sheet of atlas.sheets) {
      const inst = sheet.geometry.userData.mesh as THREE.InstancedMesh | undefined;
      if (!inst) continue;
      for (let n = 0; n < named.length; n++) {
        const cell = atlas.cells[n];
        if (!cell || cell.sheet !== atlas.sheets.indexOf(sheet)) continue;
        const pose = baskaPose(named[n].i, t);
        const up = !pose.dead;
        const dx = pose.x - camera.position.x;
        const dy = 2.4 - camera.position.y;
        const dz = pose.z - camera.position.z;
        const dist = Math.hypot(dx, dy, dz);
        const base = high ? Math.min(1.6, Math.max(1.05, dist * 0.05)) : Math.min(0.72, 0.28 + dist * 0.04);
        const w = up ? base * 1.7 : 0.001;
        const h = (cell.sy * w) / Math.max(cell.sx, 0.01);
        dummy.position.set(pose.x, up ? (high ? 2.85 : 2.25) : -12, pose.z);
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
      <directionalLight position={[6, 14, -4]} intensity={1.8} color="#fff4e0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshLambertMaterial color="#6a734c" />
      </mesh>
      <group ref={host} />
      {atlas.sheets.map((sheet, s) => (
        <instancedMesh
          key={s}
          args={[sheet.geometry, sheet.material, Math.max(1, sheet.count)]}
          frustumCulled={false}
          renderOrder={20}
          ref={(node) => {
            sheet.geometry.userData.mesh = node;
          }}
        />
      ))}
    </group>
  );
}

export function BaskaCam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = baskaCam(baskaT());
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
