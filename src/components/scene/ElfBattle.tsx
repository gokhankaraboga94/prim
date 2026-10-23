import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { dropGroundSlab } from "../../groundSlab";
import { preloadedGlb } from "../../arenaPreload";
import { REEL_HOLD } from "../../recordCanvas";
import {
  ELF_ELF_URL,
  ELF_FIELD_URL,
  ELF_N,
  ELF_ORC1_URL,
  ELF_ORC2_URL,
  ORC_N,
  elfArrows,
  elfAt,
  elfCam,
  orcAt,
  orcKind,
  type ElfPose,
} from "../../elfReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

function loadGlb(loader: GLTFLoader, url: string, ok: (gltf: Gltf) => void, fail: (err: unknown) => void) {
  const buf = preloadedGlb(url);
  if (buf) loader.parse(buf.slice(0), "", ok, fail);
  else loader.load(url, ok, undefined, fail);
}

const dummy = new THREE.Object3D();
const pose: ElfPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, hide: false };
const arrowDir = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

function keepMat(src: THREE.Material) {
  const mat = src.clone();
  mat.side = THREE.DoubleSide;
  mat.shadowSide = THREE.DoubleSide;
  return mat;
}

function fitFigure(root: THREE.Object3D, height: number) {
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const baked = mesh.geometry.clone();
    baked.applyMatrix4(mesh.matrixWorld);
    mesh.geometry.dispose();
    mesh.geometry = dropGroundSlab(baked);
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    mesh.updateMatrix();
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(keepMat);
    else mesh.material = keepMat(mesh.material);
  });
  root.position.set(0, 0, 0);
  root.quaternion.identity();
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const span = Math.max(0.001, box.max.y - box.min.y);
  root.scale.setScalar(height / span);
  root.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(root);
  root.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);
  root.updateMatrixWorld(true);
}

type Pack = { mesh: THREE.InstancedMesh };

function packsFrom(root: THREE.Object3D, count: number): Pack[] {
  const out: Pack[] = [];
  root.traverse((obj) => {
    const src = obj as THREE.Mesh;
    if (!src.isMesh) return;
    const geo = src.geometry;
    const mat = Array.isArray(src.material) ? src.material[0] : src.material;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    dummy.position.set(0, -40, 0);
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
    out.push({ mesh });
  });
  return out;
}

function paintPack(pack: Pack[], count: number, at: (i: number, out: ElfPose) => void) {
  for (let i = 0; i < count; i++) {
    at(i, pose);
    if (pose.hide) {
      dummy.position.set(0, -40, 0);
      dummy.scale.setScalar(0);
    } else {
      dummy.position.set(pose.x, pose.y, pose.z);
      dummy.rotation.order = "YXZ";
      dummy.rotation.set(pose.pitch, pose.yaw, pose.roll);
      dummy.scale.setScalar(1);
    }
    dummy.updateMatrix();
    for (const item of pack) item.mesh.setMatrixAt(i, dummy.matrix);
  }
  for (const item of pack) item.mesh.instanceMatrix.needsUpdate = true;
}

function disposePack(pack: Pack[]) {
  for (const item of pack) {
    item.mesh.parent?.remove(item.mesh);
    item.mesh.geometry.dispose();
    const mats = Array.isArray(item.mesh.material) ? item.mesh.material : [item.mesh.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      std.map?.dispose();
      std.normalMap?.dispose();
      std.roughnessMap?.dispose();
      std.metalnessMap?.dispose();
      std.aoMap?.dispose();
      std.emissiveMap?.dispose();
      mat.dispose();
    }
  }
}

function ElfFigures({ url, height, count, pick }: { url: string; height: number; count: number; pick: (i: number, t: number, out: ElfPose) => void }) {
  const group = useRef<THREE.Group>(null);
  const pack = useRef<Pack[]>([]);
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loadGlb(
      loader,
      url,
      (gltf) => {
        if (drop || !group.current) return;
        const root = gltf.scene;
        fitFigure(root, height);
        const next = packsFrom(root, count);
        pack.current = next;
        for (const item of next) group.current.add(item.mesh);
      },
      (err) => console.warn("elf model failed", url, err)
    );
    return () => {
      drop = true;
      disposePack(pack.current);
      pack.current = [];
    };
  }, [url, height, count]);
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    if (!pack.current.length) return;
    paintPack(pack.current, count, (i, out) => pick(i, t, out));
  });
  return <group ref={group} />;
}

