import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import {
  ELF_ARROW_MAX,
  ELF_N,
  ORC_N,
  elfArrows,
  elfAssets,
  elfAt,
  elfCam,
  elfPhone,
  elfPieceReady,
  elfResetClock,
  elfT,
  orcAt,
  setElfFloor,
  type ElfPose,
} from "../../elfReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

function loadGlb(loader: GLTFLoader, url: string, ok: (gltf: Gltf) => void, fail: (err: unknown) => void) {
  const buf = preloadedGlb(url);
  if (buf) {
    loader.parse(buf.slice(0), "", ok, fail);
    return;
  }
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 22000);
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
const arrowDir = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const down = new THREE.Vector3(0, -1, 0);
const ray = new THREE.Raycaster();
const origin = new THREE.Vector3();
const pose: ElfPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, hide: false };

type FigureAsset = { geo: THREE.BufferGeometry; mat: THREE.Material };

function tuneMaterial(src: THREE.Material) {
  const base = (Array.isArray(src) ? src[0] : src) as THREE.MeshStandardMaterial;
  const map = base.map ?? null;
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.needsUpdate = true;
  }
  return new THREE.MeshLambertMaterial({
    map,
    color: base.color ? base.color.clone() : "#ffffff",
    side: THREE.DoubleSide,
  });
}

/** Scale GLB to height; no ground-slab cut (keeps elf mesh intact). */
function extractFigure(gltf: Gltf, height: number): FigureAsset | null {
  const root = gltf.scene;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = tuneMaterial(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material);
    mesh.frustumCulled = false;
  });
  root.position.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  const bound = new THREE.Box3().setFromObject(root);
  const span = Math.max(0.001, bound.max.y - bound.min.y);
  root.scale.setScalar(height / span);
  root.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(root);
  root.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);
  root.updateMatrixWorld(true);
  if (fitted.max.y - fitted.min.y < height * 0.65) return null;

  const parts: THREE.BufferGeometry[] = [];
  let mat: THREE.Material | null = null;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    parts.push(geo);
    if (!mat) mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  });
  if (!parts.length || !mat) return null;

  const merged = parts.length > 1 ? mergeGeometries(parts, false) : parts[0];
  if (!merged) return null;
  for (const g of parts) {
    if (g !== merged) g.dispose();
  }
  return { geo: merged, mat };
}

function disposeFigure(asset: FigureAsset | null) {
  if (!asset) return;
  asset.geo.dispose();
  asset.mat.dispose();
}

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

function placeActor(mesh: THREE.Object3D, p: ElfPose) {
  mesh.visible = !p.hide;
  if (p.hide) return;
  mesh.position.set(p.x, p.y, p.z);
  mesh.rotation.order = "YXZ";
  mesh.rotation.set(p.pitch, p.yaw, p.roll);
}

