import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { buildNameAtlas } from "../../nameAtlas";
import { buildKnightSoldier } from "../../knightSoldier";
import {
  DEVKONG_KONG,
  DEVKONG_KNIGHT,
  DEVKONG_OURS,
  DEVKONG_VOLLEY,
  devFriend,
  devKongBolt,
  devKongCam,
  devKongHideHp,
  devKongHp,
  devKongMarkReady,
  devKongNames,
  devKongReset,
  devKongRoster,
  devKongT,
  devKongZ,
  type DevKongShot,
} from "../../devKongReel";

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

function cutPlinth(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry;
    const pos = geo.getAttribute("position");
    if (!pos || pos.count < 12) return;
    if (!geo.getIndex()) geo.setIndex(Array.from({ length: pos.count }, (_, i) => i));
    const index = geo.getIndex();
    if (!index) return;
    let minY = Infinity;
    let maxY = -Infinity;
    let xa = Infinity;
    let xb = -Infinity;
    let za = Infinity;
    let zb = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      xa = Math.min(xa, pos.getX(i));
      xb = Math.max(xb, pos.getX(i));
      za = Math.min(za, pos.getZ(i));
      zb = Math.max(zb, pos.getZ(i));
    }
    const h = maxY - minY;
    if (h < 1e-4) return;
    if (xb - xa > h * 1.8 && zb - za > h * 1.8) {
      mesh.visible = false;
      return;
    }
    const cut = minY + h * 0.36;
    let low = 0;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > cut) continue;
      low += 1;
      x0 = Math.min(x0, pos.getX(i));
      x1 = Math.max(x1, pos.getX(i));
      z0 = Math.min(z0, pos.getZ(i));
      z1 = Math.max(z1, pos.getZ(i));
    }
    if (low < 12 || Math.max(x1 - x0, z1 - z0) < h * 0.22) return;
    const src = index.array;
    const kept: number[] = [];
    for (let i = 0; i < src.length; i += 3) {
      const a = src[i];
      const b = src[i + 1];
      const c = src[i + 2];
      if (Math.max(pos.getY(a), pos.getY(b), pos.getY(c)) <= cut) continue;
      kept.push(a, b, c);
    }
    if (kept.length === src.length || kept.length === 0) {
      if (kept.length === 0) mesh.visible = false;
      return;
    }
    geo.setIndex(kept);
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
  });
}

function seatFeet(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (Number.isFinite(box.min.y)) root.position.y -= box.min.y;
}

function fitKong(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const span = Math.max(0.001, box.max.y - box.min.y);
  const fit = 15.6 / span;
  root.scale.setScalar(fit);
  root.position.set(
    -((box.min.x + box.max.x) / 2) * fit,
    -box.min.y * fit,
    -((box.min.z + box.max.z) / 2) * fit,
  );
  toLambert(root);
  cutPlinth(root);
  seatFeet(root);
}

function boltGeo(spear: boolean) {
  const shaft = spear
    ? new THREE.CylinderGeometry(0.045, 0.03, 2.3, 5)
    : new THREE.CylinderGeometry(0.028, 0.018, 2.05, 4);
  shaft.translate(0, spear ? 0.15 : 0.1, 0);
  const head = spear
    ? new THREE.ConeGeometry(0.1, 0.36, 5)
    : new THREE.ConeGeometry(0.035, 0.22, 4);
  head.translate(0, spear ? 1.4 : 0.95, 0);
  return mergeGeometries([shaft, head]) ?? shaft;
}

const dummy = new THREE.Object3D();
const boltTmp: DevKongShot = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
const up = new THREE.Vector3(0, 1, 0);
const dir = new THREE.Vector3();
const liveTint = new THREE.Color("#ffffff");