function Meydan() {
  const root = useRef<THREE.Group>(null);
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loadGlb(
      loader,
      ELF_FIELD_URL,
      (gltf) => {
        const host = root.current;
        if (drop || !host) return;
        const model = gltf.scene;
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const span = Math.max(size.x, size.z, 1);
        const s = 92 / span;
        model.scale.setScalar(s);
        model.updateMatrixWorld(true);
        const fitted = new THREE.Box3().setFromObject(model);
        model.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.frustumCulled = false;
          mesh.castShadow = false;
          mesh.receiveShadow = true;
        });
        host.add(model);
      },
      (err) => console.warn("meydan failed", err)
    );
    return () => {
      drop = true;
      const host = root.current;
      if (!host) return;
      host.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) mat?.dispose();
      });
      host.clear();
    };
  }, []);
  return <group ref={root} />;
}

function Arrows() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.CylinderGeometry(0.018, 0.012, 1.15, 5), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d8c089", metalness: 0.35, roughness: 0.42 }), []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat]
  );
  useFrame(({ clock }) => {
    const inst = mesh.current;
    if (!inst) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const { list, n } = elfArrows(t);
    dummy.scale.setScalar(0);
    dummy.position.set(0, -20, 0);
    dummy.updateMatrix();
    for (let i = 0; i < inst.count; i++) inst.setMatrixAt(i, dummy.matrix);
    for (let i = 0; i < n; i++) {
      const a = list[i];
      arrowDir.set(a.dx, a.dy, a.dz);
      if (arrowDir.lengthSq() < 1e-8) continue;
      dummy.position.set(a.x, a.y, a.z);
      dummy.quaternion.setFromUnitVectors(up, arrowDir.normalize());
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[geo, mat, 28]} frustumCulled={false} />;
}

function DuskSky() {
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
            vec3 zenith = vec3(0.18, 0.28, 0.48);
            vec3 horizon = vec3(0.86, 0.58, 0.32);
            vec3 below = vec3(0.42, 0.32, 0.24);
            vec3 col = mix(below, horizon, smoothstep(-0.4, 0.04, h));
            col = mix(col, zenith, smoothstep(0.08, 0.62, h));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    []
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} frustumCulled={false}>
      <sphereGeometry args={[220, 24, 16]} />
    </mesh>
  );
}

export function ElfCam() {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = elfCam(Math.max(0, clock.elapsedTime - REEL_HOLD));
    persp.fov = shot.fov;
    persp.near = 0.12;
    persp.far = 720;
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

function writePose(src: ElfPose, out: ElfPose) {
  out.x = src.x;
  out.y = src.y;
  out.z = src.z;
  out.yaw = src.yaw;
  out.pitch = src.pitch;
  out.roll = src.roll;
  out.hide = src.hide;
}

export function ElfBattle() {
  return (
    <group>
      <DuskSky />
      <hemisphereLight args={["#f0d4a8", "#3a2a1c", 0.62]} />
      <directionalLight position={[18, 22, 8]} intensity={1.35} color="#ffc178" />
      <directionalLight position={[-12, 8, -6]} intensity={0.38} color="#8ea4c4" />
      <Meydan />
      <ElfFigures url={ELF_ELF_URL} height={1.72} count={ELF_N} pick={(i, t, out) => writePose(elfAt(i, t), out)} />
      <ElfFigures
        url={ELF_ORC1_URL}
        height={1.52}
        count={ORC_N}
        pick={(i, t, out) => writePose(orcKind(i) === 0 ? orcAt(i, t) : { ...orcAt(i, t), hide: true }, out)}
      />
      <ElfFigures
        url={ELF_ORC2_URL}
        height={1.52}
        count={ORC_N}
        pick={(i, t, out) => writePose(orcKind(i) === 1 ? orcAt(i, t) : { ...orcAt(i, t), hide: true }, out)}
      />
      <Arrows />
    </group>
  );
}