function ElfSquad({ asset }: { asset: FigureAsset }) {
  const squad = useMemo(() => {
    const root = new THREE.Group();
    root.renderOrder = 12;
    const actors: THREE.Mesh[] = [];
    for (let i = 0; i < ELF_N; i++) {
      const mesh = new THREE.Mesh(asset.geo, asset.mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 12;
      root.add(mesh);
      actors.push(mesh);
    }
    return { root, actors };
  }, [asset.geo, asset.mat]);

  useFrame(() => {
    const t = elfT();
    for (let i = 0; i < squad.actors.length; i++) {
      placeActor(squad.actors[i], elfAt(i, t));
    }
  });

  return <primitive object={squad.root} />;
}

function OrcSquad({ asset }: { asset: FigureAsset }) {
  const squad = useMemo(() => {
    const root = new THREE.Group();
    root.renderOrder = 4;
    const actors: THREE.Mesh[] = [];
    for (let i = 0; i < ORC_N; i++) {
      const mesh = new THREE.Mesh(asset.geo, asset.mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      root.add(mesh);
      actors.push(mesh);
    }
    return { root, actors };
  }, [asset.geo, asset.mat]);

  useFrame(() => {
    const t = elfT();
    for (let i = 0; i < squad.actors.length; i++) {
      placeActor(squad.actors[i], orcAt(i, t));
    }
  });

  return <primitive object={squad.root} />;
}

function Figures({ floorReady }: { floorReady: boolean }) {
  const [elfAsset, setElfAsset] = useState<FigureAsset | null>(null);
  const [orcAsset, setOrcAsset] = useState<FigureAsset | null>(null);
  const assets = elfAssets();

  useEffect(() => {
    if (!floorReady) return;
    const loader = new GLTFLoader();
    let drop = false;

    loadGlb(
      loader,
      assets.elf,
      (gltf) => {
        if (drop) return;
        const built = extractFigure(gltf, 2.12);
        if (!built) {
          console.warn("elf figure empty");
          elfPieceReady("elf", false);
          return;
        }
        setElfAsset(built);
        elfPieceReady("elf", true);
      },
      (err) => {
        console.warn("elf load failed", err);
        if (!drop) elfPieceReady("elf", false);
      }
    );

    loadGlb(
      loader,
      assets.orc1,
      (gltf) => {
        if (drop) return;
        const built = extractFigure(gltf, 1.5);
        if (!built) {
          console.warn("orc figure empty");
          elfPieceReady("orc", false);
          return;
        }
        setOrcAsset(built);
        elfPieceReady("orc", true);
      },
      (err) => {
        console.warn("orc load failed", err);
        if (!drop) elfPieceReady("orc", false);
      }
    );

    return () => {
      drop = true;
      setElfAsset((prev) => {
        disposeFigure(prev);
        return null;
      });
      setOrcAsset((prev) => {
        disposeFigure(prev);
        return null;
      });
    };
  }, [floorReady, assets.elf, assets.orc1]);

  if (!elfAsset || !orcAsset) return null;
  return (
    <>
      <ElfSquad asset={elfAsset} />
      <OrcSquad asset={orcAsset} />
    </>
  );
}

function Meydan({ onFloor }: { onFloor: () => void }) {
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
            mesh.material = tuneMaterial(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material);
            mesh.frustumCulled = false;
            mesh.renderOrder = 0;
          });
          model.updateMatrixWorld(true);
          paintFloor(model);
          setGround(model);
          onFloor();
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
  }, [onFloor]);
  return ground ? <primitive object={ground} /> : null;
}

function arrowGeo() {
  const shaft = new THREE.CylinderGeometry(0.006, 0.0075, 0.72, 5);
  const head = new THREE.ConeGeometry(0.022, 0.11, 5);
  head.translate(0, 0.42, 0);
  return mergeGeometries([shaft, head], false) ?? shaft;
}

function Arrows() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => arrowGeo(), []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: "#c9a56a" }), []);
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
    const { list, n } = elfArrows(elfT());
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
  return <instancedMesh ref={mesh} args={[geo, mat, ELF_ARROW_MAX]} frustumCulled={false} renderOrder={8} />;
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
    persp.near = 0.08;
    persp.far = 720;
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

export function ElfBattle() {
  const [floorReady, setFloorReady] = useState(false);
  const markFloor = useMemo(() => () => setFloorReady(true), []);

  useEffect(() => {
    elfResetClock();
  }, []);

  return (
    <group>
      <DuskSky />
      <ambientLight intensity={0.42} color="#e8dcc8" />
      <hemisphereLight args={["#f3d8b0", "#3a2a1c", 0.85]} />
      <directionalLight position={[14, 20, 6]} intensity={1.75} color="#ffc178" />
      <directionalLight position={[-10, 12, -8]} intensity={0.55} color="#9eb4d4" />
      <Meydan onFloor={markFloor} />
      {floorReady && (
        <>
          <Figures floorReady={floorReady} />
          <Arrows />
        </>
      )}
    </group>
  );
}
