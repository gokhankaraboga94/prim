import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { buildNameAtlas } from "../../nameAtlas";
import { buildKnightSoldier } from "../../knightSoldier";
import {
  BASKA_URL,
  baskaArmyCount,
  baskaCam,
  baskaLeaver,
  baskaMan,
  baskaMarkReady,
  baskaNames,
  baskaReset,
  baskaRoster,
  baskaT,
} from "../../baskaReel";

const dummy = new THREE.Object3D();

export function BaskaBattle({ names }: { names: string[] }) {
  const host = useRef<THREE.Group>(null);
  const pack = useRef<{ men: THREE.Group[]; leaver: THREE.Group | null }>({ men: [], leaver: null });
  const nameText = useMemo(() => baskaRoster(names), [names]);
  const atlas = useMemo(
    () =>
      buildNameAtlas(
        nameText ? [{ text: nameText, commander: false, plain: false, fill: "#111111", frame: true, plate: "rgba(255,255,255,0.58)" }] : [],
        true,
        false,
      ),
    [nameText],
  );

  useEffect(() => {
    for (const sheet of atlas.sheets) sheet.material.depthTest = true;
    return () => atlas.dispose();
  }, [atlas]);

  useEffect(() => {
    let drop = false;
    baskaReset();
    const loader = new GLTFLoader();
    const buf = preloadedGlb(BASKA_URL);
    const take = (gltf: { scene: THREE.Group }) => {
      if (drop) return;
      const geo = buildKnightSoldier(gltf.scene);
      const bodyMat = new THREE.MeshLambertMaterial({ color: "#1a56e8" });
      const helmMat = new THREE.MeshLambertMaterial({ color: "#e7eef5" });
      const root = host.current;
      const make = () => {
        const group = new THREE.Group();
        const body = new THREE.Mesh(geo.body, bodyMat);
        const helm = new THREE.Mesh(geo.helm, helmMat);
        body.castShadow = false;
        helm.castShadow = false;
        body.frustumCulled = false;
        helm.frustumCulled = false;
        group.add(body, helm);
        return group;
      };
      const army: THREE.Group[] = [];
      for (let i = 0; i < baskaArmyCount(); i++) {
        const group = make();
        root?.add(group);
        army.push(group);
      }
      const one = make();
      root?.add(one);
      pack.current.men = army;
      pack.current.leaver = one;
      baskaMarkReady();
    };
    if (buf) loader.parse(buf.slice(0), "", take, () => baskaMarkReady());
    else loader.load(BASKA_URL, take, undefined, () => baskaMarkReady());
    return () => {
      drop = true;
      pack.current.men = [];
      pack.current.leaver = null;
      host.current?.clear();
      baskaReset();
    };
  }, []);

  useFrame(({ camera }) => {
    const t = baskaT();
    pack.current.men.forEach((group, i) => {
      const pose = baskaMan(i, t);
      group.position.set(pose.x, 0, pose.z);
      group.rotation.set(0, pose.yaw, 0);
    });
    const man = baskaLeaver(t);
    const one = pack.current.leaver;
    if (one) {
      one.position.set(man.x, 0, man.z);
      one.rotation.set(0, man.yaw, 0);
    }
    const show = Boolean(nameText) && baskaNames(t);
    for (const sheet of atlas.sheets) {
      const inst = sheet.geometry.userData.mesh as THREE.InstancedMesh | undefined;
      if (!inst) continue;
      const cell = atlas.cells[0];
      if (!cell) continue;
      const dx = man.x - camera.position.x;
      const dy = 2.2 - camera.position.y;
      const dz = man.z - camera.position.z;
      const dist = Math.hypot(dx, dy, dz);
      const base = Math.min(0.7, 0.2 + dist * 0.03);
      const w = show ? base * 1.45 : 0.001;
      const h = (cell.sy * w) / Math.max(cell.sx, 0.01);
      dummy.position.set(man.x, show ? 2.15 : -12, man.z);
      dummy.quaternion.copy(camera.quaternion);
      dummy.scale.set(w, show ? h : 0.001, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(cell.local, dummy.matrix);
      inst.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <hemisphereLight args={["#d7e6f4", "#6a5848", 1.35]} />
      <directionalLight position={[8, 16, 4]} intensity={1.7} color="#fff4e0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1]}>
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
