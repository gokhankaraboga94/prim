import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { dropGroundSlab } from "../../groundSlab";
import { preloadedGlb } from "../../arenaPreload";
import { ELF_N, ORC_N, elfArrows, elfAssets, elfAt, elfCam, elfPhone, elfPieceReady, elfT, orcAt, orcKind, setElfFloor, type ElfPose } from "../../elfReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

function loadGlb(loader: GLTFLoader, url: string, ok: (gltf: Gltf) => void, fail: (err: unknown) => void) {
  const buf = preloadedGlb(url);
  if (buf) {
    loader.parse(buf.slice(0), "", ok, fail);
    return;
  }
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 18000);
  void fetch(url, { signal: ctrl.signal })
    .then((res) => {
      if (!res.ok) throw new Error(`${res.status}`);
      return res.arrayBuffer();
    })
    .then((data) => {
      window.clearTimeout(timer);
      loader.parse(data, "", ok, fail);
    })
    .catch((err) => {
      window.clearTimeout(timer);
      fail(err);
    });
}

const dummy = new THREE.Object3D();
const pose: ElfPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, hide: false };
const arrowDir = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const down = new THREE.Vector3(0, -1, 0);
const ray = new THREE.Raycaster();
const origin = new THREE.Vector3();
const skinPt = new THREE.Vector3();

function paintFloor(root: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(root);
  const pad = 0.1;
  const x0 = box.min.x + (box.max.x - box.min.x) * pad;
  const x1 = box.max.x - (box.max.x - box.min.x) * pad;
  const z0 = box.min.z + (box.max.z - box.min.z) * pad;
  const z1 = box.max.z - (box.max.z - box.min.z) * pad;
  const cols = elfPhone() ? 14 : 28;
  const rows = elfPhone() ? 18 : 36;
  const ys = new Float32Array(cols * rows);
  const top = box.max.y + 6;
  ray.far = box.max.y - box.min.y + 14;
  let sum = 0;
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + ((c + 0.5) / cols) * (x1 - x0);
      const z = z0 + ((r + 0.5) / rows) * (z1 - z0);
      origin.set(x, top, z);
      ray.set(origin, down);
      const hit = ray.intersectObject(root, true)[0];
      const y = hit ? hit.point.y : box.min.y;
      ys[r * cols + c] = y;
      if (hit) {
        sum += y;
        n += 1;
      }
    }
  }
  const lift = n ? sum / n : 0;
  setElfFloor({
    x0,
    x1,
    z0,
    z1,
    cols,
    rows,
    ys,
    lift,
    zElf: z0 + (z1 - z0) * 0.2,
    zSpawn: z0 + (z1 - z0) * 0.86,
  });
}

function keepMat(src: THREE.Material) {
  const base = (Array.isArray(src) ? src[0] : src) as THREE.MeshStandardMaterial;
  const map = base.map ?? null;
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.generateMipmaps = true;
    map.needsUpdate = true;
  }
  return new THREE.MeshLambertMaterial({
    map,
    color: base.color ? base.color.clone() : "#ffffff",
    side: THREE.DoubleSide,
  });
}

function bakeMeshGeometry(mesh: THREE.Mesh) {
  const skinned = mesh as THREE.SkinnedMesh;
  mesh.updateMatrixWorld(true);
  let baked: THREE.BufferGeometry;
  if (skinned.isSkinnedMesh) {
    skinned.skeleton?.update();
    baked = skinned.geometry.clone();
    const pos = baked.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      skinned.getVertexPosition(i, skinPt);
      pos.setXYZ(i, skinPt.x, skinPt.y, skinPt.z);
    }
    baked.applyMatrix4(mesh.matrixWorld);
  } else {
    baked = mesh.geometry.clone();
    baked.applyMatrix4(mesh.matrixWorld);
  }
  const trimmed = dropGroundSlab(baked);
  trimmed.computeBoundingBox();
  const box = trimmed.boundingBox;
  if (box && box.max.y - box.min.y < 0.04) {
    trimmed.dispose();
    return baked;
  }
  if (trimmed !== baked) baked.dispose();
  return trimmed;
}

function fitFigure(root: THREE.Object3D, height: number) {
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = bakeMeshGeometry(mesh);
    mesh.geometry.dispose();
    mesh.geometry = geo;
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    mesh.updateMatrix();
    mesh.material = keepMat(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material);
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

function packsFrom(root: THREE.Object3D, count: number, renderOrder = 0): Pack[] {
  const parts: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
  root.traverse((obj) => {
    const src = obj as THREE.Mesh;
    if (!src.isMesh) return;
    parts.push({ geo: src.geometry, mat: Array.isArray(src.material) ? src.material[0] : src.material });
  });
  if (!parts.length) return [];

  const make = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = renderOrder;
    dummy.position.set(0, -40, 0);
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  };

  if (parts.length === 1) return [{ mesh: make(parts[0].geo, parts[0].mat) }];

  const merged = mergeGeometries(parts.map((p) => p.geo), false);
  if (merged) return [{ mesh: make(merged, parts[0].mat) }];

  return parts.map((p) => ({ mesh: make(p.geo, p.mat) }));
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

function ElfFigures({
  url,
  height,
  count,
  pick,
  drawOrder = 0,
  kind,
}: {
  url: string;
  height: number;
  count: number;
  pick: (i: number, t: number, out: ElfPose) => void;
  drawOrder?: number;
  kind: "elf" | "orc";
}) {
  const pack = useRef<Pack[]>([]);
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const [meshes, setMeshes] = useState<THREE.InstancedMesh[]>([]);
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loadGlb(
      loader,
      url,
      (gltf) => {
        if (drop) return;
        try {
          const root = gltf.scene;
          fitFigure(root, height);
          const next = packsFrom(root, count, drawOrder);
          pack.current = next;
          setMeshes(next.map((p) => p.mesh));
          paintPack(next, count, (i, out) => pickRef.current(i, 0, out));
          elfPieceReady(kind, next.length > 0);
        } catch (err) {
          console.warn("elf model failed", url, err);
          elfPieceReady(kind, false);
        }
      },
      (err) => {
        console.warn("elf model failed", url, err);
        if (!drop) elfPieceReady(kind, false);
      }
    );
    return () => {
      drop = true;
      disposePack(pack.current);
      pack.current = [];
      setMeshes([]);
    };
  }, [url, height, count, drawOrder, kind]);
  useFrame(() => {
    if (!pack.current.length) return;
    paintPack(pack.current, count, (i, out) => pickRef.current(i, elfT(), out));
  });
  return (
    <group>
      {meshes.map((mesh, i) => (
        <primitive key={`${url}-${i}`} object={mesh} />
      ))}
    </group>
  );
}