export function DevKongBattle({ names }: { names: string[] }) {
  const [pack, setPack] = useState<{ body: THREE.BufferGeometry; helm: THREE.BufferGeometry; kong: THREE.Group } | null>(null);
  const roster = useMemo(() => devKongRoster(names), [names]);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const helms = useRef<THREE.InstancedMesh>(null);
  const spears = useRef<THREE.InstancedMesh>(null);
  const arrows = useRef<THREE.InstancedMesh>(null);
  const kongRef = useRef<THREE.Group>(null);
  const bar = useRef<THREE.Mesh>(null);
  const plate = useRef<THREE.Group>(null);
  const spearMesh = useMemo(() => boltGeo(true), []);
  const arrowMesh = useMemo(() => boltGeo(false), []);
  const named = useMemo(
    () => roster.map((name, i) => ({ name, i })).filter((row) => row.name),
    [roster],
  );
  const atlas = useMemo(
    () =>
      buildNameAtlas(
        named.map((row) => ({ text: row.name, commander: false, plain: false, fill: "#ffe14a", frame: true })),
        true,
        true,
      ),
    [named],
  );

  useEffect(() => {
    let drop = false;
    devKongReset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const knightGltf = await loadGlb(loader, DEVKONG_KNIGHT);
        const kongGltf = await loadGlb(loader, DEVKONG_KONG);
        if (drop) return;
        const knight = buildKnightSoldier(knightGltf.scene);
        fitKong(kongGltf.scene);
        if (drop) return;
        setPack({ body: knight.body, helm: knight.helm, kong: kongGltf.scene });
      } catch (err) {
        console.warn("dev-kong", err);
      } finally {
        if (!drop) devKongMarkReady();
      }
    })();
    return () => {
      drop = true;
      devKongReset();
    };
  }, []);

  useEffect(() => {
    for (const sheet of atlas.sheets) sheet.material.depthTest = true;
    return () => atlas.dispose();
  }, [atlas]);

  useFrame(({ camera }) => {
    if (!pack) return;
    const t = devKongT();
    const body = bodies.current;
    const helm = helms.current;
    if (body && helm) {
      for (let i = 0; i < DEVKONG_OURS; i++) {
        const seat = devFriend(i);
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
    const host = kongRef.current;
    if (host) {
      host.position.set(0, 0, devKongZ(t));
      host.rotation.set(0, Math.PI, 0);
    }
    const hp = devKongHp(t);
    const hideHp = devKongHideHp(t);
    if (plate.current) {
      plate.current.visible = !hideHp;
      plate.current.lookAt(camera.position);
    }
    if (bar.current) {
      bar.current.scale.x = Math.max(0.04, hp);
      bar.current.position.x = -2.35 + 4.7 * hp * 0.5;
    }
    const spearMeshInst = spears.current;
    const arrowMeshInst = arrows.current;
    if (spearMeshInst && arrowMeshInst) {
      let ns = 0;
      let na = 0;
      for (const volley of DEVKONG_VOLLEY) {
        if (ns >= 8 && na >= 8) break;
        if (!devKongBolt(volley, t, boltTmp)) continue;
        dir.set(boltTmp.dx, boltTmp.dy, boltTmp.dz);
        if (dir.lengthSq() < 1e-8) continue;
        dummy.position.set(boltTmp.x, boltTmp.y, boltTmp.z);
        dummy.quaternion.setFromUnitVectors(up, dir.normalize());
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        if (volley.spear) {
          if (ns >= 8) continue;
          spearMeshInst.setMatrixAt(ns, dummy.matrix);
          ns += 1;
        } else {
          if (na >= 8) continue;
          arrowMeshInst.setMatrixAt(na, dummy.matrix);
          na += 1;
        }
      }
      spearMeshInst.count = ns;
      arrowMeshInst.count = na;
      spearMeshInst.instanceMatrix.needsUpdate = true;
      arrowMeshInst.instanceMatrix.needsUpdate = true;
    }
    const show = devKongNames(t);
    for (const sheet of atlas.sheets) {
      const inst = sheet.geometry.userData.mesh as THREE.InstancedMesh | undefined;
      if (!inst) continue;
      for (let n = 0; n < named.length; n++) {
        const cell = atlas.cells[n];
        if (!cell || cell.sheet !== atlas.sheets.indexOf(sheet)) continue;
        const seat = devFriend(named[n].i);
        const dx = seat.x - camera.position.x;
        const dy = 1.9 - camera.position.y;
        const dz = seat.z - camera.position.z;
        const dist = Math.hypot(dx, dy, dz);
        const w = !show || dist < 6.5 ? 0.001 : Math.min(cell.sx, 0.58, 0.16 + dist * 0.035);
        const h = (cell.sy * w) / Math.max(cell.sx, 0.01);
        dummy.position.set(seat.x, show ? 2.05 : -8, seat.z);
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
      <hemisphereLight args={["#d5e4f2", "#6a6248", 1.45]} />
      <directionalLight position={[10, 26, -18]} intensity={1.85} color="#fff4e0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[160, 160]} />
        <meshLambertMaterial color="#6d7a52" />
      </mesh>
      <group ref={kongRef}>
        <primitive object={pack.kong} />
        <group ref={plate} position={[0, 17.2, 0.2]} scale={1.7}>
          <mesh position={[0, 0, -0.02]}>
            <planeGeometry args={[5.1, 0.55]} />
            <meshBasicMaterial color="#1a120e" side={THREE.DoubleSide} />
          </mesh>
          <mesh ref={bar} position={[0, 0, 0]}>
            <planeGeometry args={[4.7, 0.36]} />
            <meshBasicMaterial color="#e23b3b" side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
      <instancedMesh ref={bodies} args={[pack.body, undefined, DEVKONG_OURS]} frustumCulled={false}>
        <meshLambertMaterial color="#1a56e8" />
      </instancedMesh>
      <instancedMesh ref={helms} args={[pack.helm, undefined, DEVKONG_OURS]} frustumCulled={false}>
        <meshLambertMaterial color="#e7eef5" />
      </instancedMesh>
      <instancedMesh ref={spears} args={[spearMesh, undefined, 8]} frustumCulled={false} count={0}>
        <meshBasicMaterial color="#e6d2a8" />
      </instancedMesh>
      <instancedMesh ref={arrows} args={[arrowMesh, undefined, 8]} frustumCulled={false} count={0}>
        <meshBasicMaterial color="#f4f7fb" />
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

export function DevKongCam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = devKongCam(devKongT());
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
