import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { buildNameAtlas } from "../../nameAtlas";
import { buildKnightSoldier, simplifySkinned } from "../../knightSoldier";
import {
  SAVAS_BLUE,
  SAVAS_KNIGHT,
  SAVAS_OURS,
  SAVAS_VOLLEY,
  savasBolt,
  savasCam,
  savasFriend,
  savasHideHp,
  savasHp,
  savasMarkReady,
  savasNames,
  savasReset,
  savasRoster,
  savasT,
  savasZ,
  type SavasShot,
} from "../../savasReel";

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

function seatFeet(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (Number.isFinite(box.min.y)) root.position.y -= box.min.y;
}

function thinBlue(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const next = simplifySkinned(mesh.geometry, 0.0035);
    mesh.geometry.dispose();
    mesh.geometry = next;
  });
}

function fitBlue(root: THREE.Object3D) {
  thinBlue(root);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const span = Math.max(0.001, box.max.y - box.min.y);
  const fit = 8.4 / span;
  root.scale.setScalar(fit);
  root.position.set(
    -((box.min.x + box.max.x) / 2) * fit,
    -box.min.y * fit,
    -((box.min.z + box.max.z) / 2) * fit,
  );
  toLambert(root);
  seatFeet(root);
}

function spearGeo() {
  const shaft = new THREE.CylinderGeometry(0.045, 0.03, 2.3, 5);
  shaft.translate(0, 0.15, 0);
  const head = new THREE.ConeGeometry(0.1, 0.36, 5);
  head.translate(0, 1.4, 0);
  return mergeGeometries([shaft, head]) ?? shaft;
}

const dummy = new THREE.Object3D();
const boltTmp: SavasShot = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
const up = new THREE.Vector3(0, 1, 0);
const dir = new THREE.Vector3();
const liveTint = new THREE.Color("#ffffff");
const CLIP = "Attack_Ground_Pound";