function Meydan() {
  const [ground, setGround] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loadGlb(
      loader,
      elfAssets().field,
      (gltf) => {
        if (drop) return;
        try {
          const model = gltf.scene;
          model.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const span = Math.max(size.x, size.z, 1);
          const s = 72 / span;
          model.scale.setScalar(s);
          model.updateMatrixWorld(true);
          const fitted = new THREE.Box3().setFromObject(model);
          model.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);
          model.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.material = keepMat(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material);
            mesh.frustumCulled = false;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
          });
          model.updateMatrixWorld(true);
          paintFloor(model);
          setGround(model);
          elfPieceReady("field", true);
        } catch (err) {
          console.warn("meydan failed", err);
          elfPieceReady("field", false);
        }
      },
      (err) => {
        console.warn("meydan failed", err);
        if (!drop) elfPieceReady("field", false);
      }
    );
    return () => {
      drop = true;
      setGround((prev) => {
        if (!prev) return null;
        prev.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) mat?.dispose();
        });
        return null;
      });
    };
  }, []);
  return ground ? <primitive object={ground} /> : null;
}

function paintVerts(geo: THREE.BufferGeometry, hex: string) {
  const n = geo.getAttribute("position").count;
  const rgb = new Float32Array(n * 3);
  const c = new THREE.Color(hex);
  for (let i = 0; i < n; i++) {
    rgb[i * 3] = c.r;
    rgb[i * 3 + 1] = c.g;
    rgb[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
  return geo;
}

function arrowGeo() {
  const shaft = paintVerts(new THREE.CylinderGeometry(0.006, 0.0075, 0.88, 6), "#8a5a2b");
  const head = paintVerts(new THREE.ConeGeometry(0.024, 0.13, 6), "#b8b4ae");
  head.translate(0, 0.505, 0);
  const nock = paintVerts(new THREE.CylinderGeometry(0.009, 0.009, 0.035, 5), "#5a3a1c");
  nock.translate(0, -0.455, 0);
  const fletch: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const vane = paintVerts(new THREE.BoxGeometry(0.0035, 0.15, 0.048), "#e8d8c0");
    vane.translate(0, -0.36, 0.028);
    vane.rotateY((i * Math.PI * 2) / 3);
    fletch.push(vane);
  }
  const merged = mergeGeometries([shaft, head, nock, ...fletch], false) ?? shaft;
  shaft.dispose();
  head.dispose();
  nock.dispose();
  for (const vane of fletch) vane.dispose();
  return merged;
}

function Arrows() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => arrowGeo(), []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat]
  );
  useFrame(() => {
    const inst = mesh.current;
    if (!inst) return;
    const t = elfT();
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
      <sphereGeometry args={elfPhone() ? [220, 16, 10] : [220, 24, 16]} />
    </mesh>
  );
}

export function ElfCam() {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = elfCam(elfT());
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

const hidden: ElfPose = { x: 0, y: -40, z: 0, yaw: 0, pitch: 0, roll: 0, hide: true };

export function ElfBattle() {
  const assets = elfAssets();
  return (
    <group>
      <DuskSky />
      <hemisphereLight args={["#f3d8b0", "#3a2a1c", 0.78]} />
      <directionalLight position={[18, 22, 8]} intensity={1.55} color="#ffc178" />
      <directionalLight position={[-12, 8, -6]} intensity={0.48} color="#8ea4c4" />
      <Meydan />
      <ElfFigures
        kind="elf"
        url={assets.elf}
        height={1.92}
        count={ELF_N}
        drawOrder={2}
        pick={(i, t, out) => writePose(elfAt(i, t), out)}
      />
      <ElfFigures
        kind="orc"
        url={assets.orc1}
        height={1.52}
        count={ORC_N}
        pick={(i, t, out) => writePose(orcKind(i) === 0 ? orcAt(i, t) : hidden, out)}
      />
      <ElfFigures
        kind="orc"
        url={assets.orc2}
        height={1.52}
        count={ORC_N}
        pick={(i, t, out) => writePose(orcKind(i) === 1 ? orcAt(i, t) : hidden, out)}
      />
      <Arrows />
    </group>
  );
}