export function SavasBattle({ names }: { names: string[] }) {
  const [pack, setPack] = useState<{ body: THREE.BufferGeometry; helm: THREE.BufferGeometry; blue: THREE.Group } | null>(null);
  const roster = useMemo(() => savasRoster(names), [names]);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const helms = useRef<THREE.InstancedMesh>(null);
  const spears = useRef<THREE.InstancedMesh>(null);
  const hostRef = useRef<THREE.Group>(null);
  const bar = useRef<THREE.Mesh>(null);
  const plate = useRef<THREE.Group>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const spearMesh = useMemo(() => spearGeo(), []);
  const named = useMemo(
    () => roster.map((name, i) => ({ name, i })).filter((row) => row.name),
    [roster],
  );
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
    let drop = false;
    savasReset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const knightGltf = await loadGlb(loader, SAVAS_KNIGHT);
        const blueGltf = await loadGlb(loader, SAVAS_BLUE);
        if (drop) return;
        const knight = buildKnightSoldier(knightGltf.scene);
        fitBlue(blueGltf.scene);
        if (drop) return;
        const clip = blueGltf.animations.find((item) => item.name === CLIP) ?? blueGltf.animations[0];
        const mix = new THREE.AnimationMixer(blueGltf.scene);
        if (clip) {
          const action = mix.clipAction(clip);
          action.loop = THREE.LoopRepeat;
          action.clampWhenFinished = false;
          action.play();
        }
        mixer.current = mix;
        setPack({ body: knight.body, helm: knight.helm, blue: blueGltf.scene });
      } catch (err) {
        console.warn("savas", err);
      } finally {
        if (!drop) savasMarkReady();
      }
    })();
    return () => {
      drop = true;
      mixer.current?.stopAllAction();
      mixer.current = null;
      savasReset();
    };
  }, []);

  useEffect(() => {
    for (const sheet of atlas.sheets) sheet.material.depthTest = true;
    return () => atlas.dispose();
  }, [atlas]);

  useFrame(({ camera }) => {
    if (!pack) return;
    const t = savasT();
    const body = bodies.current;
    const helm = helms.current;
    if (body && helm) {
      for (let i = 0; i < SAVAS_OURS; i++) {
        const seat = savasFriend(i);
        dummy.position.set(seat.x, 0, seat.z);
        dummy.rotation.set(0, seat.yaw, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        body.setMatrixAt(i, dummy.matrix);
        helm.setMatrixAt(i, dummy.matrix);
        body.setColorAt(i, liveTint);
        helm.setColorAt(i, liveTint);
      }
      body.instanceMatrix.needsUpdate = true;
      helm.instanceMatrix.needsUpdate = true;
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
      if (helm.instanceColor) helm.instanceColor.needsUpdate = true;
    }
    const host = hostRef.current;
    if (host) {
      host.position.set(0, 0, savasZ(t));
      host.rotation.set(0, Math.PI, 0);
    }
    mixer.current?.setTime(t % 2.708333);
    const hp = savasHp(t);
    const hideHp = savasHideHp(t);
    if (plate.current) {
      plate.current.visible = !hideHp;
      plate.current.lookAt(camera.position);
    }
    if (bar.current) {
      bar.current.scale.x = Math.max(0.04, hp);
      bar.current.position.x = -1.55 + 3.1 * hp * 0.5;
    }
    const spearsInst = spears.current;
    if (spearsInst) {
      let ns = 0;
      for (const volley of SAVAS_VOLLEY) {
        if (ns >= 8) break;
        if (!savasBolt(volley, t, boltTmp)) continue;
        dir.set(boltTmp.dx, boltTmp.dy, boltTmp.dz);
        if (dir.lengthSq() < 1e-8) continue;
        dummy.position.set(boltTmp.x, boltTmp.y, boltTmp.z);
        dummy.quaternion.setFromUnitVectors(up, dir.normalize());
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        spearsInst.setMatrixAt(ns, dummy.matrix);
        ns += 1;
      }
      spearsInst.count = ns;
      spearsInst.instanceMatrix.needsUpdate = true;
    }
    const show = savasNames(t);
    for (const sheet of atlas.sheets) {
      const inst = sheet.geometry.userData.mesh as THREE.InstancedMesh | undefined;
      if (!inst) continue;
      for (let n = 0; n < named.length; n++) {
        const cell = atlas.cells[n];
        if (!cell || cell.sheet !== atlas.sheets.indexOf(sheet)) continue;
        const seat = savasFriend(named[n].i);
        const dx = seat.x - camera.position.x;
        const dy = 2.4 - camera.position.y;
        const dz = seat.z - camera.position.z;
        const dist = Math.hypot(dx, dy, dz);
        const high = camera.position.y > 6;
        const base = high ? Math.min(1.35, Math.max(0.95, dist * 0.03)) : Math.min(0.58, 0.16 + dist * 0.035);
        const w = show ? base * 1.5 : 0.001;
        const h = (cell.sy * w) / Math.max(cell.sx, 0.01);
        dummy.position.set(seat.x, show ? (high ? 2.55 : 2.05) : -8, seat.z);
        dummy.quaternion.copy(camera.quaternion);
        dummy.scale.set(show ? w : 0.001, show ? h : 0.001, 1);
        dummy.updateMatrix();
        inst.setMatrixAt(cell.local, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  });

  if (!pack) return null;

  return (
    <group>
      <hemisphereLight args={["#d7e6f4", "#6a6248", 1.45]} />
      <directionalLight position={[8, 24, -16]} intensity={1.9} color="#fff4e0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[160, 160]} />
        <meshLambertMaterial color="#66724e" />
      </mesh>
      <group ref={hostRef}>
        <primitive object={pack.blue} />
        <group ref={plate} position={[0, 9.15, 0.15]} scale={1.15}>
          <mesh position={[0, 0, -0.02]}>
            <planeGeometry args={[3.4, 0.42]} />
            <meshBasicMaterial color="#1a120e" side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={bar} position={[0, 0, 0]}>
            <planeGeometry args={[3.1, 0.26]} />
            <meshBasicMaterial color="#e23b3b" side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
      <instancedMesh ref={bodies} args={[pack.body, undefined, SAVAS_OURS]} frustumCulled={false}>
        <meshLambertMaterial color="#1a56e8" />
      </instancedMesh>
      <instancedMesh ref={helms} args={[pack.helm, undefined, SAVAS_OURS]} frustumCulled={false}>
        <meshLambertMaterial color="#e7eef5" />
      </instancedMesh>
      <instancedMesh ref={spears} args={[spearMesh, undefined, 8]} frustumCulled={false} count={0}>
        <meshBasicMaterial color="#e6d2a8" />
      </instancedMesh>
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

export function SavasCam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = savasCam(savasT());
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
